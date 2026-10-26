import { expect, test } from './support/test';

test.describe('Bestellung route', () => {
  test('saves the order and shows the released Fairgate confirmation', async ({ page }) => {
    let saveRequestReceived = false;
    let logoutRequestReceived = false;

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
    await page.route('http://localhost:8083/auth/logout', async (route) => {
      logoutRequestReceived = true;
      await route.fulfill({ status: 204 });
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
          items: [{ category: 'gift', description: 'Ein schönes Geschenk', reason: 'Das würde mir Freude machen.' }],
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order: { id: 'order-1', status: 'released' },
          status: 'released',
          fairgateUserExists: true,
        }),
      });
    });

    await page.goto('/client-login?token=registration-token');
    await page.waitForURL('**/bestellung');
    await expect(page.locator('.app-notification')).toContainText(
      'Die Anzahl der Erwachsenen und Kinder wurde aus Fairgate übernommen.',
    );
    await page.locator('input[type="password"]').first().fill('long-enough-password');
    await page.locator('input[type="password"]').nth(1).fill('long-enough-password');
    await page.locator('textarea').fill('Ich wünsche mir etwas Schönes.');
    await page.getByRole('button', { name: 'Wunsch hinzufügen' }).click();
    await page.waitForURL('**/bestellung/wunsch/neu');
    await page.getByRole('combobox', { name: 'Kategorie' }).click();
    await page.getByRole('option', { name: 'Geschenk' }).click();
    await page.locator('textarea').nth(0).fill('Ein schönes Geschenk');
    await page.locator('textarea').nth(1).fill('Das würde mir Freude machen.');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL('**/bestellung');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.waitForURL('**/bestellung/bestaetigung?status=released');
    expect(saveRequestReceived).toBe(true);
    expect(logoutRequestReceived).toBe(true);
    await expect(page.locator('.app-notification')).toContainText(
      'Deine Daten werden den Administratoren zur Prüfung vorgelegt.',
    );
    await expect(page.getByRole('link', { name: 'Zur Login-Seite' })).toHaveAttribute('href', '/login');
  });
});
