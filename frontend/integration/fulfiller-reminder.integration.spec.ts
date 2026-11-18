import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';

const apiUrl = 'http://localhost:8082';

async function runPhp(script: string, ...args: string[]): Promise<string> {
  const { stdout } = await promisify(execFile)('docker', [
    'compose',
    '-f',
    resolve(process.cwd(), '..', 'docker-compose.integration.yml'),
    'exec',
    '-T',
    'integration-backend',
    'php',
    `/var/www/html/${script}`,
    ...args,
  ]);
  return stdout;
}

test('saves ISO reminder dates and sends one bundled email through concurrent hourly batches', async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  const headers = await authHeaders(page);
  const configs = await (await page.request.get(`${apiUrl}/admin/configuration`)).json();
  const schedule = configs.find(
    (config: { variableName: string }) => config.variableName === 'fulfiller_reminder_dates',
  );
  const handover = configs.filter((config: { variableName: string }) =>
    ['fulfiller_handover_date', 'fulfiller_handover_time', 'fulfiller_handover_location'].includes(
      config.variableName,
    ),
  );
  const year = configs.find(
    (config: { variableName: string }) => config.variableName === 'campaign_year',
  ).value;
  const recipient = `reminder-${Date.now()}@example.com`;
  const fixture = JSON.parse(
    await runPhp('tests/Support/SeedFulfillerReminderFixture.php', recipient, year),
  );
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
  try {
    expect(schedule.inputType).toBe('textarea');
    const handoverValues: Record<string, string> = {
      fulfiller_handover_date: '17.–19. Dezember 2026',
      fulfiller_handover_time: '10–12 Uhr',
      fulfiller_handover_location: 'Saal A\nMusterstrasse 1',
    };
    for (const config of handover) {
      const response = await page.request.patch(`${apiUrl}/admin/configuration/${config.id}`, {
        headers,
        data: { value: handoverValues[config.variableName] },
      });
      expect(response.status()).toBe(200);
    }
    await page.goto('/admin/configuration');
    const field = page.getByRole('textbox', { name: 'fulfiller_reminder_dates', exact: true });
    expect(await field.evaluate((element) => element.tagName)).toBe('TEXTAREA');
    const dates = `2099-12-01\n${today}\n${today}`;
    await field.fill(dates);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/admin/configuration/${schedule.id}`) &&
        response.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Konfiguration speichern' }).click();
    expect((await saved).status()).toBe(200);
    await page.reload();
    await expect(field).toHaveValue(dates);

    await Promise.all([runPhp('bin/process-orders.php'), runPhp('bin/process-orders.php')]);
    const messagesForRecipient = async () => {
      const data = await (await request.get('http://localhost:8025/api/v1/messages')).json();
      return data.messages.filter((message: { To: Array<{ Address: string }> }) =>
        message.To.some((to) => to.Address === recipient),
      );
    };
    await expect.poll(async () => (await messagesForRecipient()).length).toBe(1);
    const messages = await messagesForRecipient();
    const message = await (
      await request.get(`http://localhost:8025/api/v1/message/${messages[0].ID}`)
    ).json();
    for (const body of [message.HTML, message.Text]) {
      expect(body).toContain(
        'Danke, dass du Weihnachtswünsche erfüllst! Gerne erinnern wir dich an die bevorstehenden Abgabetermine für die Geschenke zu folgenden Wünschen:',
      );
      expect(body).not.toContain('noch kein Geschenk eingegangen');
      expect(body).toContain(`${fixture.orderNumber}-1`);
      expect(body).toContain(`${fixture.orderNumber}-2`);
      expect(body).not.toContain(`${fixture.orderNumber}-3`);
      expect(body).not.toContain(`${fixture.orderNumber}-4`);
      expect(body).toContain('Musterstrasse 1');
      expect(body).toContain('17.–19. Dezember 2026');
      expect(body).toContain('10–12 Uhr');
      expect(body).toContain('per Post');
      expect(body).not.toContain('app.mail.');
    }
    expect(message.HTML).toContain('Saal A<br />');
    expect(message.Text).toMatch(/Saal A\r?\nMusterstrasse 1/);
    await runPhp('bin/process-orders.php');
    expect(await messagesForRecipient()).toHaveLength(1);
  } finally {
    for (const config of [schedule, ...handover]) {
      expect(
        (
          await page.request.patch(`${apiUrl}/admin/configuration/${config.id}`, {
            headers,
            data: { value: config.value },
          })
        ).status(),
      ).toBe(200);
    }
    expect(
      (await page.request.delete(`${apiUrl}/admin/users/${fixture.userId}`, { headers })).status(),
    ).toBe(200);
  }
});
