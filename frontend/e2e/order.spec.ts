import { expect, test, type Page } from './support/test';
import { expectTranslatedText } from './support/assertions';

test.describe('Bestellung route', () => {
  test('saves the order and shows the released Fairgate confirmation', async ({ page }) => {
    let saveRequestReceived = false;
    let logoutRequestReceived = false;

    await page.route('http://localhost:8083/auth/registration-login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'client-1', email: 'client@example.com', group: 'wunschbesteller' },
          group: 'wunschbesteller',
          requiredPasswordReset: true,
          firstAccess: true,
          fairgateUserExists: true,
          childrenCount: 2,
          adultsCount: 2,
          fairgateStatus: 'valid',
          salutation: 'Hallo',
        }),
      });
    });
    await page.route('http://localhost:8083/auth/logout', async (route) => {
      logoutRequestReceived = true;
      await route.fulfill({ status: 204 });
    });
    await page.route('http://localhost:8083/client/order', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            order: null,
            year: 2026,
            fairgateStatus: 'valid',
            fairgateUserExists: true,
            childrenCount: 2,
            adultsCount: 2,
          }),
        });
        return;
      }

      saveRequestReceived = true;
        expect(route.request().postDataJSON()).toMatchObject({
          adultsCount: 2,
          childrenCount: 2,
          text: 'Ich wünsche mir etwas Schönes.',
          items: [{ category: 'gift', description: 'Ein schönes Geschenk', reason: 'Das würde mir Freude machen.' }],
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order: { id: 'order-1', status: 'released' },
          status: 'released',
          fairgateUserExists: true,
        }),
      });
    });

    await page.goto('/client-login?token=registration-token');
    await page.waitForURL('**/bestellung');
    await expect(page.locator('.app-notification')).toContainText(
      'Die Anzahl der Erwachsenen und Kinder wurde aus Fairgate übernommen.',
    );
    await page.locator('input[type="password"]').first().fill('long-enough-password');
    await page.locator('input[type="password"]').nth(1).fill('long-enough-password');
    await page.locator('textarea').fill('Ich wünsche mir etwas Schönes.');
    await page.getByRole('button', { name: 'Wunsch hinzufügen' }).click();
    await page.waitForURL('**/bestellung/wunsch/neu');
    await page.getByRole('combobox', { name: 'Kategorie' }).click();
    await page.getByRole('option', { name: 'Geschenk' }).click();
    await page.locator('textarea').nth(0).fill('Ein schönes Geschenk');
    await page.locator('textarea').nth(1).fill('Das würde mir Freude machen.');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL('**/bestellung');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.waitForURL('**/bestellung/bestaetigung?status=released');
    expect(saveRequestReceived).toBe(true);
    expect(logoutRequestReceived).toBe(true);
    await expect(page.locator('.app-notification')).toContainText(
      'Deine Daten werden den Administratoren zur Prüfung vorgelegt.',
    );
    await expect(page.getByRole('link', { name: 'Zur Login-Seite' })).toHaveAttribute('href', '/login');
  });

  test('edits an existing item before saving the order', async ({ page }) => {
    let savedItems: unknown;
    await mockClientLogin(page, {
      order: orderWithItems('draft', [orderItem('item-1', 'gift', 'Alte Beschreibung', 'Alte Begründung')]),
      onSave: async (route) => {
        savedItems = route.request().postDataJSON().items;
        await fulfillSavedOrder(route);
      },
    });

    await page.getByRole('button', { name: 'Ändern' }).click();
    await page.waitForURL('**/bestellung/wunsch/item-1');
    await page.locator('textarea').nth(0).fill('Neue Beschreibung');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL('**/bestellung');
    await expect(page.locator('tbody tr').first()).toContainText('Neue Beschreibung');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL('**/bestellung/bestaetigung?status=released');

    expect(savedItems).toEqual([
      expect.objectContaining({
        id: 'item-1',
        description: 'Neue Beschreibung',
        reason: 'Alte Begründung',
      }),
    ]);
  });

  test('cancels and confirms deletion of an item', async ({ page }) => {
    await mockClientLogin(page, {
      order: orderWithItems('draft', [
        orderItem('item-1', 'gift', 'Erster Wunsch', 'Erste Begründung'),
        orderItem('item-2', 'voucher', 'Zweiter Wunsch', 'Zweite Begründung'),
      ]),
    });

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await rows.first().getByRole('button', { name: 'Löschen' }).click();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(rows).toHaveCount(2);

    await rows.first().getByRole('button', { name: 'Löschen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Zweiter Wunsch');
  });

  test('keeps an invalid new item on the item editor page', async ({ page }) => {
    await mockClientLogin(page, { order: null });

    await page.getByRole('button', { name: 'Wunsch hinzufügen' }).click();
    await page.waitForURL('**/bestellung/wunsch/neu');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page).toHaveURL(/\/bestellung\/wunsch\/neu$/);
    await expectTranslatedText(
      page.locator('mat-form-field').nth(0).locator('.control-error'),
      'app.order.errors.items.category.required',
    );
    await expectTranslatedText(
      page.locator('mat-form-field').nth(1).locator('.control-error'),
      'app.order.errors.items.description.required',
    );
    await expectTranslatedText(
      page.locator('mat-form-field').nth(2).locator('.control-error'),
      'app.order.errors.items.reason.required',
    );
  });

  test('hides mutations and explains the read-only order status', async ({ page }) => {
    await mockClientLogin(page, {
      order: orderWithItems('released', [orderItem('item-1', 'gift', 'Freigegebener Wunsch', 'Begründung')]),
    });

    await expectTranslatedText(page.locator('.app-notification'), 'app.order.status.released.message');
    await expect(page.getByRole('button', { name: 'Ändern' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Wunsch hinzufügen' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Speichern' })).toHaveCount(0);
  });
});

