import { type Page } from './test';

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.route('http://localhost:8083/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'admin-1', email: 'admin@example.com', group: 'admin' },
        group: 'admin',
        requiredPasswordReset: false,
      }),
    });
  });
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@example.com');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('input[type="password"]').fill('secret');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL('**/admin/overview');
}

export async function mockOrders(page: Page, order: Record<string, unknown>): Promise<void> {
  await page.route('http://localhost:8083/admin/orders**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [order], statuses: ['released'], categories: ['gift'] }),
    });
  });
}

export function orderFixture(): Record<string, unknown> {
  return {
    id: 'order-1',
    userId: 'client-1',
    requesterEmail: 'client@example.com',
    year: 2026,
    orderNumber: null,
    status: 'released',
    adultsCount: 1,
    childrenCount: 1,
    originalText: 'Originaler Ordertext',
    currentText: 'Aktueller Ordertext',
    adminNotes: null,
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        itemNumber: null,
        category: 'gift',
        originalDescription: 'Originalbeschreibung',
        currentDescription: 'Aktuelle Beschreibung',
        originalReason: 'Originalbegründung',
        currentReason: 'Aktuelle Begründung',
        publicationStatus: 'submitted',
        fulfillmentStatus: 'available',
        adminNotes: null,
      },
    ],
    createdAt: null,
    updatedAt: null,
  };
}
