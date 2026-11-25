import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';

for (const template of [
  { id: 'fulfiller-reservation', name: 'Reservation für Erfüller' },
  { id: 'fulfiller-reservation-confirmation', name: 'Bestätigte Wunscherfüllung' },
]) {
  for (const hasLink of [true, false]) {
    test(`sends ${template.id} with title and description ${hasLink ? 'with' : 'without'} a wish link`, async ({
      page,
      request,
    }) => {
      await loginAsAdmin(page);
      const recipient = `fulfiller-${template.id}-${hasLink}-${Date.now()}@example.com`;
      await page.goto('/admin/email-test');
      await page.getByRole('combobox', { name: 'E-Mail', exact: true }).click();
      await page.getByRole('option', { name: template.name, exact: true }).click();
      await page.getByRole('textbox', { name: 'Empfänger-Adresse' }).fill(recipient);
      await page.getByRole('textbox', { name: 'Wunschnummer', exact: true }).fill('12-1');
      await page
        .getByRole('textbox', { name: 'Bearbeiteter Wunschtitel', exact: true })
        .fill('Edited test title');
      await page
        .getByRole('textbox', { name: 'Wunschbeschreibung', exact: true })
        .fill('Edited test description\nSecond line');
      if (hasLink) {
        await page
          .getByRole('textbox', { name: 'Link zum Wunsch (freiwillig)', exact: true })
          .fill('https://example.com/gift');
      }
      if (template.id === 'fulfiller-reservation') {
        await page
          .getByRole('textbox', { name: 'Login-URL', exact: true })
          .fill('https://example.com/confirm');
      } else {
        await page
          .getByRole('textbox', { name: 'Abgabezeitraum', exact: true })
          .fill('17.–19. Dezember 2026');
        await page.getByRole('textbox', { name: 'Abgabezeit', exact: true }).fill('10–12 Uhr');
        await page.getByRole('textbox', { name: 'Abgabeort', exact: true }).fill('Saal A\nBasel');
      }
      await page.getByRole('button', { name: 'Senden', exact: true }).click();
      await expectTranslatedText(page.getByRole('alert'), 'app.admin.emailTest.sent');
      let messageId: string | undefined;
      await expect
        .poll(async () => {
          const data = await (await request.get('http://localhost:8025/api/v1/messages')).json();
          messageId = data.messages.find(
            (message: { ID: string; To: Array<{ Address: string }> }) =>
              message.To.some((to) => to.Address === recipient),
          )?.ID;
          return Boolean(messageId);
        })
        .toBe(true);
      const message = await (
        await request.get(`http://localhost:8025/api/v1/message/${messageId}`)
      ).json();
      for (const body of [message.HTML, message.Text]) {
        expect(body).toContain('Edited test title');
        expect(body).toContain('Edited test description');
        expect(body).toContain('Second line');
        expect(body).not.toContain('app.mail.');
        if (hasLink) {
          expect(body).toContain('https://example.com/gift');
        } else {
          expect(body).not.toContain('Link zum gewünschten Geschenk');
        }
      }
      expect(message.Text.replace(/\r\n/g, '\n')).toContain('Edited test description\nSecond line');
    });
  }
}

for (const template of [
  { id: 'order-ready-for-pickup', name: 'Abholbenachrichtigung' },
  { id: 'order-confirmation-definitive', name: 'Annahmebestätigung' },
]) {
  test(`sends ${template.id} test overrides without changing configured pickup details`, async ({
    page,
    request,
  }) => {
    await loginAsAdmin(page);
    const before = await (
      await page.request.get('http://localhost:8082/admin/configuration')
    ).json();
    const recipient = `pickup-overrides-${Date.now()}@example.com`;
    await page.goto('/admin/email-test');
    await page.getByRole('combobox', { name: 'E-Mail', exact: true }).click();
    await page.getByRole('option').filter({ hasText: template.name }).click();
    await page.getByRole('textbox', { name: 'Empfänger-Adresse' }).fill(recipient);
    await page.getByRole('spinbutton', { name: 'Jahr', exact: true }).fill('2026');
    await page.getByRole('spinbutton', { name: 'Zettelnummer', exact: true }).fill('12');
    await page
      .getByRole('textbox', { name: /Abholdatum und Zeit/ })
      .fill('Testtermin ohne Datumsformat');
    const location = page.getByRole('textbox', { name: /Abholort/ });
    expect(await location.evaluate((element) => element.tagName)).toBe('TEXTAREA');
    await location.fill('Test <Saal>\nTeststrasse 2');
    await page.getByRole('button', { name: 'Senden', exact: true }).click();
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
    expect(message.HTML).toContain('Testtermin ohne Datumsformat');
    expect(message.HTML).toContain('Test &lt;Saal&gt;<br />');
    expect(message.Text.replace(/\r\n/g, '\n')).toContain('Test <Saal>\nTeststrasse 2');
    const after = await (
      await page.request.get('http://localhost:8082/admin/configuration')
    ).json();
    expect(after).toEqual(before);
  });
}

