import { expect, test } from './support/test';
import { expectTranslatedText } from './support/assertions';

test.describe('Root route', () => {
  test('shows the public campaign landing page', async ({ page }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'donation_url', value: 'https://donate.example/weihnachtswuensche' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
        ]),
      });
    });

    await page.goto('/');
    await expect(page.locator('app-root')).toBeVisible();
     await expectTranslatedText(page.locator('h1'), 'app.home.title');
     await expectTranslatedText(page.locator('.home__lead'), 'app.home.lead');
    await expect(page.getByRole('link', { name: 'Jetzt spenden' })).toHaveAttribute('href', 'https://donate.example/weihnachtswuensche');
    await expect(page.getByRole('link', { name: 'Weihnachtswünsche anfragen' })).toHaveAttribute('href', '/start');
    await expect(page.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login');
  });

  test('shows the campaign start date instead of the receive link before launch', async ({ page }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2999-01-01' },
          { variableName: 'campaign_end_date', value: '2999-12-31' },
        ]),
      });
    });

    await page.goto('/');
     await expectTranslatedText(page.locator('main'), 'app.home.receive.notStarted');
    await expect(page.getByRole('link', { name: 'Weihnachtswünsche anfragen' })).toHaveCount(0);
  });

  test('shows logout for an authenticated user and returns home after logout', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('gaerngschee.auth', JSON.stringify({
        userId: 'admin-1',
        group: 'admin',
        fairgateUserExists: null,
        childrenCount: null,
        adultsCount: null,
        salutation: null,
      }));
    });
    await page.route('http://localhost:8083/auth/session-status', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }) });
    });
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
        ]),
      });
    });
    await page.route('http://localhost:8083/auth/logout', async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await page.waitForURL('**/');
    await expect(page.getByRole('link', { name: 'Anmelden' })).toBeVisible();
  });
});
