import { loginAsAdmin } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Admin email test route', () => {
  test('sends general and wish feedback with a review test email', async ({ page }) => {
    await loginAsAdmin(page);
    let sent: unknown;
    await page.route('http://localhost:8083/admin/email-test', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          json: {
            templates: [
              {
                id: 'order-confirmation-changes_requested',
                fields: [
                  { key: 'year', type: 'number', required: true },
                  { key: 'loginUrl', type: 'url', required: true },
                  { key: 'orderFeedback', type: 'textarea', required: false },
                  { key: 'wishNumber', type: 'text', required: false },
                  { key: 'wishTitle', type: 'text', required: false },
                  { key: 'wishFeedback', type: 'textarea', required: false },
                ],
              },
            ],
          },
        });
      } else {
        sent = route.request().postDataJSON();
        await route.fulfill({ json: { emailSentTo: 'review@example.com' } });
      }
    });
    await page.goto('/admin/email-test');
    await page.getByRole('textbox', { name: 'Empfänger-Adresse' }).fill('review@example.com');
    await page.getByRole('spinbutton', { name: 'Jahr', exact: true }).fill('2026');
    await page
      .getByRole('textbox', { name: 'Login-URL', exact: true })
      .fill('https://example.com/login');
    await page
      .getByRole('textbox', { name: /Rückmeldung zum Wunschzettel/ })
      .fill('Please review the family text');
    await page.getByRole('textbox', { name: 'Wunschnummer', exact: true }).fill('12-3');
    await page
      .getByRole('textbox', { name: 'Bearbeiteter Wunschtitel', exact: true })
      .fill('Edited coat title');
    await page
      .getByRole('textbox', { name: /Rückmeldung zum Wunsch \(/ })
      .fill('Please review the size');
    await page.getByRole('button', { name: 'Senden', exact: true }).click();
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.emailTest.sent');
    expect(sent).toEqual({
      recipient: 'review@example.com',
      template: 'order-confirmation-changes_requested',
      parameters: {
        year: '2026',
        loginUrl: 'https://example.com/login',
        orderFeedback: 'Please review the family text',
        wishNumber: '12-3',
        wishTitle: 'Edited coat title',
        wishFeedback: 'Please review the size',
      },
    });
  });

  test('requires and sends the edited wish title for a fulfiller reservation email', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    let sent: unknown;
    await page.route('http://localhost:8083/admin/email-test', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          json: {
            templates: [
              {
                id: 'fulfiller-reservation',
                fields: [
                  { key: 'loginUrl', type: 'url', required: true },
                  { key: 'wishNumber', type: 'text', required: true },
                  { key: 'wishTitle', type: 'text', required: true },
                  { key: 'wishDescription', type: 'textarea', required: true },
                ],
              },
            ],
          },
        });
      } else {
        sent = route.request().postDataJSON();
        await route.fulfill({ json: { emailSentTo: 'reservation@example.com' } });
      }
    });
    await page.goto('/admin/email-test');
    await page.getByRole('textbox', { name: 'Empfänger-Adresse' }).fill('reservation@example.com');
    await page
      .getByRole('textbox', { name: 'Login-URL', exact: true })
      .fill('https://example.com/confirm');
    await page.getByRole('textbox', { name: 'Wunschnummer', exact: true }).fill('12-1');
    await page
      .getByRole('textbox', { name: 'Bearbeiteter Wunschtitel', exact: true })
      .fill('Edited title');
    await page
      .getByRole('textbox', { name: 'Wunschbeschreibung', exact: true })
      .fill('Edited description');
    await page.getByRole('button', { name: 'Senden', exact: true }).click();
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.emailTest.sent');
    expect(sent).toEqual({
      recipient: 'reservation@example.com',
      template: 'fulfiller-reservation',
      parameters: {
        loginUrl: 'https://example.com/confirm',
        wishNumber: '12-1',
        wishTitle: 'Edited title',
        wishDescription: 'Edited description',
      },
    });
  });

  test('offers the pickup notification with optional date and multiline location parameters', async ({
    page,
  }) => {
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
                  { key: 'pickupDate', type: 'text', required: false },
                  { key: 'pickupLocation', type: 'textarea', required: false },
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
    await page.getByRole('textbox', { name: /Abholdatum und Zeit/ }).fill('Samstag, nachmittags');
    const location = page.getByRole('textbox', { name: /Abholort/ });
    expect(await location.evaluate((element) => element.tagName)).toBe('TEXTAREA');
    await location.fill('Testsaal\nTeststrasse 1');
    await page.getByRole('button', { name: 'Senden' }).click();
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.emailTest.sent');
    expect(sent).toEqual({
      recipient: 'pickup@example.com',
      template: 'order-ready-for-pickup',
      parameters: {
        year: '2026',
        orderNumber: '12',
        pickupDate: 'Samstag, nachmittags',
        pickupLocation: 'Testsaal\nTeststrasse 1',
      },
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
