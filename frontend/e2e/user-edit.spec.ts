import { expectTranslatedText } from './support/assertions';
import { expect, Page, test } from './support/test';

test.describe('User edit route', () => {
  test('admin loads and updates a user including the reset flag', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('http://localhost:8083/admin/users', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: '2', email: 'user@example.com', group: 'user', required_password_reset: false },
          ]),
        });
      }
    });
    await page.route('http://localhost:8083/admin/users/2', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: '2',
              email: 'user@example.com',
              group: 'user',
              required_password_reset: false,
            },
          }),
        });
        return;
      }
      expect(route.request().method()).toBe('PATCH');
      expect(route.request().postDataJSON()).toEqual({
        email: 'changed@example.com',
        group: 'admin',
        required_password_reset: true,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '2',
            email: 'changed@example.com',
            group: 'admin',
            required_password_reset: true,
          },
          emailSentTo: 'changed@example.com',
        }),
      });
    });

    await page.getByRole('button', { name: 'Administrationsmenü öffnen' }).click();
    await page.getByRole('menuitem', { name: 'Benutzerverwaltung' }).click();
    await page.waitForURL('**/admin/users');
    await page.getByRole('link', { name: 'Bearbeiten' }).click();
    await page.waitForURL('**/admin/users/2');
    await expect(page.locator('input[type="email"]')).toHaveValue('user@example.com');
    await page.locator('input[type="email"]').fill('changed@example.com');
    await page.getByRole('combobox').click();
    await expect(page.getByRole('option')).toHaveCount(2);
    await page.getByRole('option', { name: 'Administrator' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.waitForURL('**/admin/users');
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.users.updated');
  });

  test('normal user cannot access administration pages', async ({ page }) => {
    await loginAsUser(page);
    await expect(page.getByRole('button', { name: 'Administrationsmenü öffnen' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/not-found$/);
  });

  test('cancel navigates back without saving', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('http://localhost:8083/admin/users', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: '2', email: 'user@example.com', group: 'user', required_password_reset: false },
          ]),
        });
      }
    });
    await page.route('http://localhost:8083/admin/users/2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '2',
            email: 'user@example.com',
            group: 'user',
            required_password_reset: false,
          },
        }),
      });
    });
    await page.getByRole('button', { name: 'Administrationsmenü öffnen' }).click();
    await page.getByRole('menuitem', { name: 'Benutzerverwaltung' }).click();
    await page.waitForURL('**/admin/users');
    await page.getByRole('link', { name: 'Bearbeiten' }).click();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await page.waitForURL('**/admin/users');
  });
});

async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, 'admin@example.com', 'admin', '1');
}

async function loginAsUser(page: Page): Promise<void> {
  await login(page, 'user@example.com', 'user', '2');
}

async function login(
  page: Page,
  email: string,
  group: 'admin' | 'user',
  id: string,
): Promise<void> {
  await page.route('http://localhost:8083/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id, email, group },
        group,
        requiredPasswordReset: false,
      }),
    });
  });
  await page.route('http://localhost:8083/auth/session-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }),
    });
  });
  await page.route('http://localhost:8083/admin/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ year: 2026, recentDays: 14, orders: {}, categories: [] }),
    });
  });
  await page.route('http://localhost:8083/public/configuration', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('input[type="password"]').fill('secret');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(group === 'admin' ? '**/admin/overview' : '**/not-found');
}
