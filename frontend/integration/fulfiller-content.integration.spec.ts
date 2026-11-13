import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders, resetIntegrationRateLimits } from './support/auth-header';
import { issueRegistrationToken } from './support/registration-token';

const API_URL = 'http://localhost:8082';

test('publishes only edited wish details and keeps the team message private across API, search and reservation dialog', async ({
  page,
  request,
}) => {
  resetIntegrationRateLimits();
  const stamp = Date.now();
  const originalTitle = `original-title-${stamp}`;
  const originalDescription = `original-description-${stamp}`;
  const publishedTitle = `published-title-${stamp}`;
  const publishedDescription = `published-description-${stamp}`;
  const privateMessage = `private-team-message-${stamp}`;
  const giftLink = 'https://example.com/gift';
  const login = await request.post(`${API_URL}/auth/registration-login`, {
    data: { token: issueRegistrationToken(`content+fair1-${stamp}@example.com`) },
  });
  expect(login.status()).toBe(200);
  const csrf = (await request.storageState()).cookies.find(
    ({ name }) => name === 'XSRF-TOKEN',
  )!.value;
  const saved = await request.post(`${API_URL}/client/order`, {
    headers: { 'X-CSRF-Token': csrf },
    data: {
      mode: 'draft',
      text: 'Public family information',
      adultsCount: 2,
      childrenCount: 3,
      password: 'long-enough-password',
      passwordConfirmation: 'long-enough-password',
      items: [
        {
          category: 'gift',
          personType: 'adult',
          personIndex: 1,
          title: originalTitle,
          description: originalDescription,
          giftLink,
          personalMessage: privateMessage,
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
          currentTitle: publishedTitle,
          currentDescription: publishedDescription,
          publicationStatus: 'approved',
        })),
      },
    });
    expect(approved.status()).toBe(200);
    const order = (await approved.json()).order;
    expect(order.items[0]).toMatchObject({
      originalTitle,
      originalDescription,
      currentTitle: publishedTitle,
      currentDescription: publishedDescription,
      personalMessage: privateMessage,
    });

    await page.goto('/admin/overview');
    await page.getByRole('combobox', { name: 'Status', exact: true }).click();
    await page.getByRole('option', { name: 'Definitiv', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator(`a[href="/admin/orders/${draft.id}/edit"]`).click();
    await page
      .locator(`a[href="/admin/orders/${draft.id}/edit/item/${order.items[0].id}"]`)
      .click();
    await expect(page.locator('.original-text').nth(0)).toHaveText(originalTitle);
    await expect(page.locator('.original-text').nth(1)).toHaveText(originalDescription);
    await expect(page.getByRole('textbox', { name: 'Aktueller Wunschtitel' })).toHaveValue(
      publishedTitle,
    );
    await expect(
      page.getByRole('textbox', { name: /Persönliche Nachricht an das Gärngschee-Team/ }),
    ).toHaveValue(privateMessage);

    const publicResponse = await request.get(`${API_URL}/public/fulfiller/orders`, {
      params: { q: publishedTitle },
    });
    expect(publicResponse.status()).toBe(200);
    const publicOrders = await publicResponse.json();
    expect(publicOrders.orders).toHaveLength(1);
    const wish = publicOrders.orders[0].items[0];
    expect(wish).toMatchObject({
      title: publishedTitle,
      currentDescription: publishedDescription,
      giftLink,
    });
    for (const field of [
      'personalMessage',
      'currentReason',
      'originalReason',
      'originalTitle',
      'originalDescription',
    ]) {
      expect(wish).not.toHaveProperty(field);
    }
    for (const privateContent of [privateMessage, originalTitle, originalDescription]) {
      expect(JSON.stringify(publicOrders)).not.toContain(privateContent);
      const search = await request.get(`${API_URL}/public/fulfiller/orders`, {
        params: { q: privateContent },
      });
      expect(search.status()).toBe(200);
      expect(await search.json()).toEqual({ orders: [] });
    }

    await page.goto('/erfuellen');
    const card = page
      .locator('.wish-entry')
      .filter({ has: page.getByRole('heading', { name: publishedTitle, exact: true }) });
    await expect(card).toContainText(publishedDescription);
    await expect(card.getByRole('link')).toHaveAttribute('href', giftLink);
    await expect(page.locator('body')).not.toContainText(privateMessage);
    await card.getByRole('button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(publishedTitle);
    await expect(dialog).toContainText(publishedDescription);
    await expect(dialog).not.toContainText(privateMessage);
    await expect(dialog.locator('.reservation-dialog__details a')).toHaveAttribute(
      'href',
      giftLink,
    );
    const recipient = `reservation-title-${stamp}@example.com`;
    await dialog.getByRole('textbox', { name: 'Deine E-Mail-Adresse' }).fill(recipient);
    await dialog.getByRole('checkbox').check();
    const reservation = page.waitForResponse(
      (response) =>
        response.url().endsWith('/public/fulfiller-reservation-start') &&
        response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Bestätigungslink senden' }).click();
    expect((await reservation).status()).toBe(202);
    let messageId: string | undefined;
    await expect
      .poll(async () => {
        const messages = (await (await request.get('http://localhost:8025/api/v1/messages')).json())
          .messages;
        messageId = messages.find((message: { ID: string; To: Array<{ Address: string }> }) =>
          message.To.some((to) => to.Address === recipient),
        )?.ID;
        return messageId !== undefined;
      })
      .toBe(true);
    const message = await (
      await request.get(`http://localhost:8025/api/v1/message/${messageId}`)
    ).json();
    for (const body of [message.HTML, message.Text]) {
      expect(body).toContain(publishedTitle);
      expect(body).toContain(publishedDescription);
      expect(body).not.toContain(originalTitle);
      expect(body).not.toContain(originalDescription);
      expect(body).not.toContain(privateMessage);
    }
  } finally {
    const deleted = await page.request.delete(`${API_URL}/admin/users/${draft.userId}`, {
      headers,
    });
    expect(deleted.status()).toBe(200);
  }
});
