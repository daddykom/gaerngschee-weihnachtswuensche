import { expect, test } from './support/test';

test('offers an update on a form and retains input after deferring the reload', async ({
  page,
}) => {
  await page.route('http://localhost:8083/public/start', (route) =>
    route.fulfill({
      status: 503,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'X-App-Build',
        'X-App-Build': 'new-test-build',
      },
      json: { error: { code: 'REQUEST_FAILED' } },
    }),
  );
  let navigations = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  await page.goto('/start');
  const email = page.getByRole('textbox', { name: 'E-Mail-Adresse', exact: true });
  await email.fill('unsaved@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByTestId('app-update-notice')).toBeVisible();
  await expect(email).toHaveValue('unsaved@example.com');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await email.fill('still-working@example.com');
  const repeatedResponse = page.waitForResponse('http://localhost:8083/public/start');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await repeatedResponse;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(email).toHaveValue('still-working@example.com');
  expect(navigations).toBe(1);
});
