import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';

const executeFile = promisify(execFile);
const apiUrl = 'http://localhost:8082';

async function fixtureCommand(...args: string[]): Promise<string> {
  const { stdout } = await executeFile('docker', [
    'compose',
    '-f',
    resolve(process.cwd(), '..', 'docker-compose.integration.yml'),
    'exec',
    '-T',
    'integration-backend',
    'php',
    '/var/www/html/tests/Support/SeedOrderItemImageFixture.php',
    ...args,
  ]);
  return stdout;
}

test.describe('Admin wish image API', () => {
  let fixture: {
    ownerId: string;
    userId: string;
    userEmail: string;
    orderId: string;
    itemId: string;
    images: string[];
  };
  let imageUrl: string;

  test.beforeEach(async ({ page }) => {
    fixture = JSON.parse(await fixtureCommand('create'));
    imageUrl = `${apiUrl}/admin/orders/${fixture.orderId}/items/${fixture.itemId}/image`;
    await loginAsAdmin(page);
  });

  test.afterEach(async () => {
    if (fixture) {
      await fixtureCommand('cleanup', fixture.ownerId, fixture.userId);
    }
  });

  test('persists binary images separately, replaces safely and removes without exposing image bytes in orders', async ({
    page,
  }) => {
    const headers = await authHeaders(page);
    const metadata = () =>
      page.request.get(`${imageUrl}/metadata`).then((response) => response.json());
    const inspect = async () => JSON.parse(await fixtureCommand('inspect', fixture.itemId));
    const upload = (buffer: Buffer, revision: number) =>
      page.request.post(imageUrl, {
        headers,
        multipart: {
          revision: String(revision),
          image: { name: 'untrusted.svg', mimeType: 'image/svg+xml', buffer },
        },
      });
    const beforeOrders = await (await page.request.get(`${apiUrl}/admin/orders`)).json();
    const before = beforeOrders.orders.find(
      (order: { id: string }) => order.id === fixture.orderId,
    );
    expect(await metadata()).toEqual({ revision: 0, image: null });
    const png = Buffer.from(fixture.images[0], 'base64');
    // Cross the old 64 KB limit and verify the complete accepted 5 MB input boundary.
    const largePng = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024 - png.length)]);
    const first = await upload(largePng, 0);
    expect(first.status()).toBe(200);
    const firstState = await first.json();
    expect(firstState).toMatchObject({
      revision: 1,
      image: { mimeType: 'image/png', width: 12, height: 8 },
    });
    const image = await page.request.get(imageUrl);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');
    expect(image.headers()['cache-control']).toContain('private');
    expect(image.headers()['cache-control']).toContain('no-store');
    expect(image.headers()['x-content-type-options']).toContain('nosniff');
    const bytes = await image.body();
    const stored = await inspect();
    expect(stored.checksum).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(Number(stored.byte_size)).toBe(bytes.length);
    expect(bytes.length).toBeLessThan(65536);

    for (const [index, mimeType] of ['image/jpeg', 'image/webp'].entries()) {
      const replacement = await upload(Buffer.from(fixture.images[index + 1], 'base64'), index + 1);
      expect(replacement.status()).toBe(200);
      expect(await replacement.json()).toMatchObject({
        revision: index + 2,
        image: { mimeType, width: 12, height: 8 },
      });
    }
    expect((await upload(png, 0)).status()).toBe(409);
    const current = await metadata();
    expect((await upload(Buffer.from('<svg/>'), 3)).status()).toBe(422);
    expect(await metadata()).toEqual(current);
    expect((await page.request.delete(imageUrl, { headers, data: { revision: 2 } })).status()).toBe(
      409,
    );
    expect((await page.request.delete(imageUrl, { headers, data: { revision: 3 } })).status()).toBe(
      200,
    );
    expect(await metadata()).toEqual({ revision: 4, image: null });
    expect((await inspect()).id).toBeNull();
    expect((await page.request.get(imageUrl)).status()).toBe(404);
    expect((await upload(png, 0)).status()).toBe(409);

    const afterOrders = await (await page.request.get(`${apiUrl}/admin/orders`)).json();
    const after = afterOrders.orders.find((order: { id: string }) => order.id === fixture.orderId);
    const { updatedAt: beforeUpdatedAt, ...beforeItem } = before.items[0];
    const { updatedAt: afterUpdatedAt, ...afterItem } = after.items[0];
    expect(afterItem).toEqual(beforeItem);
    expect(JSON.stringify(afterOrders)).not.toContain('image_data');
    expect(JSON.stringify(afterOrders)).not.toContain(fixture.images[0]);
  });

  test('enforces permissions, CSRF, upload limits and the order-item association', async ({
    page,
    request,
  }) => {
    const headers = await authHeaders(page);
    const png = Buffer.from(fixture.images[0], 'base64');
    const multipart = {
      revision: '0',
      image: { name: 'image.png', mimeType: 'image/png', buffer: png },
    };
    expect((await request.get(imageUrl)).status()).toBe(401);
    expect((await request.get(`${imageUrl}/metadata`)).status()).toBe(401);
    expect((await request.post(imageUrl, { multipart })).status()).toBe(401);
    expect((await request.delete(imageUrl, { data: { revision: 0 } })).status()).toBe(401);
    expect((await page.request.post(imageUrl, { multipart })).status()).toBe(403);
    expect((await page.request.delete(imageUrl, { data: { revision: 0 } })).status()).toBe(403);
    const oversized = await page.request.post(imageUrl, {
      headers,
      multipart: {
        ...multipart,
        image: { ...multipart.image, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
      },
    });
    expect(oversized.status()).toBe(413);
    expect((await oversized.json()).error.code).toBe('IMAGE_TOO_LARGE');
    const mismatch = imageUrl.replace(fixture.orderId, 'another-order');
    expect((await page.request.post(mismatch, { headers, multipart })).status()).toBe(404);
    expect((await page.request.get(`${mismatch}/metadata`)).status()).toBe(404);
    expect((await page.request.delete(mismatch, { headers, data: { revision: 0 } })).status()).toBe(
      404,
    );

    const login = await request.post(`${apiUrl}/auth/login`, {
      data: { email: fixture.userEmail, password: 'image-fixture-password' },
    });
    expect(login.status()).toBe(200);
    await request.get(`${apiUrl}/auth/session-status`);
    const state = await request.storageState();
    const csrf = state.cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')!.value;
    const userHeaders = { 'X-CSRF-Token': csrf };
    expect((await request.get(imageUrl)).status()).toBe(404);
    expect((await request.get(`${imageUrl}/metadata`)).status()).toBe(404);
    expect((await request.post(imageUrl, { headers: userHeaders, multipart })).status()).toBe(404);
    expect(
      (await request.delete(imageUrl, { headers: userHeaders, data: { revision: 0 } })).status(),
    ).toBe(404);
    expect(await (await page.request.get(`${imageUrl}/metadata`)).json()).toEqual({
      revision: 0,
      image: null,
    });
    const oversizedJson = await page.request.patch(`${apiUrl}/admin/orders/${fixture.orderId}`, {
      headers,
      data: { padding: 'x'.repeat(70000) },
    });
    expect(oversizedJson.status()).toBe(413);
  });

  test('accepts only one concurrent upload with the same revision', async ({ page }) => {
    const headers = await authHeaders(page);
    const responses = await Promise.all(
      fixture.images.slice(0, 2).map((image) =>
        page.request.post(imageUrl, {
          headers,
          multipart: {
            revision: '0',
            image: {
              name: 'wish',
              mimeType: 'application/octet-stream',
              buffer: Buffer.from(image, 'base64'),
            },
          },
        }),
      ),
    );
    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
    const state = await (await page.request.get(`${imageUrl}/metadata`)).json();
    expect(state.revision).toBe(1);
    expect(state.image).not.toBeNull();
  });
});
