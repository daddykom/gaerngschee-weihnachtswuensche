import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Fulfillment route', () => {
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
                  category: 'gift',
                  currentDescription: 'Bauklötze',
                  currentReason: 'Zum gemeinsamen Spielen',
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
    await expectTranslatedText(page.locator('h1'), 'app.fulfiller.pageTitle');
    await expect(page.getByRole('heading', { name: '12-1' })).toBeVisible();
    await expect(
      page
        .locator('mat-card-content > div.gl-stack > p.gl-text--multiline')
        .filter({ hasText: 'Anonymisierte' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Diesen Wunsch erfüllen' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByLabel('Deine E-Mail-Adresse').fill('fulfiller@example.com');
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Bestätigungslink senden' }).click();

    await expect(page.getByText('Bestätigung per E-Mail ausstehend')).toBeVisible();
    await page.locator('input[type="search"]').fill('Bau');
    await expect.poll(() => requests.at(-1)?.searchParams.get('q')).toBe('Bau');
  });
});
