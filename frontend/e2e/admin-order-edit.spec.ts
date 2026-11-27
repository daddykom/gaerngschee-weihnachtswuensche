import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test, type Page } from './support/test';

const imageUrl = 'http://localhost:8083/admin/orders/order-1/items/item-1/image';
const imageResult = {
  revision: 1,
  image: { id: 'image-1', mimeType: 'image/png', width: 1, height: 1, byteSize: 68, updatedAt: '' },
};

async function stageImage(page: Page): Promise<void> {
  await loginAsAdmin(page);
  const order = orderFixture();
  await mockOrders(page, order);
  await page.route('http://localhost:8083/admin/orders/order-1', (route) =>
    route.fulfill({ json: { order, mailSent: false } }),
  );
  await page.goto('/admin/overview');
  await page.locator('a[href="/admin/orders/order-1/edit"]').click();
  await page.getByRole('link', { name: 'Ändern', exact: true }).first().click();
  await page.locator('app-order-item-image-editor input[type=file]').setInputFiles({
    name: 'gift.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.waitForURL('**/admin/orders/order-1/edit');
}

test.describe('Admin order edit route', () => {
  test('keeps global upload progress across navigation, warns before reload and goes directly to success', async ({
    page,
  }) => {
    await stageImage(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(imageUrl, async (route) => {
      await gate;
      await route.fulfill({ json: imageResult });
    });
    try {
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      const notice = page.getByTestId('image-transfer-notices');
      const job = notice.locator('[data-transfer-id]');
      await expect(job).toHaveAttribute('data-status', 'uploading');
      await expectTranslatedText(job.locator('strong'), 'app.imageTransfers.uploading');
      await expect(job.locator('strong')).toContainText(/\d+ %/);
      const warning = page.waitForEvent('dialog');
      const reload = page.evaluate(() => window.location.reload()).catch(() => undefined);
      const dialog = await warning;
      expect(dialog.type()).toBe('beforeunload');
      await dialog.dismiss();
      await reload;
      await page.getByRole('link', { name: 'Home', exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(job).toHaveAttribute('data-status', 'uploading');
      release();
      await expect(job).toHaveAttribute('data-status', 'success');
      await expectTranslatedText(job.locator('strong'), 'app.imageTransfers.success');
      await expect(job.getByRole('link')).toHaveCount(0);
      expect(
        await page.evaluate(() => {
          const event = new Event('beforeunload', { cancelable: true });
          window.dispatchEvent(event);
          return event.defaultPrevented;
        }),
      ).toBe(false);
      await job.getByRole('button', { name: 'Meldung schliessen' }).click();
      await expect(notice).toHaveCount(0);
    } finally {
      release();
    }
  });

  test('shows image failures globally and retries only the image request, never the wish save', async ({
    page,
  }) => {
    await stageImage(page);
    let patches = 0;
    let uploads = 0;
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().endsWith('/admin/orders/order-1'))
        patches++;
    });
    await page.route(imageUrl, async (route) => {
      uploads++;
      await route.fulfill(
        uploads === 1
          ? { status: 500, json: { error: { code: 'IMAGE_UPLOAD_FAILED' } } }
          : { json: imageResult },
      );
    });
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    const job = page.getByTestId('image-transfer-notices').locator('[data-transfer-id]');
    await expect(job).toHaveAttribute('data-status', 'error');
    await expectTranslatedText(job.getByRole('alert'), 'app.imageTransfers.errors.failed');
    await job.getByRole('button', { name: 'Bildänderung erneut versuchen' }).click();
    await expect(job).toHaveAttribute('data-status', 'success');
    expect(uploads).toBe(2);
    expect(patches).toBe(1);
  });

  test('explains revision conflicts without offering an unsafe retry', async ({ page }) => {
    await stageImage(page);
    await page.route(imageUrl, (route) =>
      route.fulfill({
        status: 409,
        json: { error: { code: 'IMAGE_REVISION_CONFLICT' } },
      }),
    );
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    const job = page.getByTestId('image-transfer-notices').locator('[data-transfer-id]');
    await expect(job).toHaveAttribute('data-status', 'error');
    await expectTranslatedText(job.locator('p'), 'app.imageTransfers.errors.conflict');
    await expect(job.getByRole('button', { name: 'Bildänderung erneut versuchen' })).toHaveCount(0);
    await expect(job.getByRole('link')).toHaveAttribute(
      'href',
      '/admin/orders/order-1/edit/item/item-1',
    );
  });
  test('preserves general feedback, status and all edited wishes across editor navigation', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const order = orderFixture();
    const first = (order['items'] as Record<string, unknown>[])[0];
    await mockOrders(page, { ...order, items: [first, { ...first, id: 'item-2' }] });
    let saved: Record<string, unknown> | undefined;
    await page.route('http://localhost:8083/admin/orders/order-1', async (route) => {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { order: orderFixture(), mailSent: true } });
    });
    await page.goto('/admin/overview');
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page
      .getByRole('textbox', { name: 'Aktueller Order-Text', exact: true })
      .fill('Edited family text');
    await page
      .getByRole('textbox', { name: /Rückmeldung zum Wunschzettel/ })
      .fill('Please review the family text');
    await page.getByRole('combobox', { name: 'Neuer Status', exact: true }).click();
    await page.getByRole('option', { name: 'Änderungen verlangt' }).click();
    await page.getByRole('link', { name: 'Ändern', exact: true }).first().click();
    await page
      .getByRole('textbox', { name: 'Aktueller Wunschtitel', exact: true })
      .fill('Edited first title');
    await page
      .getByRole('textbox', { name: /Begründung der Zurückweisung/ })
      .fill('Please review the first wish');
    await page.getByRole('combobox', { name: 'Neuer Status', exact: true }).click();
    await page.getByRole('option', { name: 'Änderung erforderlich' }).click();
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await page.waitForURL('**/admin/orders/order-1/edit');
    await expect(page.getByRole('textbox', { name: /Rückmeldung zum Wunschzettel/ })).toHaveValue(
      'Please review the family text',
    );
    await expect(
      page.getByRole('textbox', { name: 'Aktueller Order-Text', exact: true }),
    ).toHaveValue('Edited family text');

    await page.getByRole('link', { name: 'Ändern', exact: true }).nth(1).click();
    await page
      .getByRole('textbox', { name: 'Aktueller Wunschtitel', exact: true })
      .fill('Edited second title');
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await page.waitForURL('**/admin/orders/order-1/edit');
    expect(saved).toBeUndefined();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(saved).toMatchObject({
      order: {
        currentText: 'Edited family text',
        adminNotes: 'Please review the family text',
        status: 'changes_requested',
      },
      items: [
        expect.objectContaining({
          id: 'item-1',
          currentTitle: 'Edited first title',
          adminNotes: 'Please review the first wish',
          publicationStatus: 'rejected',
        }),
        expect.objectContaining({ id: 'item-2', currentTitle: 'Edited second title' }),
      ],
    });
  });

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
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
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
          mailSent: true,
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
    await page
      .getByRole('textbox', { name: /Rückmeldung zum Wunschzettel/ })
      .fill('Bitte nochmals prüfen');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(action).toBe('save');
    expect(status).toBe('changes_requested');
  });
});
