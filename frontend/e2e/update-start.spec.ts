import { expect, test } from './support/test';

test('offers an update on a form and retains input after deferring the reload', async ({
  page,
}) => {
  const baseline = await (await page.request.get('/build-info.json')).json();
  let changed = false;
  await page.route('**/build-info.json?*', (route) =>
    route.fulfill({ json: changed ? { ...baseline, buildId: 'new-test-build' } : baseline }),
  );
  let navigations = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  await page.goto('/start');
  const email = page.getByRole('textbox', { name: 'E-Mail-Adresse', exact: true });
  await email.fill('unsaved@example.com');
  changed = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('app-update-notice')).toBeVisible();
  await expect(email).toHaveValue('unsaved@example.com');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await email.fill('still-working@example.com');
  await expect(email).toHaveValue('still-working@example.com');
  expect(navigations).toBe(1);
});
