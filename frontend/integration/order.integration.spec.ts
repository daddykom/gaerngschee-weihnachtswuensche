import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { authHeaders, resetIntegrationRateLimits } from './support/auth-header';
import { issueRegistrationToken } from './support/registration-token';

test.beforeEach(() => resetIntegrationRateLimits());

test('saves a draft, reloads it and submits it through the real backend', async ({ page }) => {
  const email = `draft+fair1-${Date.now()}@example.com`;
  const token = issueRegistrationToken(email);
  await page.goto(`/client-login?token=${encodeURIComponent(token)}`);
  await page.waitForURL('**/bestellung');
  await page.locator('input[type="password"]').first().fill('long-enough-password');
  await page.locator('input[type="password"]').nth(1).fill('long-enough-password');
  const prematureSaves: unknown[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/client/order') && request.method() === 'POST') {
      prematureSaves.push(request.postDataJSON());
    }
  });
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(
    page
      .locator('mat-form-field')
      .filter({ has: page.locator('textarea') })
      .locator('.control-error'),
  ).toBeVisible();
  expect(prematureSaves).toHaveLength(0);
  await page.locator('textarea').fill('My current situation');
  await page.getByRole('button', { name: 'Wunsch hinzufügen' }).click();
  await page.getByRole('combobox', { name: 'Für wen ist der Wunsch?' }).click();
  await page.getByRole('option', { name: 'Erwachsener 1', exact: true }).click();
  await page.getByRole('combobox', { name: 'Kategorie' }).click();
  await page.getByRole('option', { name: 'Geschenk', exact: true }).click();
  await page.getByRole('textbox', { name: 'Wunschtitel' }).fill('Winter coat');
  await page
    .getByRole('textbox', { name: 'Wunschbeschreibung', exact: true })
    .fill('A warm winter coat');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.waitForURL('**/bestellung');
  const draftSave = page.waitForResponse(
    (response) =>
      response.url().endsWith('/client/order') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  const draftResponse = await draftSave;
  expect(draftResponse.status()).toBe(200);
  const savedOrder = (await draftResponse.json()).order;
  expect(savedOrder.fairgateAdultsCount).toBe(2);
  expect(savedOrder.fairgateChildrenCount).toBe(3);
  await expectTranslatedText(page.getByRole('alert'), 'app.order.notifications.draftSaved');
  await page.reload();
  await expect(page.locator('tbody')).toContainText('Winter coat');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveValue('My current situation');

  await page.goto('/');
  const logoutResponse = page.waitForResponse((response) =>
    response.url().endsWith('/auth/logout'),
  );
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(page.getByRole('button', { name: 'Abmelden', exact: true })).toHaveCount(0);
  const returningLogin = page.waitForResponse((response) =>
    response.url().endsWith('/auth/registration-login'),
  );
  await page.goto(`/client-login?token=${encodeURIComponent(issueRegistrationToken(email))}`);
  const returningResponse = await returningLogin;
  expect(returningResponse.status()).toBe(200);
  expect(await returningResponse.json()).toMatchObject({ firstAccess: false });
  await page.waitForURL('**/bestellung');
  await expect(page.locator('tbody')).toContainText('Winter coat');
  const overview = await page.request.get('http://localhost:8082/client/order');
  expect(overview.status()).toBe(200);
  expect(await overview.json()).toMatchObject({
    order: {
      id: savedOrder.id,
      fairgateAdultsCount: 2,
      fairgateChildrenCount: 3,
    },
    adultsCount: 2,
    childrenCount: 3,
  });
  await page.getByRole('button', { name: 'Einreichen', exact: true }).click();
  const submission = page.waitForResponse(
    (response) =>
      response.url().endsWith('/client/order') && response.request().method() === 'POST',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Einreichen', exact: true }).click();
  expect((await submission).status()).toBe(200);
  await expect(page).toHaveURL(/\/bestellung\/bestaetigung\?status=released$/);
});

test('does not create an order when the client leaves without saving', async ({ page }) => {
  const email = `abandoned+fair1-${Date.now()}@example.com`;
  for (let entry = 0; entry < 2; entry++) {
    const login = await page.request.post('http://localhost:8082/auth/registration-login', {
      data: { token: issueRegistrationToken(email) },
    });
    expect(login.status()).toBe(200);
    expect(await login.json()).toMatchObject({
      firstAccess: true,
      adultsCount: 2,
      childrenCount: 3,
    });
    const overview = await page.request.get('http://localhost:8082/client/order');
    expect(overview.status()).toBe(200);
    expect(await overview.json()).toMatchObject({
      order: null,
      adultsCount: 2,
      childrenCount: 3,
    });
    const logout = await page.request.post('http://localhost:8082/auth/logout', {
      headers: await authHeaders(page),
    });
    expect(logout.status()).toBe(204);
  }
});
