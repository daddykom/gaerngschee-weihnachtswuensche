import { expect, test } from './support/test';

test.describe('Imprint route', () => {
  test('renders the static imprint content', async ({ page }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/impressum');

    await expect(page.locator('h1')).toHaveText('Impressum');
    await expect(page.locator('.legal-page__content')).toContainText('Verein Gärngschee');
    await expect(page.getByRole('link', { name: 'info@gaerngschee.ch' })).toHaveAttribute('href', 'mailto:info@gaerngschee.ch');
    await expect(page.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
  });
});
