import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Client login route', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('exchanges the registration token and navigates to the order page', async ({ page }) => {
    await page.route('http://localhost:8083/auth/session-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }),
      });
    });
    await page.route('http://localhost:8083/auth/registration-login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'client-1', email: 'client@example.com', group: 'wunschbesteller' },
          group: 'wunschbesteller',
          requiredPasswordReset: true,
          firstAccess: true,
          fairgateUserExists: true,
          childrenCount: 2,
          adultsCount: 2,
          salutation: 'Hallo',
        }),
      });
    });

    await page.goto('/client-login?token=registration-token');
    await page.waitForURL('**/bestellung');
    await expect(page.locator('.app-header__email')).toHaveText('client@example.com');
    await expectTranslatedText(page.locator('h1'), 'app.bestellung.pageTitle');
  });

  test('shows an error when the registration token is invalid', async ({ page }) => {
    await page.route('http://localhost:8083/auth/registration-login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INVALID_REGISTRATION_TOKEN', details: {} },
        }),
      });
    });

    await page.goto('/client-login?token=invalid-token');
    await expect(page).toHaveURL(/\/start$/);
    await expectTranslatedText(page.getByRole('alert'), 'app.anmeldung.errorTitle');
    await expectTranslatedText(page.getByRole('alert'), 'app.anmeldung.registrationTokenError');
  });
});
