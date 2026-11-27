import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Fulfillment route', () => {
  for (const width of [390, 1280]) {
    test(`fits portrait, landscape and square wish images into the same frame with safe fallbacks at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = [
        [480, 120],
        [120, 480],
        [200, 200],
      ];
      const images = await page.evaluate(
        (sizes) =>
          sizes.map(([width, height]) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d')!.fillRect(0, 0, width, height);
            return canvas.toDataURL('image/png').split(',')[1];
          }),
        dimensions,
      );
      let failedRequests = 0;
      await page.route('http://localhost:8083/public/fulfiller/wishes/**', (route) => {
        const index = Number(route.request().url().split('/').pop());
        if (index === 4) {
          failedRequests++;
          return route.fulfill({ status: 404, json: { error: { code: 'IMAGE_NOT_FOUND' } } });
        }
        return route.fulfill({
          contentType: 'image/png',
          body: Buffer.from(images[index], 'base64'),
        });
      });
      await page.route('http://localhost:8083/public/fulfiller/orders**', (route) =>
        route.fulfill({
          json: {
            orders: [
              {
                id: 'order-1',
                year: 2026,
                orderNumber: 12,
                currentText: null,
                items: [0, 1, 2, 3, 4].map((index) => ({
                  id: `wish-${index}`,
                  itemNumber: index + 1,
                  wishNumber: `12-${index + 1}`,
                  title: `Image fixture ${index}`,
                  category: 'gift',
                  currentDescription: 'An image fixture',
                  giftLink: 'https://example.com/gift',
                  fulfillmentStatus: 'available',
                  reservedAt: null,
                  reservationExpiresAt: null,
                  imagePath:
                    index === 3 ? null : `/public/fulfiller/wishes/wish-${index}/images/${index}`,
                })),
              },
            ],
          },
        }),
      );
      await page.route('http://localhost:8083/public/fulfiller/availability-version', (route) =>
        route.fulfill({ json: { version: 0 } }),
      );
      await page.goto('/erfuellen');
      const pictures = page.locator('.wish-entry__image');
      await expect(pictures).toHaveCount(5);
      await expect(page.locator('.fulfillment-order')).toHaveCSS(
        'background-color',
        'rgb(245, 182, 211)',
      );
      for (const wish of await page.locator('.wish-entry').all()) {
        await expect(wish).toHaveCSS('background-color', 'rgb(255, 255, 255)');
        await expect(wish.locator('a')).toHaveCSS('color', 'rgb(227, 6, 20)');
        await expect(wish.locator('a')).toHaveCSS('text-decoration-line', 'underline');
      }
      for (const field of await page.locator('.mat-mdc-text-field-wrapper').all()) {
        await expect(field).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      }
      for (let index = 0; index < 5; index++) {
        const image = pictures.nth(index);
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
          .toBeGreaterThan(0);
        if (index >= 3) await expect(image).toHaveAttribute('src', '/images/wish-gift.jpg');
        else
          await expect(image).toHaveAttribute(
            'src',
            `http://localhost:8083/public/fulfiller/wishes/wish-${index}/images/${index}`,
          );
        const geometry = await image.evaluate((element: HTMLImageElement) => {
          const image = element.getBoundingClientRect();
          const card = element.closest('.wish-entry')!.getBoundingClientRect();
          return {
            ratio: image.width / image.height,
            fit: getComputedStyle(element).objectFit,
            position: getComputedStyle(element).objectPosition,
            naturalRatio: element.naturalWidth / element.naturalHeight,
            radius: parseFloat(getComputedStyle(element).borderRadius),
            inset: parseFloat(getComputedStyle(document.documentElement).fontSize),
            top: image.top - card.top,
            left: image.left - card.left,
            right: card.right - image.right,
          };
        });
        expect(geometry.ratio).toBeCloseTo(16 / 9, 1);
        expect(geometry.fit).toBe('cover');
        expect(geometry.position).toBe('50% 50%');
        expect(geometry.radius).toBeCloseTo(geometry.inset / 2);
        for (const inset of [geometry.top, geometry.left, geometry.right]) {
          expect(inset).toBeCloseTo(geometry.inset, 1);
        }
        if (index < 3)
          expect(geometry.naturalRatio).toBeCloseTo(dimensions[index][0] / dimensions[index][1]);
      }
      expect(failedRequests).toBe(1);
    });
  }

  test('offers an update dialog when a new build is detected', async ({ page }) => {
    const baseline = await (await page.request.get('/build-info.json')).json();
    let changed = false;
    await page.route('http://localhost:8083/public/fulfiller/orders**', (route) =>
      route.fulfill({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-App-Build',
          'X-App-Build': changed ? 'new-test-build' : baseline.buildId,
        },
        json: { orders: [] },
      }),
    );
    await page.route('http://localhost:8083/public/fulfiller/wish-statuses', (route) =>
      route.fulfill({ json: { items: [] } }),
    );
    await page.route('http://localhost:8083/public/fulfiller/availability-version', (route) =>
      route.fulfill({ json: { version: 0 } }),
    );

    await page.goto('/erfuellen');
    await expectTranslatedText(page.locator('h1'), 'app.fulfiller.pageTitle');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    changed = true;
    await page.locator('input[type="search"]').fill('Holz');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectTranslatedText(dialog.getByRole('heading'), 'app.update.dialog.title');
    await dialog.getByRole('button', { name: 'Später', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('app-update-notice')).toBeVisible();
    await expect(page.locator('.app-footer__version')).toContainText(baseline.appVersion);
  });

  for (const width of [390, 1280]) {
    test(`keeps orders full width and stacks variable-height wishes in reading order at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('http://localhost:8083/public/fulfiller/orders**', async (route) => {
        await route.fulfill({
          json: {
            orders: [1, 2, 3].map((index) => ({
              id: `order-${index}`,
              year: 2026,
              orderNumber: index,
              currentText: 'Anonymisierte Familieninformation',
              items: [1, 2, 3, 4, 5, 6].map((itemNumber) => ({
                id: `item-${index}-${itemNumber}`,
                itemNumber,
                wishNumber: `${index}-${itemNumber}`,
                title: `Test wish ${index}-${itemNumber}`,
                category: 'gift',
                currentDescription: Array.from(
                  { length: 1 + (itemNumber % 3) * 2 },
                  () => 'A wish description for the responsive layout test',
                ).join('\n'),
                fulfillmentStatus: 'available',
                reservedAt: null,
                reservationExpiresAt: null,
              })),
            })),
          },
        });
      });
      await page.route('http://localhost:8083/public/fulfiller/wish-statuses', async (route) => {
        await route.fulfill({ json: { items: [] } });
      });
      await page.route(
        'http://localhost:8083/public/fulfiller/availability-version',
        async (route) => {
          await route.fulfill({ json: { version: 0 } });
        },
      );

      await page.goto('/erfuellen');
      const cards = page.locator('.fulfillment-order');
      await expect(cards).toHaveCount(3);
      await expect(cards.first().locator('mat-card-content > .gl-stack > strong')).toHaveText(
        'Familieninformation',
      );
      await expect(cards.first().locator('mat-card-content > .gl-stack > strong')).toHaveCSS(
        'font-weight',
        '500',
      );
      await expect(cards.first().locator('mat-card-content > .gl-stack > p')).toHaveCSS(
        'color',
        'rgb(89, 89, 89)',
      );
      const radius = await page.evaluate(
        () => `${parseFloat(getComputedStyle(document.documentElement).fontSize)}px`,
      );
      await expect(cards.first()).toHaveCSS('border-radius', radius);
      await expect(cards.locator('mat-card-subtitle')).toHaveCount(0);
      const spacing = `${parseFloat(radius) / 2}px`;
      await expect(cards.first().locator('mat-card-title')).toHaveCSS('margin-bottom', spacing);
      await expect(cards.first().locator('mat-card-content')).toHaveCSS('row-gap', spacing);
      await expect(cards.first().locator('mat-card-content > .gl-stack')).toHaveCSS(
        'row-gap',
        spacing,
      );
      await expect(cards.first().locator('mat-card-content > .gl-stack > p')).toHaveCSS(
        'margin-top',
        '0px',
      );
      const padding = radius;
      for (const side of ['top', 'right', 'bottom', 'left']) {
        await expect(cards.first()).toHaveCSS(`padding-${side}`, padding);
        await expect(cards.first().locator('mat-card-header')).toHaveCSS(`padding-${side}`, '0px');
        await expect(cards.first().locator('mat-card-content')).toHaveCSS(`padding-${side}`, '0px');
      }
      const firstOrder = await cards.nth(0).boundingBox();
      const secondOrder = await cards.nth(1).boundingBox();
      const orderList = await cards.nth(0).locator('..').boundingBox();
      expect(firstOrder).not.toBeNull();
      expect(secondOrder).not.toBeNull();
      expect(orderList).not.toBeNull();
      expect(Math.abs(firstOrder!.width - orderList!.width)).toBeLessThan(1);
      expect(Math.abs(firstOrder!.x - secondOrder!.x)).toBeLessThan(1);
      expect(secondOrder!.y).toBeGreaterThan(firstOrder!.y + firstOrder!.height);

      const wishes = cards.first().locator('.wish-entry');
      await expect(wishes).toHaveCount(6);
      await expect(wishes.first()).toHaveCSS('border-radius', radius);
      for (const card of [cards.first(), wishes.first()]) {
        await expect(card).not.toHaveCSS('box-shadow', 'none');
        for (const side of ['top', 'right', 'bottom', 'left']) {
          await expect(card).toHaveCSS(`border-${side}-width`, '0px');
        }
      }
      for (const side of ['top', 'right', 'bottom', 'left']) {
        await expect(wishes.first()).toHaveCSS(`padding-${side}`, '0px');
        await expect(wishes.first().locator('.wish-entry__body')).toHaveCSS(
          `padding-${side}`,
          padding,
        );
      }
      await expect(page.locator('.wish-entry__image')).toHaveCount(18);
      const image = wishes.first().locator('.wish-entry__image');
      await expect(image).toHaveAttribute('src', '/images/wish-gift.jpg');
      await expect(image).toHaveAttribute('alt', '');
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0);
      await expect(wishes.first()).toHaveCSS('overflow', 'hidden');
      const imageBounds = await image.boundingBox();
      const wishBounds = await wishes.first().boundingBox();
      expect(imageBounds).not.toBeNull();
      expect(wishBounds).not.toBeNull();
      expect(imageBounds!.x - wishBounds!.x).toBeCloseTo(parseFloat(padding), 1);
      expect(imageBounds!.y - wishBounds!.y).toBeCloseTo(parseFloat(padding), 1);
      expect(wishBounds!.width - imageBounds!.width).toBeCloseTo(2 * parseFloat(padding), 1);
      await expect(image).toHaveCSS('border-radius', spacing);
      const bounds = await wishes.evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      const gap = await cards
        .first()
        .locator('.gl-columns')
        .evaluate((element) => parseFloat(getComputedStyle(element).columnGap));
      const columns = [...new Set(bounds.map((bounds) => Math.round(bounds.x)))];
      expect(columns).toHaveLength(width === 1280 ? 2 : 1);
      expect(new Set(bounds.map((bounds) => Math.round(bounds.height))).size).toBeGreaterThan(1);
      let columnChanges = 0;
      for (let index = 1; index < bounds.length; index++) {
        const previous = bounds[index - 1];
        const current = bounds[index];
        expect(Math.abs(current.width - previous.width)).toBeLessThan(1);
        if (Math.abs(current.x - previous.x) < 1) {
          expect(Math.abs(current.y - previous.y - previous.height - gap)).toBeLessThan(1);
        } else {
          columnChanges++;
          expect(current.x).toBeGreaterThan(previous.x);
          expect(Math.abs(current.y - bounds[0].y)).toBeLessThan(1);
          expect(Math.abs(current.x - previous.x - previous.width - gap)).toBeLessThan(1);
        }
      }
      expect(columnChanges).toBe(width === 1280 ? 1 : 0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }

  test('shows wishes grouped by definitive order and reserves one wish', async ({ page }) => {
    const requests: URL[] = [];
    await page.route('http://localhost:8083/public/fulfiller/orders**', async (route) => {
      requests.push(new URL(route.request().url()));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: [
            {
              id: 'order-1',
              year: 2026,
              orderNumber: 12,
              currentText: 'Anonymisierte Familieninformation',
              items: [
                {
                  id: 'item-1',
                  itemNumber: 1,
                  wishNumber: '12-1',
                  title: 'Bauklötze',
                  category: 'gift',
                  currentDescription: 'Bunte Holzbausteine zum Bauen',
                  giftLink: 'https://example.com/building-blocks',
                  fulfillmentStatus: 'available',
                  reservedAt: null,
                  reservationExpiresAt: null,
                },
              ],
            },
          ],
        }),
      });
    });
    await page.route('http://localhost:8083/public/fulfiller/wish-statuses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });
    await page.route(
      'http://localhost:8083/public/fulfiller/availability-version',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ version: 0 }),
        });
      },
    );
    await page.route('http://localhost:8083/public/fulfiller-reservation-start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sent: true,
          itemId: 'item-1',
          reservationExpiresAt: '2026-10-31T12:10:00Z',
        }),
      });
    });

    await page.goto('/erfuellen');
    const searchControl = page
      .locator('mat-form-field')
      .filter({ has: page.locator('input[type="search"]') })
      .locator('.mat-mdc-text-field-wrapper');
    const categoryControl = page
      .locator('mat-form-field')
      .filter({ has: page.getByRole('combobox') })
      .locator('.mat-mdc-text-field-wrapper');
    await expect(searchControl).toBeVisible();
    await expect(categoryControl).toBeVisible();
    await expect
      .poll(async () => {
        const searchBounds = await searchControl.boundingBox();
        const categoryBounds = await categoryControl.boundingBox();
        return Math.abs((searchBounds?.height ?? 0) - (categoryBounds?.height ?? 0));
      })
      .toBeLessThan(2);
    await expectTranslatedText(page.locator('h1'), 'app.fulfiller.pageTitle');
    await expect(page.getByRole('heading', { name: 'Bauklötze' })).toBeVisible();
    await expect(page.locator('.wish-entry')).toContainText('Bunte Holzbausteine zum Bauen');
    await expect(page.locator('.wish-entry a')).toHaveAttribute(
      'href',
      'https://example.com/building-blocks',
    );
    await expectTranslatedText(page.locator('.wish-entry a'), 'app.fulfiller.wishDetails.giftLink');
    // The exact wording is the regression target: form-only optional hints must not leak here.
    await expect(page.locator('.wish-entry a')).toHaveText('Link zum gewünschten Geschenk');
    await expect(
      page
        .locator('mat-card-content > div.gl-stack > p.gl-text--multiline')
        .filter({ hasText: 'Anonymisierte' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Diesen Wunsch erfüllen' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Bunte Holzbausteine zum Bauen');
    await expect(
      page.getByRole('dialog').locator('.reservation-dialog__details a'),
    ).toHaveAttribute('href', 'https://example.com/building-blocks');
    const dialogGiftLink = page.getByRole('dialog').locator('.reservation-dialog__details a');
    await expectTranslatedText(dialogGiftLink, 'app.fulfiller.reservationDialog.giftLink');
    await expect(dialogGiftLink).toHaveText('Link zum gewünschten Geschenk');
    await page.getByRole('dialog').getByLabel('Deine E-Mail-Adresse').fill('fulfiller@example.com');
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Bestätigungslink senden' }).click();

    await expect(page.getByText('Bestätigung per E-Mail ausstehend')).toBeVisible();
    await page.locator('input[type="search"]').fill('Bau');
    await expect.poll(() => requests.at(-1)?.searchParams.get('q')).toBe('Bau');
  });
});
