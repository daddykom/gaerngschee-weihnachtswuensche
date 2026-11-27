import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Fulfillment route', () => {
  test('loads a released wish that was absent from an already open list', async ({ page }) => {
    let released = false;
    await page.route('**/public/fulfiller/orders**', (route) =>
      route.fulfill({
        json: {
          orders: released
            ? [
                {
                  id: 'order-released',
                  year: 2026,
                  orderNumber: 12,
                  currentText: null,
                  items: [
                    {
                      id: 'wish-released',
                      orderId: 'order-released',
                      itemNumber: 1,
                      wishNumber: '12-1',
                      title: 'Released wish',
                      currentDescription: 'Available again',
                      category: 'gift',
                      fulfillmentStatus: 'available',
                      reservedAt: null,
                      reservationExpiresAt: null,
                    },
                  ],
                },
              ]
            : [],
        },
      }),
    );
    await page.route('**/public/fulfiller/availability-version', (route) =>
      route.fulfill({ json: { version: released ? 1 : 0 } }),
    );
    await page.route('**/public/fulfiller/wish-statuses', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'wish-released',
              fulfillmentStatus: 'available',
              reservedAt: null,
              reservationExpiresAt: null,
            },
          ],
        },
      }),
    );
    const initialPoll = page.waitForResponse('**/public/fulfiller/availability-version');
    await page.goto('/erfuellen');
    await initialPoll;
    await expect(page.locator('.wish-entry')).toHaveCount(0);
    released = true;
    await expect(page.locator('.wish-entry')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('.wish-entry h3')).toHaveText('Released wish');
  });
  test('offers an update dialog when a new build is detected', async ({ page }) => {
    const baseline = await (await page.request.get('/build-info.json')).json();
    let changed = false;
    await page.route('http://localhost:8083/public/fulfiller/orders**', (route) =>
      route.fulfill({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-App-Build',
          'X-App-Build': changed ? 'new-test-build' : baseline.buildId,
        },
        json: { orders: [] },
      }),
    );
    await page.route('http://localhost:8083/public/fulfiller/wish-statuses', (route) =>
      route.fulfill({ json: { items: [] } }),
    );
    await page.route('http://localhost:8083/public/fulfiller/availability-version', (route) =>
      route.fulfill({ json: { version: 0 } }),
    );

    await page.goto('/erfuellen');
    await expectTranslatedText(page.locator('h1'), 'app.fulfiller.pageTitle');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    changed = true;
    await page.locator('input[type="search"]').fill('Holz');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectTranslatedText(dialog.getByRole('heading'), 'app.update.dialog.title');
    await dialog.getByRole('button', { name: 'Später', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('app-update-notice')).toBeVisible();
    await expect(page.locator('.app-footer__version')).toContainText(baseline.appVersion);
  });

  test('shows wishes grouped by definitive order and reserves one wish', async ({ page }) => {
    const requests: URL[] = [];
    await page.route('http://localhost:8083/public/fulfiller/orders**', async (route) => {
      requests.push(new URL(route.request().url()));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: [
            {
              id: 'order-1',
              year: 2026,
              orderNumber: 12,
              currentText: 'Anonymisierte Familieninformation',
              items: [
                {
                  id: 'item-1',
                  itemNumber: 1,
                  wishNumber: '12-1',
                  title: 'Bauklötze',
                  category: 'gift',
                  currentDescription: 'Bunte Holzbausteine zum Bauen',
                  giftLink: 'https://example.com/building-blocks',
                  fulfillmentStatus: 'available',
                  reservedAt: null,
                  reservationExpiresAt: null,
                },
              ],
            },
          ],
        }),
      });
    });
    await page.route('http://localhost:8083/public/fulfiller/wish-statuses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });
    await page.route(
      'http://localhost:8083/public/fulfiller/availability-version',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ version: 0 }),
        });
      },
    );
    await page.route('http://localhost:8083/public/fulfiller-reservation-start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sent: true,
          itemId: 'item-1',
          reservationExpiresAt: '2026-10-31T12:10:00Z',
        }),
      });
    });

    await page.goto('/erfuellen');
    const searchControl = page
      .locator('mat-form-field')
      .filter({ has: page.locator('input[type="search"]') })
      .locator('.mat-mdc-text-field-wrapper');
    const categoryControl = page
      .locator('mat-form-field')
      .filter({ has: page.getByRole('combobox') })
      .locator('.mat-mdc-text-field-wrapper');
    await expect(searchControl).toBeVisible();
    await expect(categoryControl).toBeVisible();
    await expect
      .poll(async () => {
        const searchBounds = await searchControl.boundingBox();
        const categoryBounds = await categoryControl.boundingBox();
        return Math.abs((searchBounds?.height ?? 0) - (categoryBounds?.height ?? 0));
      })
      .toBeLessThan(2);
    await expectTranslatedText(page.locator('h1'), 'app.fulfiller.pageTitle');
    await expect(page.getByRole('heading', { name: 'Bauklötze' })).toBeVisible();
    await expect(page.locator('.wish-entry')).toContainText('Bunte Holzbausteine zum Bauen');
    await expect(page.locator('.wish-entry a')).toHaveAttribute(
      'href',
      'https://example.com/building-blocks',
    );
    await expectTranslatedText(page.locator('.wish-entry a'), 'app.fulfiller.wishDetails.giftLink');
    // The exact wording is the regression target: form-only optional hints must not leak here.
    await expect(page.locator('.wish-entry a')).toHaveText('Link zum gewünschten Geschenk');
    await expect(
      page
        .locator('mat-card-content > div.gl-stack > p.gl-text--multiline')
        .filter({ hasText: 'Anonymisierte' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Diesen Wunsch erfüllen' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Bunte Holzbausteine zum Bauen');
    await expect(
      page.getByRole('dialog').locator('.reservation-dialog__details a'),
    ).toHaveAttribute('href', 'https://example.com/building-blocks');
    const dialogGiftLink = page.getByRole('dialog').locator('.reservation-dialog__details a');
    await expectTranslatedText(dialogGiftLink, 'app.fulfiller.reservationDialog.giftLink');
    await expect(dialogGiftLink).toHaveText('Link zum gewünschten Geschenk');
    await page.getByRole('dialog').getByLabel('Deine E-Mail-Adresse').fill('fulfiller@example.com');
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Bestätigungslink senden' }).click();

    await expect(page.getByText('Bestätigung per E-Mail ausstehend')).toBeVisible();
    await page.locator('input[type="search"]').fill('Bau');
    await expect.poll(() => requests.at(-1)?.searchParams.get('q')).toBe('Bau');
  });
});
