import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { expect, test } from './support/test';

test('replaces an installed worker at its old URL and removes only Angular caches', async ({
  page,
}) => {
  const safetyWorker = readFileSync(resolve(__dirname, '../public/ngsw-worker.js'), 'utf8');
  const oldWorker = `
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', (event) => {
      if (event.request.mode === 'navigate') {
        event.respondWith(new Response('<!doctype html><title>Old cached app</title>', {
          headers: { 'Content-Type': 'text/html' }
        }));
      }
    });
  `;
  let retired = false;
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/ngsw-worker.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(retired ? safetyWorker : oldWorker);
    } else {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Current app</title>');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    await page.goto(origin);
    await page.evaluate(async () => {
      await caches.open('ngsw:/retired-build');
      await caches.open('unrelated-cache');
      await navigator.serviceWorker.register('/ngsw-worker.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.reload();
    await expect(page).toHaveTitle('Old cached app');

    retired = true;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error('Expected the old worker to still be registered');
      await registration.update();
    });
    await expect
      .poll(() =>
        page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
      )
      .toBe(0);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['unrelated-cache']);

    await page.reload();
    await expect(page).toHaveTitle('Current app');
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
