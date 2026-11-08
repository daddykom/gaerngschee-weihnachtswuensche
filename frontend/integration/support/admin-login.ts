import { Page } from '@playwright/test';
import { resetIntegrationRateLimits } from './auth-header';

export async function loginAsAdmin(page: Page): Promise<void> {
  resetIntegrationRateLimits();
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@gaerngschee.ch');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('input[type="password"]').fill('secret');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL('**/admin/overview');
}

export async function openUserManagement(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Administrationsmenü öffnen' }).click();
  await page.getByRole('menuitem', { name: 'Benutzerverwaltung' }).click();
  await page.waitForURL('**/admin/users');
}
