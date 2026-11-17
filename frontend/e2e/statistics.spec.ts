import { loginAsAdmin } from './support/admin-orders';
import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

const statistics = {
  year: 2026,
  orderCount: 12,
  wishCount: 30,
  availableCount: 16,
  pendingConfirmationCount: 2,
  reservedCount: 3,
  receivedCount: 4,
  completedCount: 5,
};
const metricIds = [
  'order-count',
  'wish-count',
  'available-count',
  'pending-confirmation-count',
  'reserved-count',
  'received-count',
  'completed-count',
];

test.describe('Admin statistics route', () => {
  for (const width of [320, 768, 1280]) {
    test(`shows seven campaign metrics without overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAsAdmin(page);
      await page.route('http://localhost:8083/admin/statistics', (route) =>
        route.fulfill({ json: statistics }),
      );
      await page.goto('/admin/statistics');
      for (const [index, value] of [12, 30, 16, 2, 3, 4, 5].entries()) {
        await expect(page.getByTestId(`statistics-${metricIds[index]}`)).toHaveText(String(value));
      }
      await expectTranslatedText(page.locator('h1'), 'app.admin.statistics.title');
      for (const label of await page.locator('dt').all())
        await expectTranslatedText(label, 'app.admin.statistics.');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
      await expect(page.locator('mat-select')).toHaveCount(0);
    });
  }

  test('opens from the admin menu, waits in the resolver and displays zero counts', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('http://localhost:8083/admin/statistics', async (route) => {
      await pending;
      await route.fulfill({
        json: {
          year: 2042,
          orderCount: 0,
          wishCount: 0,
          availableCount: 0,
          pendingConfirmationCount: 0,
          reservedCount: 0,
          receivedCount: 0,
          completedCount: 0,
        },
      });
    });
    await page.locator('.admin-menu-button').click();
    const link = page.locator('a[href="/admin/statistics"]');
    await expectTranslatedText(link, 'app.navigation.adminStatistics');
    await link.click();
    try {
      await expect(page.locator('body')).toHaveClass(/navigation-progress/);
      await expect(page.locator('app-statistics-view')).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page).toHaveURL(/\/admin\/statistics$/);
    for (const id of metricIds) await expect(page.getByTestId(`statistics-${id}`)).toHaveText('0');
    await expect(page.locator('body')).not.toHaveClass(/navigation-progress/);
  });

  test('releases failed navigation and retries without misleading zeros', async ({ page }) => {
    await loginAsAdmin(page);
    let calls = 0;
    await page.route('http://localhost:8083/admin/statistics', (route) =>
      ++calls === 1
        ? route.fulfill({
            status: 500,
            json: { error: { code: 'STATISTICS_LOAD_FAILED', details: {} } },
          })
        : route.fulfill({ json: statistics }),
    );
    await page.goto('/admin/statistics');
    await expect(page).toHaveURL(/\/admin\/statistics$/);
    await expect(page.locator('body')).not.toHaveClass(/navigation-progress/);
    await expectTranslatedText(page.locator('[role="alert"]'), 'app.admin.statistics.loadError');
    await expect(page.locator('dd')).toHaveCount(0);
    const retry = page.locator('app-admin-statistics button');
    await expectTranslatedText(retry, 'app.admin.statistics.retry');
    await retry.click();
    await expect(page.getByTestId('statistics-wish-count')).toHaveText('30');
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
    expect(calls).toBe(2);
  });

  test('rejects anonymous access without requesting metrics', async ({ page }) => {
    let calls = 0;
    await page.route('http://localhost:8083/admin/statistics', (route) => {
      calls++;
      return route.fulfill({ json: statistics });
    });
    await page.goto('/admin/statistics');
    await expect(page).not.toHaveURL(/\/admin\/statistics$/);
    await expect(page.locator('dd')).toHaveCount(0);
    expect(calls).toBe(0);
  });

  test('rejects authenticated non-admin access before loading metrics', async ({ page }) => {
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        json: {
          user: { id: 'user-1', email: 'user@example.com', group: 'user' },
          group: 'user',
          requiredPasswordReset: false,
        },
      }),
    );
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.locator('input[type="password"]').fill('secret');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await page.waitForURL('**/not-found');
    let calls = 0;
    await page.route('http://localhost:8083/admin/statistics', (route) => {
      calls++;
      return route.fulfill({ json: statistics });
    });
    await page.goto('/admin/statistics');
    await expect(page).toHaveURL(/\/not-found$/);
    await expect(page.locator('dd')).toHaveCount(0);
    expect(calls).toBe(0);
  });
});
