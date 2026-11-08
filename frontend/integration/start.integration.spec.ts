import { expect, test } from '@playwright/test';

test.describe('Integration start', () => {
  test('submits a registration request through the real backend', async ({ page }) => {
    const email = `registration-${Date.now()}@example.com`;
    await page.goto('/start');
    await page.locator('input[type="email"]').fill(email);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page.locator('input[type="email"]')).toHaveValue(email);

    await expect
      .poll(async () => {
        const response = await page.request.get('http://localhost:8025/api/v1/messages');
        if (!response.ok()) {
          return false;
        }

        const messages = (await response.json()) as {
          messages: Array<{ To: Array<{ Address: string }> }>;
        };
        return messages.messages.some((candidate) =>
          candidate.To.some((recipient) => recipient.Address === email),
        );
      })
      .toBe(true);

    const messagesResponse = await page.request.get('http://localhost:8025/api/v1/messages');
    expect(messagesResponse.ok()).toBe(true);
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
    expect(detail.HTML).toContain('/client-login?token=');
  });
});
