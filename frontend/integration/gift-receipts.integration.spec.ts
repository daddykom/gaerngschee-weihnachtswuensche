import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders, resetIntegrationRateLimits } from './support/auth-header';
import { issueRegistrationToken } from './support/registration-token';
import { loginAsUser } from './support/user-login';

const API_URL = 'http://localhost:8082';

test('lets a normal user open gift receipts from the account menu and search the real backend', async ({
  page,
}) => {
  await loginAsUser(page);
  await page.locator('.app-header__account-button').click();
  await page.getByRole('menuitem').filter({ hasText: 'Geschenkeingang' }).click();
  await expect(page).toHaveURL(/\/user\/gift-receipts$/);
  await page.getByRole('textbox', { name: 'Geschenknummer' }).fill('2147483647-2147483647');
  const response = page.waitForResponse((response) =>
    response.url().endsWith('/user/gift-receipts/2147483647-2147483647'),
  );
  await page.getByRole('button', { name: 'Suchen', exact: true }).click();
  expect((await response).status()).toBe(404);
  await expectTranslatedText(page.getByRole('alert'), 'app.giftReceipts.errors.GIFT_NOT_FOUND');
});

test('looks up gifts for both staff roles, safely receives parallel gifts and releases the final one once', async ({
  page,
  request,
}) => {
  resetIntegrationRateLimits();
  const login = await request.post(`${API_URL}/auth/registration-login`, {
    data: { token: issueRegistrationToken(`receipt+fair1-${Date.now()}@example.com`) },
  });
  expect(login.status()).toBe(200);
  const cookies = (await request.storageState()).cookies;
  const csrf = cookies.find(({ name }) => name === 'XSRF-TOKEN')?.value;
  expect(csrf).toBeTruthy();
  const saved = await request.post(`${API_URL}/client/order`, {
    headers: { 'X-CSRF-Token': csrf! },
    data: {
      mode: 'draft',
      text: 'Integration gift receipt order',
      adultsCount: 2,
      childrenCount: 3,
      password: 'long-enough-password',
      passwordConfirmation: 'long-enough-password',
      items: [
        {
          category: 'gift',
          personType: 'adult',
          personIndex: 1,
          title: 'Coat',
          description: 'A warm coat',
        },
        {
          category: 'gift',
          personType: 'child',
          personIndex: 1,
          title: 'Book',
          description: 'A picture book',
        },
      ],
    },
  });
  expect(saved.status()).toBe(200);
  const draft = (await saved.json()).order;
  await loginAsAdmin(page);
  const headers = await authHeaders(page);
  try {
    const approved = await page.request.patch(`${API_URL}/admin/orders/${draft.id}`, {
      headers,
      data: {
        action: 'save',
        order: { ...draft, status: 'definitive' },
        items: draft.items.map((item: Record<string, unknown>) => ({
          ...item,
          publicationStatus: 'approved',
        })),
      },
    });
    expect(approved.status()).toBe(200);
    const order = (await approved.json()).order;
    const selectedItem = order.items[0];
    const number = `${order.orderNumber}-${selectedItem.itemNumber}`;
    const lookup = await page.request.get(`${API_URL}/user/gift-receipts/${number}`);
    expect(lookup.status()).toBe(200);
    const result = await lookup.json();
    expect(result).toMatchObject({
      campaignYear: order.year,
      selectedItemId: selectedItem.id,
      order: { id: order.id, orderNumber: order.orderNumber, status: 'definitive' },
    });
    expect(result.order.items).toHaveLength(2);
    expect(result.order.items.map((item: { id: string }) => item.id).sort()).toEqual(
      order.items.map((item: { id: string }) => item.id).sort(),
    );
    expect(result.order).not.toHaveProperty('requesterEmail');
    expect(result.order).not.toHaveProperty('pickupTokenHash');
    await page.locator('.admin-menu-button').click();
    await page.getByRole('menuitem').filter({ hasText: 'Geschenkeingang' }).click();
    await expect(page).toHaveURL(/\/user\/gift-receipts$/);
    await page.getByRole('textbox', { name: 'Geschenknummer' }).fill(number);
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(2);
    const selected = page.locator('article[aria-current="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected.getByRole('heading')).toContainText(number);
    await expectTranslatedText(selected.locator('strong'), 'app.giftReceipts.selectedWish');
    expect((await request.get(`${API_URL}/user/gift-receipts/${number}`)).status()).toBe(404);

    const userLogin = await request.post(`${API_URL}/auth/login`, {
      headers: {
        'X-CSRF-Token': (await request.storageState()).cookies.find(
          ({ name }) => name === 'XSRF-TOKEN',
        )!.value,
      },
      data: { email: 'user@gaerngschee.ch', password: 'secret' },
    });
    expect(userLogin.status()).toBe(200);
    const userLookup = await request.get(`${API_URL}/user/gift-receipts/${number}`);
    expect(userLookup.status()).toBe(200);
    expect(await userLookup.json()).toEqual(result);
    const invalid = await request.get(`${API_URL}/user/gift-receipts/invalid`);
    expect(invalid.status()).toBe(400);
    const missing = await request.get(
      `${API_URL}/user/gift-receipts/${order.orderNumber}-2147483647`,
    );
    expect(missing.status()).toBe(404);

    const unchanged = await page.request.get(`${API_URL}/admin/orders`, { headers });
    const current = (await unchanged.json()).orders.find(
      (entry: { id: string }) => entry.id === order.id,
    );
    expect(current.status).toBe('definitive');
    expect(
      current.items.every(
        (item: { receivedAt: string | null; fulfillmentStatus: string }) =>
          item.receivedAt === null && item.fulfillmentStatus === 'available',
      ),
    ).toBe(true);

    const userCsrf = (await request.storageState()).cookies.find(
      ({ name }) => name === 'XSRF-TOKEN',
    )!.value;
    const giftNumbers = order.items.map(
      (item: { itemNumber: number }) => `${order.orderNumber}-${item.itemNumber}`,
    );
    const parallel = await Promise.all([
      page.request.post(`${API_URL}/user/gift-receipts/${giftNumbers[0]}`, {
        headers,
        data: { confirmUnreserved: true, confirmPickup: false },
      }),
      request.post(`${API_URL}/user/gift-receipts/${giftNumbers[1]}`, {
        headers: { 'X-CSRF-Token': userCsrf },
        data: { confirmUnreserved: true, confirmPickup: false },
      }),
    ]);
    expect(parallel.map((response) => response.status()).sort()).toEqual([200, 409]);
    const conflict = await parallel.find((response) => response.status() === 409)!.json();
    expect(conflict.error.code).toBe('RECEIPT_CONFIRMATION_REQUIRED');
    const latest = conflict.error.details.result;
    const lastNumber = latest.order.items.find(
      (item: { id: string }) => item.id === latest.selectedItemId,
    ).giftNumber;
    await page.getByRole('textbox', { name: 'Geschenknummer' }).fill(lastNumber);
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await page.getByRole('button', { name: 'Einliefern', exact: true }).click();
    await expectTranslatedText(page.getByRole('dialog'), 'app.giftReceipts.confirmBoth');
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen', exact: true }).click();
    const cancelled = await (
      await page.request.get(`${API_URL}/user/gift-receipts/${lastNumber}`)
    ).json();
    expect(cancelled.order.status).toBe('definitive');
    expect(
      cancelled.order.items.find((item: { id: string }) => item.id === latest.selectedItemId)
        .receivedAt,
    ).toBeNull();

    await page.getByRole('button', { name: 'Einliefern', exact: true }).click();
    const received = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/user/gift-receipts/${lastNumber}`) &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Einliefern und freigeben', exact: true })
      .click();
    const completed = await received;
    expect(completed.status()).toBe(200);
    expect(await completed.json()).toMatchObject({
      mailStatus: 'sent',
      alreadyReceived: false,
      order: { status: 'ready_for_pickup' },
    });
    await expectTranslatedText(page.getByRole('alert'), 'app.giftReceipts.released');
    await expect(page.getByRole('button', { name: 'Einliefern', exact: true })).toHaveCount(0);
    const duplicates = await Promise.all(
      [0, 1].map(() =>
        page.request.post(`${API_URL}/user/gift-receipts/${lastNumber}`, {
          headers,
          data: { confirmUnreserved: true, confirmPickup: true },
        }),
      ),
    );
    for (const duplicate of duplicates) {
      expect(duplicate.status()).toBe(200);
      expect(await duplicate.json()).toMatchObject({ alreadyReceived: true, mailStatus: 'sent' });
    }
    await expect
      .poll(async () => {
        const messages = (
          await (await page.request.get('http://localhost:8025/api/v1/messages')).json()
        ).messages;
        const matching = messages.filter((message: { To: Array<{ Address: string }> }) =>
          message.To.some((to) => to.Address === order.requesterEmail),
        );
        const details = await Promise.all(
          matching.map(async (message: { ID: string }) =>
            (await page.request.get(`http://localhost:8025/api/v1/message/${message.ID}`)).json(),
          ),
        );
        return details.filter((detail) => detail.HTML.includes('id="pickup-qr-code"')).length;
      })
      .toBe(1);
  } finally {
    const deleted = await page.request.delete(`${API_URL}/admin/users/${draft.userId}`, {
      headers,
    });
    expect(deleted.status()).toBe(200);
  }
});
