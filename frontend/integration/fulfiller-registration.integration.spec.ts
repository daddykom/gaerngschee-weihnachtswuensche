import { expect, test } from '@playwright/test';

test.describe('Integration fulfiller registration', () => {
  test('requests and consumes a fulfiller token through the real backend', async ({ page }) => {
    const email = `fulfiller-${Date.now()}@example.com`;
    const startResponse = await page.request.post('http://localhost:8082/public/fulfiller-start', {
      data: { email, language: 'de', privacyAccepted: true },
    });

    expect(startResponse.status()).toBe(202);

    await expect
      .poll(async () => {
        const response = await page.request.get('http://localhost:8025/api/v1/messages');
        if (!response.ok()) return null;
        const data = (await response.json()) as {
          messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
        };
        return (
          data.messages.find((candidate) =>
            candidate.To.some((recipient) => recipient.Address === email),
          ) ?? null
        );
      })
      .not.toBeNull();

    const messagesResponse = await page.request.get('http://localhost:8025/api/v1/messages');
    const messages = (await messagesResponse.json()) as {
      messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
    };
    const message = messages.messages.find((candidate) =>
      candidate.To.some((recipient) => recipient.Address === email),
    );
    expect(message).toBeDefined();

    const detailResponse = await page.request.get(
      `http://localhost:8025/api/v1/message/${message?.ID}`,
    );
    expect(detailResponse.ok()).toBe(true);
    const detail = (await detailResponse.json()) as { HTML: string };
    const token = detail.HTML.match(/\/fulfiller-login\?token=([^"&<]+)/)?.[1];
    expect(token).toBeDefined();

    const loginResponse = await page.request.post(
      'http://localhost:8082/auth/fulfiller-registration-login',
      { data: { token: decodeURIComponent(token ?? '') } },
    );
    expect(loginResponse.status()).toBe(200);
    await expect(loginResponse.json()).resolves.toMatchObject({
      group: 'wunscherfueller',
      requiredPasswordReset: false,
    });

    const csrfCookie = (await page.context().cookies('http://localhost:8082')).find(
      (cookie) => cookie.name === 'XSRF-TOKEN',
    );
    expect(csrfCookie).toBeDefined();

    const secondLoginResponse = await page.request.post(
      'http://localhost:8082/auth/fulfiller-registration-login',
      {
        data: { token: decodeURIComponent(token ?? '') },
        headers: { 'X-CSRF-Token': csrfCookie?.value ?? '' },
      },
    );
    expect(secondLoginResponse.status()).toBe(401);
  });
});
