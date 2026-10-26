import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Login route', () => {
  test.beforeEach(async ({ page }) => {
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
    await page.route('http://localhost:8083/admin/orders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders: [], statuses: ['released', 'in_review'], categories: [] }),
      });
    });
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('logs in and navigates to the admin overview', async ({ page }) => {
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
    await page.route('http://localhost:8083/auth/logout', async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto('/login');
    await expectTranslatedText(page.locator('h1'), 'app.login.pageTitle');
    await page.locator('input[type="email"]').fill('admin@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('secret');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin/overview');
    await expect(page.locator('.app-header__email')).toHaveText('admin@example.com');
    await expectTranslatedText(page.locator('h1'), 'app.admin.overview.title');
    await expect(page.getByRole('button', { name: 'Administrationsmenü öffnen' })).toBeVisible();

    await page.getByRole('button', { name: 'Administrationsmenü öffnen' }).click();
    await expect(page.getByRole('menuitem', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Startseite' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Admin-Übersicht' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Abmelden' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForURL('**/');
    await expect(page.locator('.header-logo-link')).toHaveAttribute('href', '/');

    await page.locator('.header-logo-link').click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole('button', { name: 'Administrationsmenü öffnen' }).click();
    await page.getByRole('menuitem', { name: 'Abmelden' }).click();
    await page.waitForURL('**/');

    await page.goto('/admin/overview');
    await page.waitForURL('**/not-found');
    await expectTranslatedText(page.locator('h1'), 'app.notFound.pageTitle');
  });

  test('shows a translated error for invalid credentials', async ({ page }) => {
    await page.route('http://localhost:8083/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INVALID_CREDENTIALS', details: {} },
        }),
      });
    });

    await page.goto('/login');
    await expectTranslatedText(page.locator('h1'), 'app.login.pageTitle');
    await page.locator('input[type="email"]').fill('admin@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('wrong-password');
    await page.locator('button[type="submit"]').click();

    await expectTranslatedText(page.locator('.info-box'), 'app.auth.loginErrorTitle');
    await expectTranslatedText(page.locator('.info-box'), 'app.auth.errors.INVALID_CREDENTIALS');
  });

  test('warns before the session expires', async ({ page }) => {
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
    await page.route('http://localhost:8083/auth/session-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
          secondsRemaining: 30,
        }),
      });
    });

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('secret');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await page.waitForURL('**/admin/overview');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectTranslatedText(page.getByRole('dialog'), 'app.auth.sessionExpiredWarningTitle');
    await expect(page.getByRole('button', { name: 'Angemeldet bleiben' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
  });

  test('redirects users with a required password reset', async ({ page }) => {
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
    await expectTranslatedText(page.locator('h1'), 'app.passwordChange.pageTitle');
  });

  test('redirects clients to the success page with a success message', async ({ page }) => {
    await page.route('http://localhost:8083/auth/email-check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'email_sent', processingYear: 2026 }),
      });
    });

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('client@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();

    await page.waitForURL('**/start/success');
    await expectTranslatedText(page.locator('.info-box'), 'app.anmeldung.emailSentTitle');
    await expectTranslatedText(page.locator('.info-box'), 'app.login.orderInfo');
  });
});
