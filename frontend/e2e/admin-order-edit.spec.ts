import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expect, test } from './support/test';

test.describe('Admin order edit route', () => {
  test('uses browser back on cancel', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    await page.goto('/admin/overview');
    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await page.getByRole('button', { name: 'Abbrechen' }).first().click();

    await expect(page).toHaveURL(/\/admin\/overview$/);
  });

  test('saves the complete order after a wish decision', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    let patchCount = 0;
    await page.route('http://localhost:8083/admin/orders/order-1', async (route) => {
      patchCount += 1;
      expect(route.request().postDataJSON().action).toBe('save');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ order: orderFixture() }),
      });
    });

    await page.goto('/admin/overview');
    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await page.getByRole('link', { name: 'Ändern' }).first().click();
    await page.getByRole('button', { name: 'Wunsch akzeptieren' }).click();
    await page.waitForURL('**/admin/orders/order-1/edit');

    expect(patchCount).toBe(0);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(patchCount).toBe(1);
  });

  test('releases only after all wishes are accepted', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    let action: unknown;
    await page.route('http://localhost:8083/admin/orders/order-1', async (route) => {
      action = route.request().postDataJSON().action;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ order: { ...orderFixture(), status: 'definitive' } }),
      });
    });

    await page.goto('/admin/overview');
    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    const release = page.getByRole('button', { name: 'Freigeben' });
    await expect(release).toBeDisabled();
    await page.getByRole('link', { name: 'Ändern' }).first().click();
    await page.getByRole('button', { name: 'Wunsch akzeptieren' }).click();
    await page.waitForURL('**/admin/orders/order-1/edit');
    await expect(release).toBeEnabled();
    await release.click();

    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(action).toBe('release');
  });

  test('rejects the whole order with an order-level reason', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    let action: unknown;
    await page.route('http://localhost:8083/admin/orders/order-1', async (route) => {
      action = route.request().postDataJSON().action;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ order: { ...orderFixture(), status: 'changes_requested' } }),
      });
    });

    await page.goto('/admin/overview');
    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await page.getByRole('textbox', { name: /Interne Bemerkung/ }).fill('Bitte nochmals prüfen');
    await page.getByRole('button', { name: 'Zurückweisen' }).click();

    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(action).toBe('rejectOrder');
  });
});
