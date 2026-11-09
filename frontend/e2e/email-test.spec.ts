import { loginAsAdmin } from './support/admin-orders';
import { expect, test } from './support/test';

test.describe('Admin email test route', () => {
  test('shows template-specific parameters and sends the test email', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('http://localhost:8083/admin/email-test', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            templates: [
              {
                id: 'client-order',
                fields: [
                  { key: 'loginUrl', type: 'url', required: true },
                  { key: 'campaignYear', type: 'number', required: true },
                ],
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ emailSentTo: 'test@example.com' }),
      });
    });

    await page.goto('/admin/email-test');
    await expect(page.getByRole('heading', { name: 'Email Test' })).toBeVisible();
    await expect(page.locator('input').nth(1)).toBeVisible();
    await expect(page.locator('input').nth(2)).toBeVisible();

    await page.locator('input').nth(0).fill('test@example.com');
    await page.locator('input').nth(1).fill('https://example.com/login');
    await page.locator('input').nth(2).fill('2026');
    await page.getByRole('button', { name: 'Senden' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Die E-Mail wurde an test@example.com gesendet.',
    );
  });
});
