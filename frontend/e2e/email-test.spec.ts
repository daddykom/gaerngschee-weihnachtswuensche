import { loginAsAdmin } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Admin email test route', () => {
  test('offers the pickup notification and submits its order number and year', async ({ page }) => {
    await loginAsAdmin(page);
    let sent: unknown;
    await page.route('http://localhost:8083/admin/email-test', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          json: {
            templates: [
              { id: 'client-order', fields: [{ key: 'loginUrl', type: 'url', required: true }] },
              {
                id: 'order-ready-for-pickup',
                fields: [
                  { key: 'year', type: 'number', required: true },
                  { key: 'orderNumber', type: 'number', required: true },
                ],
              },
            ],
          },
        });
      } else {
        sent = route.request().postDataJSON();
        await route.fulfill({ json: { emailSentTo: 'pickup@example.com' } });
      }
    });
    await page.goto('/admin/email-test');
    await page.getByRole('combobox', { name: 'E-Mail', exact: true }).click();
    const option = page.getByRole('option').filter({ hasText: 'Abholbenachrichtigung' });
    await expectTranslatedText(option, 'app.admin.emailTest.templates.order-ready-for-pickup');
    await option.click();
    await page.getByRole('textbox', { name: 'Empfänger-Adresse' }).fill('pickup@example.com');
    await page.getByRole('spinbutton', { name: 'Jahr', exact: true }).fill('2026');
    await page.getByRole('spinbutton', { name: 'Zettelnummer', exact: true }).fill('12');
    await page.getByRole('button', { name: 'Senden' }).click();
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.emailTest.sent');
    expect(sent).toEqual({
      recipient: 'pickup@example.com',
      template: 'order-ready-for-pickup',
      parameters: { year: '2026', orderNumber: '12' },
    });
  });

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
