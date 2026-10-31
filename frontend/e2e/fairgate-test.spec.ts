import { expectTranslatedText } from './support/assertions';
import { test } from './support/test';

test.describe('Fairgate test route', () => {
  test('rejects a normal user', async ({ page }) => {
    await page.route('http://localhost:8083/auth/session-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }),
      });
    });
    await page.route('http://localhost:8083/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-1', email: 'user@example.com', group: 'user' },
          group: 'user',
          requiredPasswordReset: false,
        }),
      });
    });

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('secret');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/not-found');
    await expectTranslatedText(page.locator('h1'), 'app.notFound.pageTitle');
  });
});
