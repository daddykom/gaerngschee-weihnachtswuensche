import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';
import { loginAsUser } from './support/user-login';

test.describe('Integration admin edge cases', () => {
  test('hides admin resources from unauthenticated requests', async ({ page }) => {
    const response = await page.request.get('http://localhost:8082/admin/users');

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'SESSION_EXPIRED', details: [] },
    });
  });

  test('denies configuration changes for a normal user', async ({ page }) => {
    await loginAsUser(page);

    const response = await page.request.patch(
      'http://localhost:8082/admin/configuration/00000000-0000-4000-8000-000000000010',
      {
        headers: await authHeaders(page),
        data: { value: 'not-authorized@example.com' },
      },
    );

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: { code: 'FORBIDDEN', details: [] } });
  });

  test('allows an admin to change a user email', async ({ page }) => {
    await loginAsAdmin(page);
    const headers = await authHeaders(page);
    const originalEmail = `email-change-${Date.now()}@example.com`;
    const changedEmail = `email-changed-${Date.now()}@example.com`;

    const createResponse = await page.request.post('http://localhost:8082/admin/users', {
      headers,
      data: { email: originalEmail, group: 'user' },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as { user: { id: string } };

    const updateResponse = await page.request.patch(
      `http://localhost:8082/admin/users/${created.user.id}`,
      {
        headers,
        data: {
          email: changedEmail,
          group: 'user',
          required_password_reset: true,
        },
      },
    );
    expect(updateResponse.status()).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      user: { email: changedEmail, group: 'user', required_password_reset: 1 },
      emailSentTo: changedEmail,
    });

    const deleteResponse = await page.request.delete(
      `http://localhost:8082/admin/users/${created.user.id}`,
      { headers },
    );
    expect(deleteResponse.status()).toBe(200);
  });
});
