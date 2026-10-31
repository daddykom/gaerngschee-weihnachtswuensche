import { expectTranslatedText } from './support/assertions';
import { loginAsFulfiller } from './support/fulfiller';
import { expect, test } from './support/test';

test.describe('Fulfillment route', () => {
  test('shows wishes grouped by definitive order and reserves one wish', async ({ page }) => {
    const requests: URL[] = [];
    await page.route('http://localhost:8083/fulfiller/orders**', async (route) => {
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
                },
              ],
            },
          ],
        }),
      });
    });
    await page.route(
      'http://localhost:8083/fulfiller/order-items/item-1/reserve',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            item: {
              orderId: 'order-1',
              id: 'item-1',
              itemNumber: 1,
              fulfillmentStatus: 'reserved',
              reservedAt: '2026-10-31T12:00:00Z',
            },
          }),
        });
      },
    );

    await loginAsFulfiller(page);
    await expectTranslatedText(page.locator('h1'), 'app.fulfiller.pageTitle');
    await expect(page.getByRole('heading', { name: '12-1' })).toBeVisible();
    await expect(
      page
        .locator('mat-card-content > div.gl-stack > p.gl-text--multiline')
        .filter({ hasText: 'Anonymisierte' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Diesen Wunsch erfüllen' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Wunsch reservieren' }).click();

    await expect(page.getByText('Von dir reserviert')).toBeVisible();
    await page.locator('input[type="search"]').fill('Bau');
    await expect.poll(() => requests.at(-1)?.searchParams.get('q')).toBe('Bau');
  });
});