test('sends and previews a review email with general and wish feedback', async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  const recipient = `review-test-${Date.now()}@example.com`;
  await page.goto('/admin/email-test');
  await page.getByRole('combobox', { name: 'E-Mail', exact: true }).click();
  const option = page.getByRole('option').filter({ hasText: 'Änderungen verlangt' });
  await expectTranslatedText(
    option,
    'app.admin.emailTest.templates.order-confirmation-changes_requested',
  );
  await option.click();
  await page.getByRole('textbox', { name: 'Empfänger-Adresse' }).fill(recipient);
  await page.getByRole('spinbutton', { name: 'Jahr', exact: true }).fill('2026');
  await page
    .getByRole('textbox', { name: 'Login-URL', exact: true })
    .fill('http://localhost:4300/login');
  await page
    .getByRole('textbox', { name: /Rückmeldung zum Wunschzettel/ })
    .fill('Review <b>the family text</b>.\nPlease check the details.');
  await page.getByRole('textbox', { name: 'Wunschnummer', exact: true }).fill('12-3');
  await page
    .getByRole('textbox', { name: 'Bearbeiteter Wunschtitel', exact: true })
    .fill('Edited coat title');
  await page
    .getByRole('textbox', { name: /Rückmeldung zum Wunsch \(/ })
    .fill('Review <b>the coat size</b>.\nPlease check the colour.');
  await page.getByRole('button', { name: 'Senden', exact: true }).click();
  await expectTranslatedText(page.getByRole('alert'), 'app.admin.emailTest.sent');

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
    for (const text of [
      '12-3',
      'Edited coat title',
      'Please check the details.',
      'Please check the colour.',
      'http://localhost:4300/login',
    ]) {
      expect(body).toContain(text);
    }
    expect(body).not.toContain('app.mail.');
  }
  expect(message.HTML).toContain('&lt;b&gt;the family text&lt;/b&gt;.<br />');
  expect(message.Text).toContain('Review <b>the coat size</b>. Please check the colour.');

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
      await expectTranslatedText(
        preview.getByRole('heading', { level: 1 }),
        'app.mail.order.confirmation.changes_requested.title',
      );
      await expect(preview.getByRole('link')).toHaveAttribute(
        'href',
        'http://localhost:4300/login',
      );
      await expect(preview.locator('body')).toContainText('Review <b>the family text</b>.');
      await expect(preview.locator('b')).toHaveCount(0);
      expect(
        await preview.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await preview.screenshot({
        path: test.info().outputPath(`review-email-${width}.png`),
        fullPage: true,
      });
    }
  } finally {
    await preview.close();
  }
});

test('sends a pickup QR email whose public fallback renders the identical PNG without a login', async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  const recipient = `pickup-qr-${Date.now()}@example.com`;
  const before = await (await page.request.get('http://localhost:8082/admin/orders')).json();
  const configs = await (
    await page.request.get('http://localhost:8082/admin/configuration')
  ).json();
  const pickupConfigs = configs.filter((config: { variableName: string }) =>
    ['pickup_date', 'pickup_location'].includes(config.variableName),
  );
  expect(pickupConfigs).toHaveLength(2);
  try {
    await page.goto('/admin/configuration');
    const date = page.getByRole('textbox', { name: 'pickup_date', exact: true });
    const location = page.getByRole('textbox', { name: 'pickup_location', exact: true });
    await expect(date).toHaveAttribute('type', 'text');
    expect(await location.evaluate((element) => element.tagName)).toBe('TEXTAREA');
    await date.fill('Samstag, nachmittags – bitte Zeit reservieren');
    await location.fill('Gemeindesaal <West>\nHauptstrasse 1\n8000 Zürich');
    await page.getByRole('button', { name: 'Konfiguration speichern' }).click();
    await expectTranslatedText(page.getByRole('alert'), 'app.admin.configuration.saved');
    await page.reload();
    await expect(date).toHaveValue('Samstag, nachmittags – bitte Zeit reservieren');
    await expect(location).toHaveValue('Gemeindesaal <West>\nHauptstrasse 1\n8000 Zürich');
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
    for (const body of [message.HTML, message.Text]) {
      expect(body).toContain('Samstag, nachmittags – bitte Zeit reservieren');
      expect(body).toContain('Hauptstrasse 1');
      expect(body).toContain('8000 Zürich');
    }
    expect(message.HTML).toContain('Gemeindesaal &lt;West&gt;<br />');
    expect(message.Text.replace(/\r\n/g, '\n')).toContain(
      'Gemeindesaal <West>\nHauptstrasse 1\n8000 Zürich',
    );
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
        await expect(preview.locator('body')).toHaveCSS('background-color', 'rgb(243, 245, 240)');
        await expect(preview.locator('body')).toHaveCSS('color', 'rgb(41, 46, 41)');
        await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
        await expect(card).toHaveCSS('border-top-color', 'rgb(120, 130, 120)');
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
        await expect(button.locator('..')).toHaveCSS('background-color', 'rgb(54, 87, 64)');
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
  } finally {
    for (const config of pickupConfigs) {
      const restored = await page.request.patch(
        `http://localhost:8082/admin/configuration/${config.id}`,
        { headers: await authHeaders(page), data: { value: config.value } },
      );
      expect(restored.status()).toBe(200);
    }
  }
});
