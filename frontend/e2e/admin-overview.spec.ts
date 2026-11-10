import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Admin order overview route', () => {
  test('offers and submits every order status including draft', async ({ page }) => {
    await loginAsAdmin(page);
    const statuses = [
      'draft',
      'released',
      'in_review',
      'changes_requested',
      'definitive',
      'ready_for_pickup',
      'completed',
    ];
    let requestedStatuses: string[] = [];
    await page.route('http://localhost:8083/admin/orders**', async (route) => {
      requestedStatuses = new URL(route.request().url()).searchParams.getAll('status[]');
      await route.fulfill({
        json: {
          orders: [{ ...orderFixture(), status: 'draft' }],
          statuses: requestedStatuses,
          categories: [],
        },
      });
    });
    await page.goto('/admin/overview');
    const removeButtons = page.getByRole('button', { name: /Statusfilter entfernen/ });
    await removeButtons.first().click();
    await removeButtons.first().click();
    await page.getByRole('combobox', { name: 'Status', exact: true }).click();
    const options = page.getByRole('option');
    await expect(options).toHaveCount(statuses.length);
    for (const [index, status] of statuses.entries()) {
      const option = options.nth(index);
      await expectTranslatedText(option, `app.admin.overview.statuses.${status}`);
      await option.click();
      await expect(option).toHaveAttribute('aria-selected', 'true');
    }
    await page.keyboard.press('Escape');
    await expect.poll(() => requestedStatuses).toEqual(statuses);
    await expect(page.locator('mat-chip-row')).toHaveCount(statuses.length);
  });

  test('opens an order for processing', async ({ page }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    await page.goto('/admin/overview');

    const processLink = page.locator('a[href="/admin/orders/order-1/edit"]');
    await expectTranslatedText(processLink, 'app.admin.overview.process');
    await processLink.click();
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

    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('button', { name: 'Abbrechen' }).first().click();
    await expect(page).toHaveURL(/\/admin\/overview$/);
    await expect(page.locator('mat-chip-row')).toHaveCount(2);

    const lastRequest = requests.at(-1);
    expect(lastRequest?.searchParams.getAll('status[]')).toEqual(['definitive']);
    expect(lastRequest?.searchParams.getAll('category[]')).toEqual(['gift']);
  });
});
