import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { loginAsAdmin, openUserManagement } from './support/admin-login';
import { authHeaders } from './support/auth-header';
import { issueRegistrationToken } from './support/registration-token';

test.describe('Integration user administration', () => {
  test('edits a client, changes its group, sends a reset link and deletes its orders with the account', async ({
    page,
  }) => {
    const email = `managed+fair1-${Date.now()}@example.com`;
    const token = issueRegistrationToken(email);
    const registration = await page.request.post('http://localhost:8082/auth/registration-login', {
      data: { token },
    });
    expect(registration.status()).toBe(200);
    const userId = (await registration.json()).user.id;
    const draft = await page.request.post('http://localhost:8082/client/order', {
      headers: await authHeaders(page),
      data: {
        mode: 'draft',
        adultsCount: 2,
        childrenCount: 3,
        password: 'long-enough-password',
        passwordConfirmation: 'long-enough-password',
        text: 'My situation',
        items: [
          {
            category: 'gift',
            personType: 'adult',
            personIndex: 1,
            title: 'Coat',
            description: 'A warm coat',
          },
        ],
      },
    });
    expect(draft.status()).toBe(200);
    const orderId = (await draft.json()).order.id;
    await page.context().clearCookies();
    await loginAsAdmin(page);
    await openUserManagement(page);
    await page.getByRole('searchbox').fill(email);
    const row = page.getByRole('listitem').filter({ hasText: email });
    await row.getByRole('link', { name: 'Bearbeiten' }).click();
    await expect(page.locator('input[type="email"]')).toHaveValue(email);
    await page.getByRole('combobox').click();
    await expect(page.getByRole('option')).toHaveCount(4);
    await page.getByRole('option', { name: 'Wunscherfüller', exact: true }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL('**/admin/users');
    await expectTranslatedText(row, 'app.admin.users.groups.wunscherfueller');
    const reset = page.waitForResponse((response) =>
      response.url().endsWith(`/admin/users/${userId}/password-reset`),
    );
    await row.getByRole('button', { name: 'Passwort senden' }).click();
    expect((await reset).status()).toBe(200);
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.users.passwordResetSent');
    await row.getByRole('button', { name: 'Löschen' }).click();
    const dialog = page.getByRole('dialog');
    await expectTranslatedText(dialog, 'app.admin.users.deleteMessage');
    const deletion = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/admin/users/${userId}`) &&
        response.request().method() === 'DELETE',
    );
    await dialog.getByRole('button', { name: 'Löschen', exact: true }).click();
    const deletedResponse = await deletion;
    expect(deletedResponse.status()).toBe(200);
    expect(await deletedResponse.json()).toMatchObject({ deleted: true });
    await expect(row).toHaveCount(0);
    const detail = await page.request.get(`http://localhost:8082/admin/users/${userId}`);
    expect(detail.status()).toBe(404);
    const ordersResponse = await page.request.get(
      'http://localhost:8082/admin/orders?status[]=draft',
    );
    expect(ordersResponse.status()).toBe(200);
    const orders = (await ordersResponse.json()).orders as { id: string }[];
    expect(orders.some((order) => order.id === orderId)).toBe(false);
  });

  test('includes client accounts and filters the real user list locally', async ({ page }) => {
    const email = `user-filter+fair1-${Date.now()}@example.com`;
    const token = issueRegistrationToken(email);
    const registration = await page.request.post('http://localhost:8082/auth/registration-login', {
      data: { token },
    });
    expect(registration.status()).toBe(200);
    await page.context().clearCookies();
    await loginAsAdmin(page);
    await openUserManagement(page);
    await page.getByRole('searchbox').fill(email.toUpperCase());
    const rows = page.getByRole('listitem');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(email);
    await expect(rows.first().getByRole('button', { name: 'Passwort senden' })).toBeVisible();
    await expect(rows.first().getByRole('link', { name: 'Bearbeiten' })).toBeVisible();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Benutzer', exact: true }).click();
    await expect(rows).toHaveCount(0);
    await expectTranslatedText(page.getByRole('list'), 'app.admin.users.filters.noResults');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Wunschbesteller', exact: true }).click();
    await expect(rows).toHaveCount(1);
  });

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
