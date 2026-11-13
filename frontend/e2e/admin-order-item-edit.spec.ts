import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Admin order item edit route', () => {
  for (const numbers of [
    { orderNumber: 12, itemNumber: 3, expected: '12-3' },
    { orderNumber: null, itemNumber: 3, expected: '—' },
    { orderNumber: 12, itemNumber: null, expected: '—' },
  ]) {
    test(`shows the wish number ${numbers.orderNumber}-${numbers.itemNumber} when editing the wish`, async ({
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
      await page.getByRole('link', { name: 'Ändern' }).first().click();

      const number = page
        .locator('p')
        .filter({ has: page.locator('strong') })
        .first();
      await expectTranslatedText(number, 'app.admin.overview.wishNumber');
      await expect(number).toContainText(numbers.expected);
      await expect(number).not.toContainText('null');
    });
  }

  test('requires a reason before rejecting a wish', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    await page.goto('/admin/overview');
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('link', { name: 'Ändern' }).first().click();
    await page.getByRole('combobox', { name: 'Neuer Status' }).click();
    await page.getByRole('option', { name: 'Änderung erforderlich' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expectTranslatedText(
      page
        .getByRole('textbox', { name: 'Begründung der Zurückweisung' })
        .locator('xpath=ancestor::mat-form-field')
        .locator('.control-error'),
      'app.admin.overview.errors.rejectionReason.required',
    );
    await expect(page).toHaveURL(/\/admin\/orders\/order-1\/edit\/item\/item-1$/);
  });

  test('keeps a rejected wish in the draft without sending a request', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    let patchCount = 0;
    await page.route('http://localhost:8083/admin/orders/order-1', async (route) => {
      patchCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ order: orderFixture() }),
      });
    });
    await page.goto('/admin/overview');
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('link', { name: 'Ändern' }).first().click();
    await page
      .getByRole('textbox', { name: 'Begründung der Zurückweisung' })
      .fill('Nicht erfüllbar');
    await page.getByRole('combobox', { name: 'Neuer Status' }).click();
    await page.getByRole('option', { name: 'Änderung erforderlich' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.waitForURL('**/admin/orders/order-1/edit');
    expect(patchCount).toBe(0);
  });
});
