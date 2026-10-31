import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expect, test } from './support/test';

test.describe('Admin order overview route', () => {
  test('opens an order for processing', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    await page.goto('/admin/overview');

    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await expect(page).toHaveURL(/\/admin\/orders\/order-1\/edit$/);
  });

  test('restores selected filters after browser back from order processing', async ({ page }) => {
    await loginAsAdmin(page);
    const requests: URL[] = [];
    await page.route('http://localhost:8083/admin/orders**', async (route) => {
      requests.push(new URL(route.request().url()));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: [orderFixture()],
          statuses: ['definitive'],
          categories: ['gift'],
        }),
      });
    });
    await page.goto('/admin/overview');

    const statusRemoveButtons = page.getByRole('button', { name: /Statusfilter entfernen/ });
    await statusRemoveButtons.nth(0).click();
    await statusRemoveButtons.nth(0).click();
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Definitiv' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Kategorie' }).click();
    await page.getByRole('option', { name: 'Geschenk' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('mat-chip-row')).toHaveCount(2);

    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await page.getByRole('button', { name: 'Abbrechen' }).first().click();
    await expect(page).toHaveURL(/\/admin\/overview$/);
    await expect(page.locator('mat-chip-row')).toHaveCount(2);

    const lastRequest = requests.at(-1);
    expect(lastRequest?.searchParams.getAll('status[]')).toEqual(['definitive']);
    expect(lastRequest?.searchParams.getAll('category[]')).toEqual(['gift']);
  });
});
