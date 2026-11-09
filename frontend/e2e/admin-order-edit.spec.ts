import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
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
    await page.getByRole('combobox', { name: 'Neuer Status' }).click();
    await page.getByRole('option', { name: 'Freigegeben' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL('**/admin/orders/order-1/edit');

    expect(patchCount).toBe(0);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(patchCount).toBe(1);
  });

  test('changes the order status through the status select', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    let action: unknown;
    let status: unknown;
    await page.route('http://localhost:8083/admin/orders/order-1', async (route) => {
      const payload = route.request().postDataJSON();
      action = payload.action;
      status = payload.order.status;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order: { ...orderFixture(), status: 'definitive' },
          mailSent: false,
        }),
      });
    });

    await page.goto('/admin/overview');
    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await page.getByRole('combobox', { name: 'Neuer Status' }).click();
    await page.getByRole('option', { name: 'Definitiv' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page).toHaveURL(/\/admin\/overview$/);
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.overview.emailSentTitle');
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.overview.emailSent');
    expect(action).toBe('save');
    expect(status).toBe('definitive');
  });

  test('changes the order to changes requested with the status select', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    let action: unknown;
    let status: unknown;
    await page.route('http://localhost:8083/admin/orders/order-1', async (route) => {
      const payload = route.request().postDataJSON();
      action = payload.action;
      status = payload.order.status;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order: { ...orderFixture(), status: 'changes_requested' },
          mailSent: true,
        }),
      });
    });

    await page.goto('/admin/overview');
    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await page.getByRole('combobox', { name: 'Neuer Status' }).click();
    await page.getByRole('option', { name: 'Änderungen verlangt' }).click();
    await page.getByRole('textbox', { name: /Interne Bemerkung/ }).fill('Bitte nochmals prüfen');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(action).toBe('save');
    expect(status).toBe('changes_requested');
  });
});
