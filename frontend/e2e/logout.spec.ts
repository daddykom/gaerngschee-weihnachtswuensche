import { expect, Page, test } from './support/test';

test.describe('Logout flow', () => {
  test('navigates to home after a successful backend logout', async ({ page }) => {
    await loginAsAdmin(page);
    let logoutCalled = false;
    await page.route('http://localhost:8083/auth/logout', async (route) => {
      logoutCalled = true;
      await route.fulfill({ status: 204 });
    });

    await page.getByRole('button', { name: 'Administrationsmenü öffnen' }).click();
    await page.getByRole('menuitem', { name: 'Abmelden' }).click();

    await page.waitForURL('**/');
    expect(logoutCalled).toBe(true);
  });

  test('navigates to home when the backend logout fails', async ({ page }) => {
    await loginAsAdmin(page);
    let logoutCalled = false;
    await page.route('http://localhost:8083/auth/logout', async (route) => {
      logoutCalled = true;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'LOGOUT_FAILED', details: {} },
        }),
      });
    });

    await page.getByRole('button', { name: 'Administrationsmenü öffnen' }).click();
    await page.getByRole('menuitem', { name: 'Abmelden' }).click();

    await page.waitForURL('**/');
    expect(logoutCalled).toBe(true);
  });
});

async function loginAsAdmin(page: Page): Promise<void> {
  await page.route('http://localhost:8083/auth/session-status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }) });
  });
  await page.route('http://localhost:8083/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: '1', email: 'admin@example.com', group: 'admin' },
          group: 'admin',
          requiredPasswordReset: false,
      }),
    });
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
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/admin/overview');
}
