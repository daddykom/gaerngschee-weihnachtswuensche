import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Login route accessibility', () => {
  test('exposes named login controls and keyboard focus order', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();

    const email = page.getByRole('textbox', { name: 'E-Mail-Adresse' });
    const submit = page.getByRole('button', { name: 'Weiter' });
    await expect(email).toBeVisible();
    await expect(submit).toBeVisible();

    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();
  });

  test('keeps the invalid-login message in an assertive alert', async ({ page }) => {
    await page.route('http://localhost:8083/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', details: {} } }),
      });
    });

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('admin@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByLabel('Passwort').fill('wrong-password');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    await expectTranslatedText(alert, 'app.auth.loginErrorTitle');
  });
});
