import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Fulfiller registration route', () => {
  test('requires the privacy opt-in before sending a passwordless login link', async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null;
    await page.route('http://localhost:8083/public/fulfiller-start', async (route) => {
      requestBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ sent: true }),
      });
    });

    await page.goto('/erfuellen');
    await expect(page).toHaveURL(/\/erfuellen\/anmelden$/);
    await expectTranslatedText(page.locator('h1'), 'app.fulfillerRegistration.pageTitle');

    await page.locator('input[type="email"]').fill('giver@example.com');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page).toHaveURL(/\/erfuellen\/anmelden$/);

    await page.locator('mat-checkbox').click();
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/erfuellen\/anmelden\/success$/);
    await expect(requestBody).toMatchObject({
      email: 'giver@example.com',
      privacyAccepted: true,
      language: 'de',
    });
  });

  test('logs in with the verified token without a password', async ({ page }) => {
    await page.route('http://localhost:8083/auth/fulfiller-registration-login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'fulfiller-1', email: 'giver@example.com', group: 'wunscherfueller' },
          group: 'wunscherfueller',
          requiredPasswordReset: false,
          firstAccess: false,
        }),
      });
    });
    await page.route('http://localhost:8083/fulfiller/orders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders: [] }),
      });
    });

    await page.goto('/fulfiller-login?token=verified-token');
    await expect(page).toHaveURL(/\/erfuellen$/);
    await expectTranslatedText(page.locator('h1'), 'app.fulfiller.pageTitle');
  });
});
