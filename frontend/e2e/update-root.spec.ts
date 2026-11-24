import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test('offers an update on the safe home route, allows later and reloads only after confirmation', async ({
  page,
}) => {
  const baseline = await (await page.request.get('/build-info.json')).json();
  let changed = false;
  await page.route('**/build-info.json?*', (route) =>
    route.fulfill({
      json: changed ? { appVersion: '99.0.0+999', buildId: 'new-test-build' } : baseline,
    }),
  );
  let navigations = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  await page.goto('/');
  await expect(page.locator('.app-footer__version')).toContainText(baseline.appVersion);
  changed = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectTranslatedText(dialog.getByRole('heading'), 'app.update.dialog.title');
  await dialog.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('app-update-notice')).toBeVisible();
  await expect(page.locator('.app-footer__version')).toContainText(baseline.appVersion);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(dialog).toHaveCount(0);
  expect(navigations).toBe(1);
  await page.getByTestId('app-update-notice').getByRole('button').click();
  await expect(dialog).toBeVisible();
  changed = false;
  await dialog.getByRole('button', { name: 'Neu laden', exact: true }).click();
  await expect.poll(() => navigations).toBe(2);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
