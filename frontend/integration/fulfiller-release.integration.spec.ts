import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expectTranslatedText } from '../e2e/support/assertions';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders, resetIntegrationRateLimits } from './support/auth-header';
import { issueRegistrationToken } from './support/registration-token';

const api = 'http://localhost:8082';

test('releases a confirmed giver immediately, preserves the draft and sends the queued notification through the batch', async ({
  page,
  request,
}) => {
  resetIntegrationRateLimits();
  const stamp = Date.now();
  const recipient = `released-giver-${stamp}@example.com`;
  const title = `Release fixture ${stamp}`;
  expect(
    (
      await request.post(`${api}/auth/registration-login`, {
        data: { token: issueRegistrationToken(`release+fair1-${stamp}@example.com`) },
      })
    ).status(),
  ).toBe(200);
  const csrf = (await request.storageState()).cookies.find(
    ({ name }) => name === 'XSRF-TOKEN',
  )!.value;
  const saved = await request.post(`${api}/client/order`, {
    headers: { 'X-CSRF-Token': csrf },
    data: {
      mode: 'draft',
      text: 'Release fixture family',
      adultsCount: 2,
      childrenCount: 3,
      password: 'long-enough-password',
      passwordConfirmation: 'long-enough-password',
      items: [
        {
          category: 'gift',
          personType: 'adult',
          personIndex: 1,
          title,
          description: 'Published release description',
        },
      ],
    },
  });
  expect(saved.status()).toBe(200);
  const draft = (await saved.json()).order;
  await loginAsAdmin(page);
  const headers = await authHeaders(page);
  try {
    const approval = await page.request.patch(`${api}/admin/orders/${draft.id}`, {
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
    expect(approval.status()).toBe(200);
    const approved = (await approval.json()).order;
    const itemId = approved.items[0].id;
    expect(
      (
        await request.post(`${api}/public/fulfiller-reservation-start`, {
          headers: { 'X-CSRF-Token': csrf },
          data: { itemId, email: recipient, privacyAccepted: true },
        })
      ).status(),
    ).toBe(202);
    const messages = (await (await request.get('http://localhost:8025/api/v1/messages')).json())
      .messages;
    const mail = messages.find((message: { To: Array<{ Address: string }> }) =>
      message.To.some((to) => to.Address === recipient),
    );
    expect(mail).toBeTruthy();
    const linkMail = await (
      await request.get(`http://localhost:8025/api/v1/message/${mail.ID}`)
    ).json();
    const token = new URL(
      linkMail.HTML.match(/href="([^"]*\/fulfiller-reservation\?token=[^"]+)"/)[1],
    ).searchParams.get('token');
    expect(
      (
        await request.post(`${api}/auth/fulfiller-reservation-confirm`, {
          headers: { 'X-CSRF-Token': csrf },
          data: { token },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await request.get(`${api}/public/fulfiller/orders`, { params: { q: title } })).json())
        .orders,
    ).toHaveLength(0);

    await page.goto('/admin/overview');
    await page.getByRole('combobox', { name: 'Status', exact: true }).click();
    await page.getByRole('option', { name: 'Definitiv', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator(`a[href="/admin/orders/${draft.id}/edit"]`).click();
    await page.locator(`a[href="/admin/orders/${draft.id}/edit/item/${itemId}"]`).click();
    await page
      .getByRole('textbox', { name: 'Aktueller Wunschtitel', exact: true })
      .fill('Unsaved release edit');
    const url = `${api}/admin/orders/${draft.id}/items/${itemId}/release-fulfiller`;
    expect((await page.request.post(url, { data: {} })).status()).toBe(403);
    await page.getByRole('button', { name: 'Erfüller entfernen', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Nein', exact: true }).click();
    await page.getByRole('button', { name: 'Erfüller entfernen', exact: true }).click();
    const releaseResponse = page.waitForResponse(url);
    await page.getByRole('dialog').getByRole('button', { name: 'Ja', exact: true }).click();
    expect((await releaseResponse).status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Erfüller entfernen', exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('textbox', { name: 'Aktueller Wunschtitel', exact: true }),
    ).toHaveValue('Unsaved release edit');
    await expectTranslatedText(
      page.locator('.app-notification'),
      'app.admin.fulfillerRemoval.success',
    );
    const publicOrders = (
      await (await request.get(`${api}/public/fulfiller/orders`, { params: { q: title } })).json()
    ).orders;
    expect(publicOrders).toHaveLength(1);
    expect(publicOrders[0].items[0]).toMatchObject({
      id: itemId,
      fulfillmentStatus: 'available',
      title,
    });
    const orders = (
      await (
        await page.request.get(`${api}/admin/orders`, { params: { 'status[]': 'definitive' } })
      ).json()
    ).orders;
    const persisted = orders.find((order: { id: string }) => order.id === draft.id).items[0];
    expect(persisted).toMatchObject({
      currentTitle: title,
      fulfillerEmail: null,
      reservedAt: null,
    });
    expect(
      (
        await page.request.post(url, {
          headers,
          data: {
            fulfillerEmail: recipient,
            fulfillmentStatus: 'reserved',
            reservedAt: null,
            reservationExpiresAt: null,
          },
        })
      ).status(),
    ).toBe(409);

    execFileSync(
      'docker',
      [
        'compose',
        '-f',
        resolve(process.cwd(), '..', 'docker-compose.integration.yml'),
        'exec',
        '-T',
        'integration-backend',
        'php',
        '/var/www/html/bin/process-orders.php',
      ],
      { encoding: 'utf8' },
    );
    const delivered = (await (await request.get('http://localhost:8025/api/v1/messages')).json())
      .messages;
    const notices = delivered.filter(
      (message: { Subject: string; To: Array<{ Address: string }> }) =>
        message.To.some((to) => to.Address === recipient) &&
        message.Subject === 'Deine Wunschreservierung wurde aufgehoben',
    );
    expect(notices).toHaveLength(1);
    const notice = await (
      await request.get(`http://localhost:8025/api/v1/message/${notices[0].ID}`)
    ).json();
    for (const body of [notice.HTML, notice.Text]) {
      expect(body).toContain(title);
      expect(body).toContain('Published release description');
      expect(body).not.toContain('Unsaved release edit');
      expect(body).not.toContain('app.mail.');
    }
    // Two administrators cannot remove a newly assigned giver twice.
    const nextRecipient = `next-${recipient}`;
    expect(
      (
        await request.post(`${api}/public/fulfiller-reservation-start`, {
          headers: { 'X-CSRF-Token': csrf },
          data: { itemId, email: nextRecipient, privacyAccepted: true },
        })
      ).status(),
    ).toBe(202);
    const latest = (
      await (
        await page.request.get(`${api}/admin/orders`, { params: { 'status[]': 'definitive' } })
      ).json()
    ).orders;
    const pending = latest.find((order: { id: string }) => order.id === draft.id).items[0];
    const data = {
      fulfillerEmail: pending.fulfillerEmail,
      fulfillmentStatus: pending.fulfillmentStatus,
      reservedAt: pending.reservedAt,
      reservationExpiresAt: pending.reservationExpiresAt,
    };
    const removals = await Promise.all([0, 1].map(() => page.request.post(url, { headers, data })));
    expect(removals.map((response) => response.status()).sort()).toEqual([200, 409]);
    execFileSync(
      'docker',
      [
        'compose',
        '-f',
        resolve(process.cwd(), '..', 'docker-compose.integration.yml'),
        'exec',
        '-T',
        'integration-backend',
        'php',
        '/var/www/html/bin/process-orders.php',
      ],
      { encoding: 'utf8' },
    );
  } finally {
    await page.request.delete(`${api}/admin/users/${draft.userId}`, { headers });
  }
});
