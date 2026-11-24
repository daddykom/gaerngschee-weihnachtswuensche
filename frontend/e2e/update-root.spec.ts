import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test('offers an update on the home route, allows later and reloads only after confirmation', async ({
  page,
}) => {
  const baseline = await (await page.request.get('/build-info.json')).json();
  let changed = true;
  const metadataRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/build-info.json')
      metadataRequests.push(request.url());
  });
  await page.clock.install();
  await page.route('http://localhost:8083/public/configuration**', (route) =>
    route.fulfill({
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'X-App-Build',
        'X-App-Build': changed ? 'new-test-build' : baseline.buildId,
      },
      json: [
        { variableName: 'campaign_start_date', value: '2000-01-01' },
        { variableName: 'campaign_end_date', value: '2999-12-31' },
      ],
    }),
  );
  let navigations = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  await page.goto('/');
  await expect(page.locator('.app-footer__version')).toContainText(baseline.appVersion);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectTranslatedText(dialog.getByRole('heading'), 'app.update.dialog.title');
  await dialog.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('app-update-notice')).toBeVisible();
  await expect(page.locator('.app-footer__version')).toContainText(baseline.appVersion);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.fastForward(120_000);
  await expect(dialog).toHaveCount(0);
  expect(metadataRequests).toEqual([]);
  expect(navigations).toBe(1);
  await page.getByTestId('app-update-notice').getByRole('button').click();
  await expect(dialog).toBeVisible();
  changed = false;
  await dialog.getByRole('button', { name: 'Neu laden', exact: true }).click();
  await expect.poll(() => navigations).toBe(2);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
