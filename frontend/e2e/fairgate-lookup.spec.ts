import { expect, test } from './support/test';
import { expectTranslatedText } from './support/assertions';

test.describe('Fairgate lookup route', () => {
  test('loads the Fairgate response for the email query parameter', async ({ page }) => {
    await page.route('http://localhost:8083/auth/session-status', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }) });
    });
    await page.route('http://localhost:8083/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin-1', email: 'admin@example.com', group: 'admin' },
          group: 'admin',
          requiredPasswordReset: false,
        }),
      });
    });
    await page.route('http://localhost:8083/admin/fairgate-lookup**', async (route) => {
      expect(new URL(route.request().url()).searchParams.get('membership')).toBe('Aktivmitglied');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          email: 'person@example.com',
          fairgate: { success: true, data: { contactId: 42 } },
        }),
      });
    });

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('secret');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin/overview');
    await expectTranslatedText(page.locator('h1'), 'app.admin.overview.title');

    await page.goto('/admin/fairgate-lookup?email=person%40example.com&membership=Aktivmitglied');
    await page.waitForURL('**/admin/fairgate-lookup**');

    await expectTranslatedText(page.locator('p').first(), 'app.admin.fairgateLookup.description');
    await expect(page.locator('.fairgate-lookup-result')).toContainText('person@example.com');
    await expect(page.locator('.fairgate-lookup-result')).toContainText('42');
  });

  test('redirects to not-found when the backend hides the route', async ({ page }) => {
    await page.route('http://localhost:8083/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin-1', email: 'admin@example.com', group: 'admin' },
          group: 'admin',
          requiredPasswordReset: false,
        }),
      });
    });
    await page.route('http://localhost:8083/admin/fairgate-lookup**', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', details: [] } }) });
    });

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('secret');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin/overview');
    await page.goto('/admin/fairgate-lookup?email=person%40example.com');
    await page.waitForURL('**/not-found');
    await expectTranslatedText(page.locator('h1'), 'app.notFound.pageTitle');
  });
});
