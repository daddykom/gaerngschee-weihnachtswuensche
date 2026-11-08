import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Root route', () => {
  test('shows the public campaign landing page', async ({ page }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_start_date', value: '2000-01-01' },
          { variableName: 'fulfiller_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_availability_status', value: 'open' },
        ]),
      });
    });

    await page.goto('/');
    await expect(page.locator('app-root')).toBeVisible();
    await expectTranslatedText(page.locator('h1'), 'app.home.title');
    await expectTranslatedText(page.locator('.home__lead'), 'app.home.lead');
    const submitLink = page.locator('a[href="/start"]');
    const fulfillLink = page.locator('a[href="/erfuellen"]');
    await expectTranslatedText(submitLink, 'app.home.submit.action');
    await expectTranslatedText(fulfillLink, 'app.home.fulfill.action');
    const faqPanels = page.locator('mat-expansion-panel');
    await expect(page.locator('.home-faq__section')).toHaveCount(2);
    await expect(faqPanels).toHaveCount(7);
    await faqPanels.nth(0).locator('mat-expansion-panel-header').click();
    await expect(faqPanels.nth(0).locator('.home-faq__answer')).toBeVisible();
    const loginLink = page.locator('a[href="/login"]');
    await expectTranslatedText(loginLink, 'app.home.login');

    await page.setViewportSize({ width: 390, height: 844 });
    const homeActions = page.locator('.home__choices a');
    await expect(homeActions).toHaveCount(3);
    await expect(homeActions.nth(0)).toHaveAttribute('href', '/start');
    await expectTranslatedText(homeActions.nth(1), 'app.home.login');
    await expect(homeActions.nth(2)).toHaveAttribute('href', '/erfuellen');
  });

  test('shows the campaign start date instead of the receive link before launch', async ({
    page,
  }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2999-01-01' },
          { variableName: 'campaign_end_date', value: '2999-12-31' },
          { variableName: 'fulfiller_start_date', value: '2000-01-01' },
          { variableName: 'fulfiller_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_availability_status', value: 'open' },
        ]),
      });
    });

    await page.goto('/');
    await expectTranslatedText(page.locator('main'), 'app.home.submit.notStarted');
    await expect(page.locator('a[href="/start"]')).toHaveCount(0);
  });

  test('shows logout for an authenticated user and returns home after logout', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'gaerngschee.auth',
        JSON.stringify({
          userId: 'admin-1',
          group: 'admin',
          fairgateUserExists: null,
          childrenCount: null,
          adultsCount: null,
          salutation: null,
        }),
      );
    });
    await page.route('http://localhost:8083/auth/session-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }),
      });
    });
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_start_date', value: '2000-01-01' },
          { variableName: 'fulfiller_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_availability_status', value: 'open' },
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
    await expectTranslatedText(page.locator('a[href="/login"]'), 'app.home.login');
  });
});
