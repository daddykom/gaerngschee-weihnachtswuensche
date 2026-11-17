import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';

test('aggregates MariaDB campaign data across all statuses and displays the real API response', async ({
  page,
  request,
}) => {
  const apiUrl = 'http://localhost:8082';
  expect((await request.get(`${apiUrl}/admin/statistics`)).status()).toBe(401);
  await loginAsAdmin(page);
  const headers = await authHeaders(page);
  const beforeResponse = await page.request.get(`${apiUrl}/admin/statistics`);
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json();
  const { stdout } = await promisify(execFile)('docker', [
    'compose',
    '-f',
    resolve(process.cwd(), '..', 'docker-compose.integration.yml'),
    'exec',
    '-T',
    'integration-backend',
    'php',
    '/var/www/html/tests/Support/SeedStatisticsFixture.php',
    String(before.year),
    `statistics-${Date.now()}`,
  ]);
  const fixture = JSON.parse(stdout);
  try {
    const expected = {
      year: before.year,
      orderCount: before.orderCount + 8,
      wishCount: before.wishCount + 8,
      availableCount: before.availableCount + 3,
      pendingConfirmationCount: before.pendingConfirmationCount + 1,
      reservedCount: before.reservedCount + 2,
      receivedCount: before.receivedCount + 1,
      completedCount: before.completedCount + 1,
    };
    const response = await page.request.get(
      `${apiUrl}/admin/statistics?year=1900&status[]=definitive&category[]=gift`,
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(expected);
    await page.goto('/admin/statistics');
    for (const [id, value] of [
      ['order-count', expected.orderCount],
      ['wish-count', expected.wishCount],
      ['available-count', expected.availableCount],
      ['pending-confirmation-count', expected.pendingConfirmationCount],
      ['reserved-count', expected.reservedCount],
      ['received-count', expected.receivedCount],
      ['completed-count', expected.completedCount],
    ])
      await expect(page.getByTestId(`statistics-${id}`)).toHaveText(String(value));
  } finally {
    for (const id of fixture.userIds) {
      expect((await page.request.delete(`${apiUrl}/admin/users/${id}`, { headers })).status()).toBe(
        200,
      );
    }
  }
  expect(await (await page.request.get(`${apiUrl}/admin/statistics`)).json()).toEqual(before);
});
