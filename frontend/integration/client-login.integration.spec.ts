import { expect, test } from '@playwright/test';
import { issueRegistrationToken } from './support/registration-token';

test.describe('Integration client login', () => {
  test('consumes a registration token and opens the order page', async ({ page }) => {
    const email = `client+fair1-${Date.now()}@example.com`;
    const token = issueRegistrationToken(email);

    await page.goto(`/client-login?token=${encodeURIComponent(token)}`);
    await page.waitForURL('**/bestellung');
    await expect(page.getByRole('heading', { name: 'Deine Bestellung' })).toBeVisible();
  });

  test('rejects an already consumed registration token', async ({ page }) => {
    const email = `consumed+fair1-${Date.now()}@example.com`;
    const token = issueRegistrationToken(email);

    const response = await page.request.post('http://localhost:8082/auth/registration-login', {
      data: { token },
    });
    expect(response.status()).toBe(200);

    await page.goto(`/client-login?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/start$/);
    await expect(page.locator('.info-box--error')).toContainText(
      'Der Anmeldelink ist ungültig oder abgelaufen. Bitte fordere auf der Startseite einen neuen Link an.',
    );
  });

  test('rejects a missing registration token', async ({ page }) => {
    await page.goto('/client-login');
    await expect(page).toHaveURL(/\/start$/);
    await expect(page.locator('.info-box--error')).toContainText(
      'Der Anmeldelink ist ungültig oder abgelaufen. Bitte fordere auf der Startseite einen neuen Link an.',
    );
  });

  test('counts only eligible children from Fairgate data', async ({ page }) => {
    const email = `summary+partial-child-${Date.now()}@example.com`;
    const token = issueRegistrationToken(email);

    const response = await page.request.post('http://localhost:8082/auth/registration-login', {
      data: { token },
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.fairgateUserExists).toBe(true);
    expect(data.childrenCount).toBe(1);
  });

  test('ignores the Fairgate validity date when the membership is present', async ({ page }) => {
    const email = `invalid+invalid-date-${Date.now()}@example.com`;
    const token = issueRegistrationToken(email);

    const response = await page.request.post('http://localhost:8082/auth/registration-login', {
      data: { token },
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.fairgateUserExists).toBe(true);
    expect(data.childrenCount).toBe(1);
  });
});
