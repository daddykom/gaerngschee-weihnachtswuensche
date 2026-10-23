import { expect, test } from '@playwright/test';

test.describe('Privacy route', () => {
  test('renders the static privacy content', async ({ page }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/datenschutz');

    await expect(page.locator('h1')).toHaveText('Datenschutz – Gärngschee Weihnachtswünsche');
    await expect(page.locator('.legal-page__content')).toContainText('Prüfung bei Fairgate');
    await expect(page.locator('.legal-page__content')).toContainText('Statistik mit Matomo');
    await expect(page.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/datenschutz');
  });
});
