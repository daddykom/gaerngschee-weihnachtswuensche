import { expect, test } from '@playwright/test';
import { loginAsAdmin, openUserManagement } from './support/admin-login';

test.describe('Integration user administration', () => {
  test('offers only admin and user groups', async ({ page }) => {
    await loginAsAdmin(page);
    await openUserManagement(page);
    await page.getByRole('link', { name: 'Benutzer erstellen' }).click();
    await page.waitForURL('**/admin/users/new');
    await page.getByRole('combobox').click();
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(page.getByRole('option', { name: 'Administrator' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Benutzer' })).toBeVisible();
  });

  test('loads, creates, updates and deletes a user through the real backend', async ({ page }) => {
    const email = `integration-user-${Date.now()}@example.com`;

    await loginAsAdmin(page);
    await openUserManagement(page);
    await expect(page.locator('main').getByText('admin@gaerngschee.ch')).toBeVisible();

    await page.getByRole('link', { name: 'Benutzer erstellen' }).click();
    await page.waitForURL('**/admin/users/new');
    await page.locator('input[type="email"]').fill(email);
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Benutzer' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.waitForURL('**/admin/users');
    const createdUser = page.getByRole('listitem').filter({ hasText: email });
    await expect(createdUser).toBeVisible();
    await createdUser.getByRole('link', { name: 'Bearbeiten' }).click();
    await page.waitForURL('**/admin/users/*');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Administrator' }).click();
    await page.getByRole('checkbox').uncheck();
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.waitForURL('**/admin/users');
    const updatedUser = page.getByRole('listitem').filter({ hasText: email });
    await expect(updatedUser).toContainText('Administrator');
    await expect(updatedUser).not.toContainText('Passwort muss neu gesetzt werden');

    await updatedUser.getByRole('button', { name: 'Löschen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();

    await expect(page.getByText(email)).not.toBeVisible();
    await expect(page.getByText('Der Benutzer wurde gelöscht.')).toBeVisible();
  });
});