interface OrderTestOptions {
  order: Record<string, unknown> | null;
  onSave?: (route: import('@playwright/test').Route) => Promise<void>;
}

async function mockClientLogin(page: Page, options: OrderTestOptions): Promise<void> {
  await page.route('http://localhost:8083/auth/registration-login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'client-1', email: 'client@example.com', group: 'wunschbesteller' },
        group: 'wunschbesteller',
        requiredPasswordReset: false,
        firstAccess: false,
        fairgateUserExists: true,
        childrenCount: 2,
        adultsCount: 2,
        fairgateStatus: 'valid',
        salutation: 'Hallo',
      }),
    });
  });
  await page.route('http://localhost:8083/auth/logout', async (route) => {
    await route.fulfill({ status: 204 });
  });
  await page.route('http://localhost:8083/client/order', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order: options.order,
          year: 2026,
          fairgateStatus: 'valid',
          fairgateUserExists: true,
          childrenCount: 2,
          adultsCount: 2,
        }),
      });
      return;
    }
    if (options.onSave) {
      await options.onSave(route);
      return;
    }
    await fulfillSavedOrder(route);
  });

  await page.goto('/client-login?token=registration-token');
  await page.waitForURL('**/bestellung');
}

function orderWithItems(status: string, items: Record<string, unknown>[]): Record<string, unknown> {
  return {
    id: 'order-1',
    userId: 'client-1',
    year: 2026,
    status,
    adultsCount: 2,
    childrenCount: 2,
    originalText: 'Warum ich mir das wünsche',
    currentText: 'Warum ich mir das wünsche',
    items,
    fairgateStatus: 'valid',
  };
}

function orderItem(
  id: string,
  category: string,
  description: string,
  reason: string,
): Record<string, unknown> {
  return {
    id,
    orderId: 'order-1',
    category,
    originalDescription: description,
    currentDescription: description,
    originalReason: reason,
    currentReason: reason,
    status: 'submitted',
  };
}

async function fulfillSavedOrder(route: import('@playwright/test').Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      order: { id: 'order-1', status: 'released' },
      status: 'released',
      fairgateUserExists: true,
    }),
  });
}
