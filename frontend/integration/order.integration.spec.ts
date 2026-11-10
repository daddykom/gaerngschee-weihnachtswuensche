import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { issueRegistrationToken } from './support/registration-token';

test('saves a draft, reloads it and submits it through the real backend', async ({ page }) => {
  const token = issueRegistrationToken(`draft+fair1-${Date.now()}@example.com`);
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
  expect((await draftSave).status()).toBe(200);
  await expectTranslatedText(page.getByRole('alert'), 'app.order.notifications.draftSaved');
  await page.reload();
  await expect(page.locator('tbody')).toContainText('Winter coat');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveValue('My current situation');
  await page.getByRole('button', { name: 'Einreichen', exact: true }).click();
  const submission = page.waitForResponse(
    (response) =>
      response.url().endsWith('/client/order') && response.request().method() === 'POST',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Einreichen', exact: true }).click();
  expect((await submission).status()).toBe(200);
  await expect(page).toHaveURL(/\/bestellung\/bestaetigung\?status=released$/);
});
