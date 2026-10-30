import { expect, test } from './support/test';
import { expectTranslatedText } from './support/assertions';
import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';

test.describe('Admin order item edit route', () => {
  test('requires a reason before rejecting a wish', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    await page.goto('/admin/overview');
    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await page.getByRole('link', { name: 'Ändern' }).first().click();
    await page.getByRole('button', { name: 'Wunsch zurückweisen' }).click();

    await expectTranslatedText(
      page.locator('mat-form-field').nth(2).locator('.control-error'),
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ order: orderFixture() }) });
    });
    await page.goto('/admin/overview');
    await page.getByRole('link', { name: 'Bestellung verarbeiten' }).click();
    await page.getByRole('link', { name: 'Ändern' }).first().click();
    await page.getByRole('textbox', { name: 'Begründung der Zurückweisung' }).fill('Nicht erfüllbar');
    await page.getByRole('button', { name: 'Wunsch zurückweisen' }).click();

    await page.waitForURL('**/admin/orders/order-1/edit');
    expect(patchCount).toBe(0);
  });
});
