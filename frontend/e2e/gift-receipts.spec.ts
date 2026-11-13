import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

const result = {
  campaignYear: 2026,
  selectedItemId: 'item-3',
  order: {
    id: 'order-12',
    year: 2026,
    orderNumber: 12,
    status: 'definitive',
    items: [
      {
        id: 'item-1',
        giftNumber: '12-1',
        currentTitle: 'Coat',
        currentDescription: 'A warm coat',
        fulfillmentStatus: 'reserved',
        receivedAt: null,
      },
      {
        id: 'item-2',
        giftNumber: '12-2',
        currentTitle: 'Book',
        currentDescription: 'A picture book',
        fulfillmentStatus: 'received',
        receivedAt: '2026-11-13 10:00:00',
      },
      {
        id: 'item-3',
        giftNumber: '12-3',
        currentTitle: 'Toy',
        currentDescription: 'A toy with a long description '.repeat(12),
        fulfillmentStatus: 'available',
        receivedAt: null,
      },
    ],
  },
};

async function persistRole(page: import('@playwright/test').Page, group: string): Promise<void> {
  await page.addInitScript(
    (group) =>
      localStorage.setItem(
        'gaerngschee.auth',
        JSON.stringify({
          userId: 'staff-1',
          group,
          email: `${group}@example.com`,
          fairgateUserExists: null,
          childrenCount: null,
          adultsCount: null,
          salutation: null,
        }),
      ),
    group,
  );
}

test.describe('Gift receipts route', () => {
  for (const group of ['admin', 'user']) {
    for (const width of [390, 1280]) {
      test(`offers read-only search and all wishes to ${group} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await persistRole(page, group);
        const requests: string[] = [];
        await page.route('http://localhost:8083/user/gift-receipts/**', async (route) => {
          requests.push(route.request().method());
          expect(route.request().url()).toContain('/12-3');
          await route.fulfill({ json: result });
        });
        await page.goto('/user/gift-receipts');
        await expectTranslatedText(page.locator('h1'), 'app.giftReceipts.title');
        expect(requests).toHaveLength(0);
        await expect(page.locator('.control-error')).toHaveCount(0);
        await page.getByRole('textbox', { name: 'Geschenknummer' }).fill('12-3');
        await page.getByRole('button', { name: 'Suchen', exact: true }).click();
        await expect(page.getByRole('article')).toHaveCount(3);
        const selected = page.locator('article[aria-current="true"]');
        await expect(selected).toHaveCount(1);
        await expect(selected.getByRole('heading')).toContainText('12-3');
        await expectTranslatedText(selected.locator('strong'), 'app.giftReceipts.selectedWish');
        await expectTranslatedText(
          page.locator('#gift-receipt-order-heading'),
          'app.giftReceipts.orderHeading',
        );
        await expect(page.getByRole('article').nth(1)).toContainText('2026-11-13 10:00:00');
        expect(requests).toEqual(['GET']);
        await expect(page.getByRole('button', { name: /Einliefern/ })).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);

        if (group === 'admin') {
          await page.locator('.admin-menu-button').click();
        } else {
          await page.locator('.app-header__account-button').click();
        }
        const menuLink = page.getByRole('menuitem').filter({ hasText: 'Geschenkeingang' });
        await expectTranslatedText(menuLink, 'app.navigation.giftReceipts');
        await expect(menuLink).toHaveAttribute('href', '/user/gift-receipts');
        if (group === 'user') {
          await expect(page.locator('.admin-menu-button')).toHaveCount(0);
          await expect(
            page.getByRole('menuitem').filter({ hasText: 'Admin-Übersicht' }),
          ).toHaveCount(0);
        }
      });
    }
  }

  test('validates only after interaction, focuses invalid input and makes no request', async ({
    page,
  }) => {
    await persistRole(page, 'user');
    let requests = 0;
    await page.route('http://localhost:8083/user/gift-receipts/**', async (route) => {
      requests++;
      await route.fulfill({ json: result });
    });
    await page.goto('/user/gift-receipts');
    await expect(page.locator('.control-error')).toHaveCount(0);
    const input = page.getByRole('textbox', { name: 'Geschenknummer' });
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await expectTranslatedText(
      page.locator('.control-error'),
      'app.giftReceipts.validation.giftNumber.required',
    );
    await expect(input).toBeFocused();
    for (const value of ['12', '12-0', '1-2147483648']) {
      await input.fill(value);
      await page.getByRole('button', { name: 'Suchen', exact: true }).click();
      await expectTranslatedText(
        page.locator('.control-error'),
        'app.giftReceipts.validation.giftNumber.format',
      );
    }
    expect(requests).toBe(0);
  });

  test('shows failures centrally, clears old results and supports retry', async ({ page }) => {
    await persistRole(page, 'admin');
    let attempts = 0;
    await page.route('http://localhost:8083/user/gift-receipts/**', async (route) => {
      attempts++;
      await route.fulfill(
        attempts === 2
          ? { status: 404, json: { error: { code: 'GIFT_NOT_FOUND' } } }
          : { json: result },
      );
    });
    await page.goto('/user/gift-receipts');
    const input = page.getByRole('textbox', { name: 'Geschenknummer' });
    await input.fill('12-3');
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(3);
    await input.fill('99-1');
    await expect(page.getByRole('article')).toHaveCount(0);
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await expectTranslatedText(page.getByRole('alert'), 'app.giftReceipts.errors.GIFT_NOT_FOUND');
    await expect(page.getByRole('article')).toHaveCount(0);
    await input.fill('12-3');
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(3);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('cancels a pending search when its number is edited', async ({ page }) => {
    await persistRole(page, 'user');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('http://localhost:8083/user/gift-receipts/12-3', async (route) => {
      await gate;
      await route.fulfill({ json: result }).catch(() => undefined);
    });
    await page.route('http://localhost:8083/user/gift-receipts/12-1', async (route) => {
      await route.fulfill({ json: { ...result, selectedItemId: 'item-1' } });
    });
    try {
      await page.goto('/user/gift-receipts');
      const input = page.getByRole('textbox', { name: 'Geschenknummer' });
      await input.fill('12-3');
      await page.getByRole('button', { name: 'Suchen', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Suchen', exact: true })).toBeDisabled();
      await input.fill('12-1');
      await expect(page.getByRole('button', { name: 'Suchen', exact: true })).toBeEnabled();
      release();
      await page.getByRole('button', { name: 'Suchen', exact: true }).click();
      await expect(page.locator('article[aria-current="true"] h3')).toContainText('12-1');
      await expect(page.locator('article[aria-current="true"]')).toHaveCount(1);
    } finally {
      release();
    }
  });

  for (const group of ['wunschbesteller', 'wunscherfueller', null]) {
    test(`rejects access for ${group ?? 'anonymous visitors'}`, async ({ page }) => {
      if (group) await persistRole(page, group);
      await page.goto('/user/gift-receipts');
      await expect(page).toHaveURL(/\/not-found$/);
      await expect(page.getByRole('textbox', { name: 'Geschenknummer' })).toHaveCount(0);
    });
  }
});
