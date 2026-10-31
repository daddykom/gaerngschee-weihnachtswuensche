import { expect, test } from '@playwright/test';
import { resetIntegrationRateLimits } from './support/auth-header';

test.describe('Integration login', () => {
  test.beforeEach(() => {
    resetIntegrationRateLimits();
  });

  test('logs in through the real backend', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@gaerngschee.ch');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('secret');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await page.waitForURL('**/admin/overview');
    await expect(page.locator('h1')).toHaveText('Admin-Übersicht');
  });

  test('rejects invalid credentials through the real backend', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@gaerngschee.ch');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('wrong-password');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(page.locator('.info-box')).toContainText('Anmeldung fehlgeschlagen');
  });
});
