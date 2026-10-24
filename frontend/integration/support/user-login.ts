import { Page } from '@playwright/test';
import { resetIntegrationRateLimits } from './auth-header';

export async function loginAsUser(page: Page): Promise<void> {
  resetIntegrationRateLimits();
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('user@gaerngschee.ch');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('input[type="password"]').fill('secret');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL('**/admin/overview');
}
