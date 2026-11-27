import { loginAsAdmin, mockOrders, orderFixture } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Admin order item edit route', () => {
  const imageUrl = 'http://localhost:8083/admin/orders/order-1/items/item-1/image';
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
    'base64',
  );

  for (const width of [390, 1280]) {
    test(`selects an image with a keyboard-accessible picker and retains it without uploading at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAsAdmin(page);
      await mockOrders(page, orderFixture());
      let mutations = 0;
      page.on('request', (request) => {
        if (
          request.url().includes('/admin/orders') &&
          ['POST', 'PATCH', 'DELETE'].includes(request.method())
        )
          mutations++;
      });
      await page.goto('/admin/overview');
      await page.locator('a[href="/admin/orders/order-1/edit"]').click();
      await page.getByRole('link', { name: 'Ändern' }).first().click();
      const section = page.locator('app-order-item-image-editor');
      await expectTranslatedText(section.getByRole('heading'), 'app.admin.itemImage.title');
      const picker = section.getByRole('button', { name: 'Bild auswählen' });
      await picker.focus();
      const chooser = page.waitForEvent('filechooser');
      await picker.press('Enter');
      await (await chooser).setFiles({ name: 'gift.png', mimeType: 'image/png', buffer: png });
      const preview = section.getByRole('img');
      await expect(preview).toBeVisible();
      await expect
        .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBe(1);
      expect(
        await section.evaluate((element) => element.getBoundingClientRect().right),
      ).toBeLessThanOrEqual(width);
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await page.waitForURL('**/admin/orders/order-1/edit');
      await page.getByRole('link', { name: 'Ändern' }).first().click();
      await expect(section.getByRole('img')).toBeVisible();
      expect(mutations).toBe(0);
    });
  }

  test('previews stored images, stages dropped replacements and supports removal and undo', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    await page.route(`${imageUrl}/metadata`, (route) =>
      route.fulfill({
        json: {
          revision: 4,
          image: {
            id: 'image-1',
            mimeType: 'image/png',
            width: 1,
            height: 1,
            byteSize: png.length,
            updatedAt: '',
          },
        },
      }),
    );
    await page.route(imageUrl, (route) => route.fulfill({ contentType: 'image/png', body: png }));
    await page.goto('/admin/overview');
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('link', { name: 'Ändern' }).first().click();
    const section = page.locator('app-order-item-image-editor');
    await expect(section.getByRole('img')).toBeVisible();
    const transfer = await page.evaluateHandle((base64) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], 'dropped.png', {
          type: 'image/png',
        }),
      );
      return transfer;
    }, png.toString('base64'));
    await section.getByTestId('image-drop-zone').dispatchEvent('drop', { dataTransfer: transfer });
    await expect(section.locator('.image-file-name')).toHaveText('dropped.png');
    await section.getByRole('button', { name: 'Bild entfernen', exact: true }).click();
    await expect(section.getByRole('img')).toHaveCount(0);
    await expectTranslatedText(section.locator('p').last(), 'app.admin.itemImage.removalPending');
    await section.getByRole('button', { name: 'Bildänderung verwerfen' }).click();
    await expect(section.getByRole('img')).toBeVisible();
    await expect(section.locator('.image-file-name')).toHaveCount(0);
  });

  test('releases failed image loading, retries and shows file errors at the field', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await mockOrders(page, orderFixture());
    let failed = true;
    await page.route(`${imageUrl}/metadata`, (route) =>
      route.fulfill(
        failed
          ? { status: 500, json: { error: { code: 'REQUEST_FAILED' } } }
          : { json: { revision: 0, image: null } },
      ),
    );
    await page.goto('/admin/overview');
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('link', { name: 'Ändern' }).first().click();
    await expectTranslatedText(page.getByRole('alert').first(), 'app.admin.itemImage.loadError');
    await expect(page.getByRole('textbox', { name: 'Aktueller Wunschtitel' })).toBeEditable();
    failed = false;
    await page.getByRole('button', { name: 'Wunschbild erneut laden' }).click();
    const section = page.locator('app-order-item-image-editor');
    await expect(section.locator('.control-error')).toHaveCount(0);
    await section.locator('input[type=file]').setInputFiles({
      name: 'unsafe.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    });
    await expectTranslatedText(
      section.locator('.control-error'),
      'app.admin.itemImage.errors.fileType',
    );
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(section.getByRole('button', { name: 'Bild auswählen' })).toBeFocused();
    await expect(page).toHaveURL(/\/edit\/item\/item-1$/);
    await section.getByRole('button', { name: 'Bildänderung verwerfen' }).click();
    await expect(section.locator('.control-error')).toHaveCount(0);
  });

  test('shows original and edited title and description separately and retains the internal message', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const order = orderFixture();
    const item = (order['items'] as Record<string, unknown>[])[0];
    await mockOrders(page, {
      ...order,
      items: [
        {
          ...item,
          originalTitle: 'Original title',
          currentTitle: 'Edited title',
          personalMessage: 'Internal team note',
        },
      ],
    });
    await page.goto('/admin/overview');
    await page.locator('a[href="/admin/orders/order-1/edit"]').click();
    await page.getByRole('link', { name: 'Ändern' }).first().click();

    await expect(page.locator('.original-text').nth(0)).toHaveText('Original title');
    await expect(page.locator('.original-text').nth(1)).toHaveText('Originalbeschreibung');
    await expect(page.getByRole('textbox', { name: 'Aktueller Wunschtitel' })).toHaveValue(
      'Edited title',
    );
    await expect(page.getByRole('textbox', { name: 'Aktuelle Wunschbeschreibung' })).toHaveValue(
      'Aktuelle Beschreibung',
    );
    const message = page.getByRole('textbox', {
      name: /Persönliche Nachricht an das Gärngschee-Team/,
    });
    await expect(message).toHaveValue('Internal team note');
    await expectTranslatedText(
      message.locator('xpath=ancestor::mat-form-field').locator('mat-hint'),
      'app.order.items.personalMessageHint',
    );
  });

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
