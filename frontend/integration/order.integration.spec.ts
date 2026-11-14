import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { loginAsAdmin } from './support/admin-login';
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

test('returns order and wish feedback to the requester after an admin review', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const apiUrl = 'http://localhost:8082';
  const email = `feedback+fair1-${Date.now()}@example.com`;
  const login = await request.post(`${apiUrl}/auth/registration-login`, {
    data: { token: issueRegistrationToken(email) },
  });
  expect(login.status()).toBe(200);
  const csrf = (await request.storageState()).cookies.find(
    ({ name }) => name === 'XSRF-TOKEN',
  )!.value;
  const saved = await request.post(`${apiUrl}/client/order`, {
    headers: { 'X-CSRF-Token': csrf },
    data: {
      mode: 'draft',
      text: 'Original family text',
      adultsCount: 2,
      childrenCount: 3,
      password: 'long-enough-password',
      passwordConfirmation: 'long-enough-password',
      items: [
        {
          category: 'gift',
          personType: 'adult',
          personIndex: 1,
          title: 'Original wish title',
          description: 'Original wish text',
        },
      ],
    },
  });
  expect(saved.status()).toBe(200);
  const draft = (await saved.json()).order;
  expect(draft.adminNotes).toBeNull();
  expect(draft.items[0].adminNotes).toBeNull();

  await loginAsAdmin(page);
  const headers = await authHeaders(page);
  try {
    const reviewed = await page.request.patch(`${apiUrl}/admin/orders/${draft.id}`, {
      headers,
      data: {
        action: 'rejectOrder',
        order: {
          ...draft,
          currentText: 'Edited family text',
          adminNotes: 'Please review the family text',
        },
        items: [
          {
            ...draft.items[0],
            publicationStatus: 'rejected',
            currentTitle: 'Edited wish title',
            currentDescription: 'Edited wish text',
            adminNotes: 'Please review the wish text',
          },
        ],
      },
    });
    expect(reviewed.status()).toBe(200);

    const overview = await request.get(`${apiUrl}/client/order`);
    expect(overview.status()).toBe(200);
    expect(await overview.json()).toMatchObject({
      canEdit: true,
      order: {
        id: draft.id,
        status: 'changes_requested',
        originalText: 'Original family text',
        currentText: 'Edited family text',
        adminNotes: 'Please review the family text',
        items: [
          {
            id: draft.items[0].id,
            originalTitle: 'Original wish title',
            currentTitle: 'Edited wish title',
            originalDescription: 'Original wish text',
            currentDescription: 'Edited wish text',
            adminNotes: 'Please review the wish text',
          },
        ],
      },
    });

    const requesterContext = await browser.newContext({ baseURL });
    try {
      const requesterPage = await requesterContext.newPage();
      await requesterPage.goto(
        `/client-login?token=${encodeURIComponent(issueRegistrationToken(email))}`,
      );
      await requesterPage.waitForURL('**/bestellung');
      const original = requesterPage.locator('[aria-labelledby="original-order-text-heading"]');
      await expectTranslatedText(
        original.getByRole('heading'),
        'app.order.publicText.originalLabel',
      );
      await expect(original.locator('p')).toHaveText('Original family text');
      const current = requesterPage.getByRole('textbox', {
        name: 'Aktuelle Fassung deines Textes',
      });
      await expect(current).toHaveValue('Edited family text');
      await expect(current).toBeEditable();
      const notification = requesterPage.locator('.app-notification');
      await expectTranslatedText(notification, 'app.order.status.changes_requested.title');
      await expect(notification).toContainText('Please review the family text');
      await current.fill('Requester-approved family text');
      await expect(original.locator('p')).toHaveText('Original family text');

      const wish = requesterPage.getByRole('row').filter({ hasText: 'Edited wish title' });
      await expectTranslatedText(wish.locator('app-info-box'), 'app.order.items.feedback');
      await expect(wish.locator('app-info-box')).toContainText('Please review the wish text');
      await wish.getByRole('button', { name: 'Ändern' }).click();
      await requesterPage.waitForURL(`**/bestellung/wunsch/${draft.items[0].id}`);
      const originalTitle = requesterPage.locator(
        '[aria-labelledby="original-wish-title-heading"] p',
      );
      const originalDescription = requesterPage.locator(
        '[aria-labelledby="original-wish-description-heading"] p',
      );
      await expect(originalTitle).toHaveText('Original wish title');
      await expect(originalDescription).toHaveText('Original wish text');
      const editedTitle = requesterPage.getByRole('textbox', { name: 'Aktueller Wunschtitel' });
      const editedDescription = requesterPage.getByRole('textbox', {
        name: 'Aktuelle Wunschbeschreibung',
      });
      await expect(editedTitle).toHaveValue('Edited wish title');
      await expect(editedDescription).toHaveValue('Edited wish text');
      await expect(requesterPage.locator('app-item-editor app-info-box')).toContainText(
        'Please review the wish text',
      );
      await editedTitle.fill('Requester-approved wish title');
      await editedDescription.fill('Requester-approved wish text');
      await expect(originalTitle).toHaveText('Original wish title');
      await expect(originalDescription).toHaveText('Original wish text');
    } finally {
      await requesterContext.close();
    }
  } finally {
    const deleted = await page.request.delete(`${apiUrl}/admin/users/${draft.userId}`, {
      headers,
    });
    expect(deleted.status()).toBe(200);
  }
});
