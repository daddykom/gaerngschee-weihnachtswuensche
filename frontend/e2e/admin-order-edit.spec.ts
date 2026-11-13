import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Admin order edit route', () => {
  for (const numbers of [
    { orderNumber: 12, itemNumber: 3, expected: '12-3' },
    { orderNumber: null, itemNumber: 3, expected: '—' },
    { orderNumber: 12, itemNumber: null, expected: '—' },
  ]) {
    test(`shows the wish number ${numbers.orderNumber}-${numbers.itemNumber} when editing the order`, async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const order = orderFixture();
      const item = (order['items'] as Record<string, unknown>[])[0];
      await mockOrders(page, {
        ...order,
        orderNumber: numbers.orderNumber,
        items: [{ ...item, itemNumber: numbers.itemNumber }],
      });
      await page.goto('/admin/overview');
      await page.locator('a[href="/admin/orders/order-1/edit"]').click();

      const number = page.locator('.item-editor__category > span').first();
      await expectTranslatedText(number, 'app.admin.overview.wishNumber');
      await expect(number).toContainText(numbers.expected);
      await expect(number).not.toContainText('null');
    });
  }

  test('uses browser back on cancel', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    await page.goto('/admin/overview');
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
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
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
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
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('combobox', { name: 'Neuer Status' }).click();
    await page.getByRole('option', { name: 'Definitiv' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page).toHaveURL(/\/admin\/overview$/);
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.overview.emailSentTitle');
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.overview.emailSent');
    expect(action).toBe('save');
    expect(status).toBe('definitive');
  });

  test('keeps the current order status when no status change is selected', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    let status: unknown;
    await page.route('http://localhost:8083/admin/orders/order-1', async (route) => {
      status = route.request().postDataJSON().order.status;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ order: orderFixture(), mailSent: false }),
      });
    });

    await page.goto('/admin/overview');
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL(/\/admin\/overview$/);

    expect(status).toBe('released');
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
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('combobox', { name: 'Neuer Status' }).click();
    await page.getByRole('option', { name: 'Änderungen verlangt' }).click();
    await page.getByRole('textbox', { name: /Interne Bemerkung/ }).fill('Bitte nochmals prüfen');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(action).toBe('save');
    expect(status).toBe('changes_requested');
  });
});
