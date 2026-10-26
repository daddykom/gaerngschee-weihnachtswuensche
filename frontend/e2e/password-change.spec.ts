import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Password change route', () => {
  test('validates required and matching passwords', async ({ page }) => {
    await page.goto('/password-change');
    await page.getByRole('button', { name: 'Passwort ändern' }).click();

    await expectTranslatedText(
      page.locator('main'),
      'app.passwordChange.errors.newPassword.required',
    );
    await expectTranslatedText(
      page.locator('main'),
      'app.passwordChange.errors.passwordConfirmation.required',
    );

    await page.locator('input[type="password"]').nth(0).fill('long-enough-secret');
    await page.locator('input[type="password"]').nth(1).fill('different-secret');
    await page.getByRole('button', { name: 'Passwort ändern' }).click();

    await expectTranslatedText(
      page.locator('main'),
      'app.passwordChange.errors.passwordConfirmation.passwordsDoNotMatch',
    );
  });

  test('changes the password and cannot access the admin overview as a normal user', async ({ page }) => {
    await loginAsUser(page);
    let requestReceived = false;
    await page.route('http://localhost:8083/auth/password-change-authenticated', async (route) => {
      requestReceived = true;
      expect(route.request().postDataJSON()).toEqual({ password: 'long-enough-secret' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: '1', email: 'user@example.com', group: 'user' } }),
      });
    });

    await page.locator('input[type="password"]').nth(0).fill('long-enough-secret');
    await page.locator('input[type="password"]').nth(1).fill('long-enough-secret');
    await page.getByRole('button', { name: 'Passwort ändern' }).click();

    await page.waitForURL('**/not-found');
    expect(requestReceived).toBe(true);
  });

  test('shows a backend error notification', async ({ page }) => {
    await loginAsUser(page);
    await page.route('http://localhost:8083/auth/password-change-authenticated', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'PASSWORD_CHANGE_FAILED', details: {} } }),
      });
    });

    await page.locator('input[type="password"]').nth(0).fill('long-enough-secret');
    await page.locator('input[type="password"]').nth(1).fill('long-enough-secret');
    await page.getByRole('button', { name: 'Passwort ändern' }).click();

    await expectTranslatedText(
      page.locator('.info-box'),
      'app.passwordChange.errors.PASSWORD_CHANGE_FAILED',
    );
  });
});

async function loginAsUser(page: import('@playwright/test').Page): Promise<void> {
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
        user: { id: '2', email: 'user@example.com', group: 'user' },
        group: 'user',
        requiredPasswordReset: true,
      }),
    });
  });
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('user@example.com');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('input[type="password"]').fill('temporary-secret');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL('**/password-change');
}
