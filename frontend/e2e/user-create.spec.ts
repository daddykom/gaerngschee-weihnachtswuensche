import { expect, Page, test } from './support/test';
import { expectTranslatedText } from './support/assertions';

test.describe('User creation route', () => {
  test('validates the email and creates a user', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('http://localhost:8083/admin/users', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        await route.continue();
      }
    });
    await page.getByRole('button', { name: 'Administrationsmenü öffnen' }).click();
    await page.getByRole('menuitem', { name: 'Benutzerverwaltung' }).click();
    await page.waitForURL('**/admin/users');
    await page.getByRole('link', { name: 'Benutzer erstellen' }).click();
    await page.waitForURL('**/admin/users/new');
    await page.getByRole('button', { name: 'Speichern' }).click();
     await expectTranslatedText(page.getByRole('alert'), 'app.admin.users.errors.email.required');

    await page.locator('input[type="email"]').fill('new@example.com');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Benutzer' }).click();
    await page.route('http://localhost:8083/admin/users', async (route) => {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ email: 'new@example.com', group: 'user' });
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
          user: { id: '3', email: 'new@example.com', group: 'user', required_password_reset: true },
          emailSentTo: 'new@example.com',
        }) });
      } else {
        await route.continue();
      }
    });
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.waitForURL('**/admin/users');
     await expectTranslatedText(page.getByRole('alert'), 'app.admin.users.created');
     await expectTranslatedText(page.getByRole('alert'), 'app.admin.users.emailSentTo');
  });
});

async function loginAsAdmin(page: Page): Promise<void> {
  await page.route('http://localhost:8083/auth/session-status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }) });
  });
  await page.route('http://localhost:8083/auth/login', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      user: { id: '1', email: 'admin@example.com', group: 'admin' },
      group: 'admin', requiredPasswordReset: false,
    }) });
  });
  await page.route('http://localhost:8083/admin/overview', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ year: 2026, recentDays: 14, orders: {}, categories: [] }) });
  });
  await page.route('http://localhost:8083/public/configuration', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@example.com');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('input[type="password"]').fill('secret');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL('**/admin/overview');
}
