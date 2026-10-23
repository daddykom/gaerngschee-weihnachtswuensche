import { expect, test } from './support/test';

test.describe('Password reset route', () => {
  test('sets a new password with the reset token', async ({ page }) => {
    let requestBody: unknown;
    await page.route('http://localhost:8083/auth/password-reset', async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: '1', email: 'user@example.com', group: 'user' } }),
      });
    });

    await page.goto('/password-reset?token=reset-token&email=user%40example.com');
    await expect(page).toHaveURL(/\/password-reset$/);
    await expect(page.locator('input[autocomplete="username"]')).toHaveValue('user@example.com');
    await expect(page.locator('input[autocomplete="username"]')).toHaveAttribute('readonly', 'true');
    await page.locator('input[autocomplete="new-password"]').nth(0).fill('long-enough-secret');
    await page.locator('input[autocomplete="new-password"]').nth(1).fill('long-enough-secret');
    await page.getByRole('button', { name: 'Passwort setzen' }).click();

    await page.waitForURL('**/login');
    expect(requestBody).toEqual({ token: 'reset-token', password: 'long-enough-secret' });
  });
});
