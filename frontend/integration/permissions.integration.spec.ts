import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';
import { loginAsUser } from './support/user-login';

test.describe('Integration permissions', () => {
  test('denies a normal user access to the user list', async ({ page }) => {
    await loginAsUser(page);

    const response = await page.request.get('http://localhost:8082/admin/users', {
      headers: await authHeaders(page),
    });
    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: 'NOT_FOUND', details: [] } });
  });

  test('denies a normal user role and reset changes', async ({ page }) => {
    await loginAsUser(page);

    const response = await page.request.patch(
      'http://localhost:8082/admin/users/00000000-0000-4000-8000-000000000002',
      {
        headers: await authHeaders(page),
        data: {
          email: 'user@gaerngschee.ch',
          group: 'admin',
          required_password_reset: false,
        },
      },
    );
    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'NOT_FOUND', details: [] },
    });
  });

  test('rejects invalid and duplicate user data for an admin', async ({ page }) => {
    await loginAsAdmin(page);

    const invalidResponse = await page.request.post('http://localhost:8082/admin/users', {
      headers: await authHeaders(page),
      data: { email: 'invalid-email', group: 'user' },
    });
    expect(invalidResponse.status()).toBe(422);

    const duplicateResponse = await page.request.post('http://localhost:8082/admin/users', {
      headers: await authHeaders(page),
      data: { email: 'user@gaerngschee.ch', group: 'user' },
    });
    expect(duplicateResponse.status()).toBe(409);
    await expect(duplicateResponse.json()).resolves.toEqual({
      error: { code: 'EMAIL_ALREADY_REGISTERED', details: [] },
    });
  });
});
