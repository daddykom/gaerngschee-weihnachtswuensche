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
        publicationStatus: 'approved',
        receivedAt: null,
      },
      {
        id: 'item-2',
        giftNumber: '12-2',
        currentTitle: 'Book',
        currentDescription: 'A picture book',
        fulfillmentStatus: 'received',
        publicationStatus: 'approved',
        receivedAt: '2026-11-13 10:00:00',
      },
      {
        id: 'item-3',
        giftNumber: '12-3',
        currentTitle: 'Toy',
        currentDescription: 'A toy with a long description '.repeat(12),
        fulfillmentStatus: 'available',
        publicationStatus: 'approved',
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
  for (const scenario of [
    { name: 'reserved gift', unreserved: false, last: false, mailStatus: 'not_required' },
    { name: 'unreserved gift', unreserved: true, last: false, mailStatus: 'not_required' },
    { name: 'last reserved gift', unreserved: false, last: true, mailStatus: 'sent' },
    {
      name: 'last unreserved gift with pending mail',
      unreserved: true,
      last: true,
      mailStatus: 'pending',
    },
  ]) {
    test(`receives ${scenario.name} only after required confirmation`, async ({ page }) => {
      await persistRole(page, 'user');
      const initial = {
        ...result,
        order: {
          ...result.order,
          items: result.order.items.map((item) =>
            item.id === 'item-3'
              ? { ...item, fulfillmentStatus: scenario.unreserved ? 'available' : 'reserved' }
              : scenario.last
                ? { ...item, fulfillmentStatus: 'received', receivedAt: '2026-11-13 10:00:00' }
                : item,
          ),
        },
      };
      let posts = 0;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('http://localhost:8083/user/gift-receipts/12-3', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({ json: initial });
          return;
        }
        posts++;
        expect(route.request().postDataJSON()).toEqual({
          confirmUnreserved: scenario.unreserved,
          confirmPickup: scenario.last,
        });
        await gate;
        await route.fulfill({
          json: {
            ...initial,
            alreadyReceived: false,
            mailStatus: scenario.mailStatus,
            order: {
              ...initial.order,
              status: scenario.last ? 'ready_for_pickup' : 'definitive',
              items: initial.order.items.map((item) =>
                item.id === 'item-3'
                  ? { ...item, fulfillmentStatus: 'received', receivedAt: '2026-11-13 12:00:00' }
                  : item,
              ),
            },
          },
        });
      });
      try {
        await page.goto('/user/gift-receipts');
        await page.getByRole('textbox', { name: 'Geschenknummer' }).fill('12-3');
        await page.getByRole('button', { name: 'Suchen', exact: true }).click();
        const receive = page.getByRole('button', { name: 'Einliefern', exact: true });
        await receive.click();
        if (scenario.unreserved || scenario.last) {
          const dialog = page.getByRole('dialog');
          await expectTranslatedText(
            dialog,
            scenario.last ? 'app.giftReceipts.confirmPickup' : 'app.giftReceipts.confirmUnreserved',
          );
          expect(posts).toBe(0);
          await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
          expect(posts).toBe(0);
          await receive.click();
          await dialog
            .getByRole('button', {
              name: scenario.last ? 'Einliefern und freigeben' : 'Trotzdem einliefern',
              exact: true,
            })
            .click();
        }
        await expect(receive).toBeDisabled();
        await expect(page.getByRole('textbox', { name: 'Geschenknummer' })).toHaveAttribute(
          'readonly',
        );
        release();
        await expect(receive).toHaveCount(0);
        await expect(page.getByRole('article')).toHaveCount(3);
        await expect(page.locator('article[aria-current="true"]')).toContainText(
          '2026-11-13 12:00:00',
        );
        await expectTranslatedText(
          page.getByRole('alert'),
          `app.giftReceipts.${scenario.mailStatus === 'pending' ? 'mailPending' : scenario.last ? 'released' : 'received'}`,
        );
        expect(posts).toBe(1);
      } finally {
        release();
      }
    });
  }

  test('refreshes the displayed order when a parallel receipt makes confirmation necessary', async ({
    page,
  }) => {
    await persistRole(page, 'admin');
    const initial = {
      ...result,
      order: {
        ...result.order,
        items: result.order.items.map((item) => ({ ...item, fulfillmentStatus: 'reserved' })),
      },
    };
    const fresh = {
      ...initial,
      order: {
        ...initial.order,
        items: initial.order.items.map((item) =>
          item.id === 'item-3'
            ? item
            : { ...item, fulfillmentStatus: 'received', receivedAt: '2026-11-13 10:00:00' },
        ),
      },
    };
    let posts = 0;
    await page.route('http://localhost:8083/user/gift-receipts/12-3', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: initial });
        return;
      }
      posts++;
      await route.fulfill({
        status: 409,
        json: { error: { code: 'RECEIPT_CONFIRMATION_REQUIRED', details: { result: fresh } } },
      });
    });
    await page.goto('/user/gift-receipts');
    await page.getByRole('textbox', { name: 'Geschenknummer' }).fill('12-3');
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await page.getByRole('button', { name: 'Einliefern', exact: true }).click();
    await expectTranslatedText(
      page.getByRole('alert'),
      'app.giftReceipts.errors.RECEIPT_CONFIRMATION_REQUIRED',
    );
    await page.getByRole('button', { name: 'Einliefern', exact: true }).click();
    await expectTranslatedText(page.getByRole('dialog'), 'app.giftReceipts.confirmPickup');
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
    expect(posts).toBe(1);
  });

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
        await expect(page.getByRole('button', { name: 'Einliefern', exact: true })).toHaveCount(1);
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
