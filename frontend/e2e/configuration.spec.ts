import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Configuration route', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost:8083/auth/session-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }),
      });
    });
  });

  test('loads and saves editable configuration values', async ({ page }) => {
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
    await page.route('http://localhost:8083/admin/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'config-1',
            variableName: 'SITE_TITLE',
            value: 'Weihnachtswünsche',
            description: 'Titel',
            accessGroup: ['admin'],
            updateGroup: ['admin'],
            label: 'Seitentitel',
            canUpdate: true,
          },
        ]),
      });
    });
    await page.route('http://localhost:8083/admin/configuration/config-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'config-1', variableName: 'SITE_TITLE', value: 'Neuer Titel' }),
      });
    });
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/admin/configuration');

    await expect(page.getByText('Seitentitel')).toBeVisible();
    await page.locator('input').fill('Neuer Titel');
    await page.getByRole('button', { name: 'Konfiguration speichern' }).click();
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.configuration.saved');
  });

  test('shows the pattern error for an invalid campaign start date after blur', async ({
    page,
  }) => {
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
    await page.route('http://localhost:8083/admin/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'config-1',
            variableName: 'campaign_start_date',
            value: '2026-09-01',
            description: 'Startdatum',
            accessGroup: ['admin'],
            updateGroup: ['admin'],
            label: 'Startdatum',
            pattern: '\\d{4}-\\d{2}-\\d{2}',
            canUpdate: true,
          },
        ]),
      });
    });

    await page.goto('/admin/configuration');
    const input = page.locator('input').first();
    await input.fill('2026-09-0t');
    await input.blur();

    const field = input.locator('xpath=ancestor::mat-form-field');
    await expectTranslatedText(
      field.locator('.control-error'),
      'app.admin.configuration.errors.pattern',
    );
  });
});
