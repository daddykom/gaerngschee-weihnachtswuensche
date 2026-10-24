import { expect, test } from './support/test';

test.describe('Bestellung route', () => {
  test('saves the order and shows the definitive Fairgate confirmation', async ({ page }) => {
    let saveRequestReceived = false;

    await page.route('http://localhost:8083/auth/registration-login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'client-1', email: 'client@example.com', group: 'wunschbesteller' },
          group: 'wunschbesteller',
          requiredPasswordReset: true,
          firstAccess: true,
          fairgateUserExists: true,
          childrenCount: 2,
          adultsCount: 2,
          fairgateStatus: 'valid',
          salutation: 'Hallo',
        }),
      });
    });
    await page.route('http://localhost:8083/client/order', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            order: null,
            year: 2026,
            fairgateStatus: 'valid',
            fairgateUserExists: true,
            childrenCount: 2,
            adultsCount: 2,
          }),
        });
        return;
      }

      saveRequestReceived = true;
      expect(route.request().postDataJSON()).toMatchObject({
        adultsCount: 2,
        childrenCount: 2,
        text: 'Ich wünsche mir etwas Schönes.',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order: { id: 'order-1', status: 'definitive' },
          status: 'definitive',
          fairgateUserExists: true,
        }),
      });
    });

    await page.goto('/client-login?token=registration-token');
    await page.waitForURL('**/bestellung');
    await page.locator('input[type="password"]').first().fill('long-enough-password');
    await page.locator('input[type="password"]').nth(1).fill('long-enough-password');
    await page.locator('textarea').fill('Ich wünsche mir etwas Schönes.');
    await page.getByRole('button', { name: 'Weiter' }).click();

    await page.waitForURL('**/bestellung/bestaetigung?status=definitive');
    expect(saveRequestReceived).toBe(true);
    await expect(page.locator('.info-box')).toContainText(
      'Deine Daten werden den Administratoren zur Prüfung vorgelegt.',
    );
  });
});
