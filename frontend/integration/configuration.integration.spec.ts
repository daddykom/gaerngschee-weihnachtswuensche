import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './support/admin-login';

test.describe('Integration configuration', () => {
  test('loads, saves and reloads a configuration value', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/configuration');

    const input = page.getByLabel('fairgate_test_email');
    await expect(input).toHaveValue('isabelle.joss@gaerngschee.ch');
    await input.fill('integration.changed@example.com');
    await page.getByRole('button', { name: 'Konfiguration speichern' }).click();
    await expect(page.getByText('Die Konfiguration wurde gespeichert.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('fairgate_test_email')).toHaveValue(
      'integration.changed@example.com',
    );

    await page.getByLabel('fairgate_test_email').fill('isabelle.joss@gaerngschee.ch');
    await page.getByRole('button', { name: 'Konfiguration speichern' }).click();
    await expect(page.getByText('Die Konfiguration wurde gespeichert.')).toBeVisible();
  });
});
