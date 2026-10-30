import { expect, test } from './support/test';
import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';

test.describe('Admin order overview route', () => {
  test('opens an order for processing', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    await page.goto('/admin/overview');

    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await expect(page).toHaveURL(/\/admin\/orders\/order-1\/edit$/);
  });
});
