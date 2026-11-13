import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { loginAsAdmin } from './support/admin-login';

test('sends a pickup QR email whose public fallback renders the identical PNG without a login', async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  const recipient = `pickup-qr-${Date.now()}@example.com`;
  const before = await (await page.request.get('http://localhost:8082/admin/orders')).json();
  await page.goto('/admin/email-test');
  await page.getByRole('combobox', { name: 'E-Mail', exact: true }).click();
  const option = page.getByRole('option').filter({ hasText: 'Abholbenachrichtigung' });
  await expectTranslatedText(option, 'app.admin.emailTest.templates.order-ready-for-pickup');
  await option.click();
  await page.getByRole('textbox', { name: 'Empfänger-Adresse' }).fill(recipient);
  await page.getByRole('spinbutton', { name: 'Jahr', exact: true }).fill('2026');
  await page.getByRole('spinbutton', { name: 'Zettelnummer', exact: true }).fill('12');
  await page.getByRole('button', { name: 'Senden' }).click();
  await expectTranslatedText(page.getByRole('alert'), 'app.admin.emailTest.sent');

  let messageId: string | undefined;
  await expect
    .poll(async () => {
      const data = await (await request.get('http://localhost:8025/api/v1/messages')).json();
      messageId = data.messages.find((message: { ID: string; To: Array<{ Address: string }> }) =>
        message.To.some((to) => to.Address === recipient),
      )?.ID;
      return messageId !== undefined;
    })
    .toBe(true);
  const message = await (
    await request.get(`http://localhost:8025/api/v1/message/${messageId}`)
  ).json();
  expect(message.HTML).not.toContain('app.mail.pickup');
  const imageUrl = /href="([^"]+\/public\/pickup-qr-code\/[a-f0-9]{64})"/.exec(message.HTML)?.[1];
  expect(imageUrl).toMatch(/^http:\/\/localhost:8082\/public\/pickup-qr-code\/[a-f0-9]{64}$/);
  expect(message.Text).toContain(imageUrl);
  const inline = message.Inline.find(
    (part: { FileName: string }) => part.FileName === 'pickup-qr-code',
  );
  expect(inline).toBeDefined();
  expect(inline.ContentType).toBe('image/png');
  expect(message.HTML).toContain(`cid:${inline.ContentID}`);
  const embedded = await request.get(
    `http://localhost:8025/api/v1/message/${messageId}/part/${inline.PartID}`,
  );
  expect(embedded.status()).toBe(200);
  const fallback = await request.get(imageUrl!);
  expect(fallback.status()).toBe(200);
  expect(fallback.headers()['content-type']).toBe('image/png');
  expect(
    fallback
      .headers()
      ['cache-control'].split(',')
      .map((value) => value.trim()),
  ).toEqual(expect.arrayContaining(['private', 'no-store']));
  const png = await fallback.body();
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.equals(await embedded.body())).toBe(true);
  let previewHtml = message.HTML as string;
  for (const part of message.Inline as Array<{
    ContentID: string;
    ContentType: string;
    PartID: string;
  }>) {
    const body = await (
      await request.get(`http://localhost:8025/api/v1/message/${messageId}/part/${part.PartID}`)
    ).body();
    previewHtml = previewHtml.replaceAll(
      `cid:${part.ContentID}`,
      `data:${part.ContentType};base64,${body.toString('base64')}`,
    );
  }
  const preview = await page.context().newPage();
  try {
    for (const width of [320, 390, 760]) {
      await preview.setViewportSize({ width, height: 900 });
      await preview.setContent(previewHtml);
      const card = preview.locator('table[width="600"]');
      const cardBounds = await card.boundingBox();
      expect(cardBounds).not.toBeNull();
      await expect(card).toHaveCSS('border-radius', '20px');
      for (const selector of ['img[alt="Gärngschee"]', '#pickup-qr-code']) {
        const bounds = await preview.locator(selector).boundingBox();
        expect(bounds).not.toBeNull();
        expect(
          Math.abs(bounds!.x + bounds!.width / 2 - (cardBounds!.x + cardBounds!.width / 2)),
        ).toBeLessThanOrEqual(1);
      }
      const button = preview.getByRole('link').first();
      await expectTranslatedText(button, 'app.mail.pickup.button');
      await expect(button).toHaveAttribute('href', imageUrl!);
      await expect(button.locator('..')).toHaveCSS('background-color', 'rgb(138, 40, 88)');
      await expect(preview.getByRole('link', { name: imageUrl!, exact: true })).toBeVisible();
      expect(
        await preview.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await preview.screenshot({
        path: test.info().outputPath(`pickup-email-${width}.png`),
        fullPage: true,
      });
    }
  } finally {
    await preview.close();
  }
  const after = await (await page.request.get('http://localhost:8082/admin/orders')).json();
  expect(after).toEqual(before);
});
