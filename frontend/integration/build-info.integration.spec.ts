import { expect, test } from '@playwright/test';

test('exposes the installed frontend build on real API responses without losing event headers', async ({
  request,
  page,
}) => {
  const info = await (await request.get('/build-info.json')).json();
  expect(info.appVersion).toMatch(/^\d+\.\d+\.\d+(?:\+\d+)?$/);
  expect(info.buildId).toMatch(/^[a-f0-9-]{36}$/);
  const response = await request.get('http://localhost:8082/public/configuration');
  expect(response.status()).toBe(200);
  expect(response.headers()['x-app-build']).toBe(info.buildId);
  expect(response.headers()['access-control-expose-headers']).toContain('X-App-Build');
  for (const header of Object.keys(response.headers()).filter((name) =>
    name.startsWith('x-event-'),
  )) {
    expect(response.headers()['access-control-expose-headers'].toLowerCase()).toContain(header);
  }
  await page.goto('/');
  await expect(page.locator('.app-footer__version')).toContainText(info.appVersion);
  await expect(page.getByTestId('app-update-notice')).toHaveCount(0);
});
