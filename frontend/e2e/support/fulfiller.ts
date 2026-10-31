import { type Page } from './test';

export async function loginAsFulfiller(page: Page): Promise<void> {
  await page.route('http://localhost:8083/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'fulfiller-1', email: 'fulfiller@example.com', group: 'wunscherfueller' },
        group: 'wunscherfueller',
        requiredPasswordReset: false,
      }),
    });
  });
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('fulfiller@example.com');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('input[type="password"]').fill('secret');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL('**/erfuellen');
}
