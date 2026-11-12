import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Admin order overview route', () => {
  for (const width of [320, 390, 768, 1040, 1280]) {
    test(`keeps filters, order details and actions inside the content at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAsAdmin(page);
      const email = 'charley+fair1+very-long-registration-address@example.collins.ch';
      await mockOrders(page, { ...orderFixture(), requesterEmail: email });
      await page.goto('/admin/overview');
      const table = page.getByRole('table');
      await expect(table).toContainText(email);
      const action = table.locator('a[href="/admin/orders/order-1/edit"]');
      await expect(action).toBeVisible();
      const summary = page.getByRole('status');
      await expectTranslatedText(summary, 'app.admin.overview.filteredOrderCount');
      const searchBounds = await page.locator('mat-form-field').first().boundingBox();
      const summaryBounds = await summary.boundingBox();
      expect(searchBounds).not.toBeNull();
      expect(summaryBounds).not.toBeNull();
      if (width < 768) {
        expect(summaryBounds!.y).toBeGreaterThanOrEqual(searchBounds!.y + searchBounds!.height);
      } else {
        expect(summaryBounds!.x).toBeGreaterThanOrEqual(searchBounds!.x + searchBounds!.width);
      }

      const overflow = await page.evaluate(() => {
        const content = document.querySelector('app-admin-overview');
        const bounds = content?.getBoundingClientRect();
        if (!bounds) throw new Error('Overview content not found');
        return {
          page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          elements: Array.from(
            content.querySelectorAll(
              'mat-form-field, [role="status"], .order-list, .order-list__row, .order-list__cell, .order-list__cell a',
            ),
          )
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.width > 0 &&
                (rect.left < bounds.left - 1 ||
                  rect.right > bounds.right + 1 ||
                  element.scrollWidth > element.clientWidth + 1)
              );
            })
            .map((element) => element.className),
        };
      });
      expect(overflow).toEqual({ page: false, elements: [] });

      const rows = table.getByRole('row');
      if (width >= 1040) {
        const headerCells = rows.first().getByRole('columnheader');
        const cells = rows.last().getByRole('cell');
        for (let index = 0; index < 5; index++) {
          const header = await headerCells.nth(index).boundingBox();
          const cell = await cells.nth(index).boundingBox();
          expect(header).not.toBeNull();
          expect(cell).not.toBeNull();
          expect(Math.abs(header!.x - cell!.x)).toBeLessThanOrEqual(1);
        }
      }
    });
  }

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

  test('filters email substrings locally and restores the search after browser back', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    let listRequests = 0;
    await page.route('http://localhost:8083/admin/orders**', async (route) => {
      if (new URL(route.request().url()).pathname !== '/admin/orders') {
        await route.fulfill({ json: { order: orderFixture() } });
        return;
      }
      listRequests++;
      await route.fulfill({
        json: {
          orders: [
            {
              ...orderFixture(),
              requesterEmail: 'Anna@Example.ch',
              items: [{ id: 'item-1' }, { id: 'item-2' }],
            },
            { ...orderFixture(), id: 'order-2', requesterEmail: 'other@example.org' },
          ],
          statuses: ['released', 'in_review'],
          categories: [],
        },
      });
    });
    await page.goto('/admin/overview');
    const search = page.getByRole('searchbox');
    await expectTranslatedText(
      page.locator('mat-label').first(),
      'app.admin.overview.filters.email',
    );
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(3);
    const summary = page.getByRole('status');
    await expectTranslatedText(
      summary.locator('span').first(),
      'app.admin.overview.filteredOrderCount',
    );
    await expectTranslatedText(summary.locator('span').last(), 'app.admin.overview.itemCount');
    await expect(summary).toContainText('2');
    await expect(summary.locator('span').last()).toContainText('3');
    const requestsBeforeSearch = listRequests;
    await search.fill('NA@EXAMPLE');
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
    await expect(summary.locator('span').first()).toContainText('1');
    await expect(summary.locator('span').last()).toContainText('2');
    await expect(page.getByRole('table')).toContainText('Anna@Example.ch');
    await expect(page.getByRole('table')).not.toContainText('other@example.org');
    expect(listRequests).toBe(requestsBeforeSearch);
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('button', { name: 'Abbrechen' }).first().click();
    await expect(page).toHaveURL(/\/admin\/overview$/);
    await expect(search).toHaveValue('NA@EXAMPLE');
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
    await search.fill('missing');
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(1);
    await expect(summary.locator('span').first()).toContainText('0');
    await expect(summary.locator('span').last()).toContainText('0');
    await expectTranslatedText(page.getByRole('table').locator('p'), 'app.admin.overview.empty');
    await search.clear();
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(3);
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
