import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';

const executeFile = promisify(execFile);
const apiUrl = 'http://localhost:8082';

async function runPhp(script: string, ...args: string[]): Promise<string> {
  const { stdout } = await executeFile('docker', [
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

test('previews legacy acceptance emails, queues concurrent backfills once and delivers through the existing batch', async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  const headers = await authHeaders(page);
  const configs = await (await page.request.get(`${apiUrl}/admin/configuration`)).json();
  const pickupConfigs = configs.filter((config: { variableName: string }) =>
    ['pickup_date', 'pickup_location'].includes(config.variableName),
  );
  expect(pickupConfigs).toHaveLength(2);
  const year = String(3000 + Math.floor(Math.random() * 5000));
  const recipient = `acceptance-backfill-${Date.now()}@example.com`;
  const fixture = JSON.parse(
    await runPhp('tests/Support/SeedAcceptanceBackfillFixture.php', recipient, year),
  );
  const inspect = async () =>
    JSON.parse(
      await runPhp('tests/Support/SeedAcceptanceBackfillFixture.php', 'inspect', fixture.orderId),
    );
  try {
    const before = await inspect();
    expect(before).toEqual({
      order: { status: 'definitive', acceptance_email_sent_at: null },
      pending: 0,
    });
    const preview = await runPhp('bin/backfill-order-acceptance.php', `--year=${year}`);
    expect(preview).toContain('Eligible wish lists: 1. Unique recipients: 1.');
    expect(preview).toContain('Preview only.');
    expect(await inspect()).toEqual(before);

    for (const config of pickupConfigs) {
      const updated = await page.request.patch(`${apiUrl}/admin/configuration/${config.id}`, {
        headers,
        data: { value: '' },
      });
      expect(updated.status()).toBe(200);
    }
    await expect(
      runPhp('bin/backfill-order-acceptance.php', `--year=${year}`, '--send'),
    ).rejects.toThrow('Configure pickup_date and pickup_location');
    expect(await inspect()).toEqual(before);

    for (const config of pickupConfigs) {
      const updated = await page.request.patch(`${apiUrl}/admin/configuration/${config.id}`, {
        headers,
        data: {
          value:
            config.variableName === 'pickup_date'
              ? 'Samstag, 14–17 Uhr'
              : 'Gemeindesaal\nHauptstrasse 1',
        },
      });
      expect(updated.status()).toBe(200);
    }
    const outputs = await Promise.all(
      [0, 1].map(() => runPhp('bin/backfill-order-acceptance.php', `--year=${year}`, '--send')),
    );
    expect(outputs.filter((output) => output.includes('Queued: 1.'))).toHaveLength(1);
    expect((await inspect()).pending).toBe(1);
    expect((await inspect()).order).toEqual(before.order);
    expect(await runPhp('bin/backfill-order-acceptance.php', `--year=${year}`, '--send')).toContain(
      'Queued: 0.',
    );

    const messagesForRecipient = async () => {
      const data = await (await request.get('http://localhost:8025/api/v1/messages')).json();
      return data.messages.filter((message: { To: Array<{ Address: string }> }) =>
        message.To.some((to) => to.Address === recipient),
      );
    };
    expect(await messagesForRecipient()).toHaveLength(0);
    await runPhp('bin/process-orders.php');
    await expect.poll(async () => (await messagesForRecipient()).length).toBe(1);
    const messages = await messagesForRecipient();
    const message = await (
      await request.get(`http://localhost:8025/api/v1/message/${messages[0].ID}`)
    ).json();
    for (const body of [message.HTML, message.Text]) {
      expect(body).toContain('Samstag, 14–17 Uhr');
      expect(body).toContain('Hauptstrasse 1');
      expect(body).not.toContain('app.mail.');
    }
    const after = await inspect();
    expect(after.order.status).toBe('definitive');
    expect(after.order.acceptance_email_sent_at).not.toBeNull();
    expect(after.pending).toBe(0);
    expect(await runPhp('bin/backfill-order-acceptance.php', `--year=${year}`, '--send')).toContain(
      'Queued: 0.',
    );
    await runPhp('bin/process-orders.php');
    expect(await messagesForRecipient()).toHaveLength(1);
  } finally {
    for (const config of pickupConfigs) {
      const restored = await page.request.patch(`${apiUrl}/admin/configuration/${config.id}`, {
        headers,
        data: { value: config.value },
      });
      expect(restored.status()).toBe(200);
    }
    const deleted = await page.request.delete(`${apiUrl}/admin/users/${fixture.userId}`, {
      headers,
    });
    expect(deleted.status()).toBe(200);
  }
});
