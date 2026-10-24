import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('http://localhost:8083/public/configuration**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-12-31' },
        ]),
      });
    });

    await page.route('http://localhost:8083/auth/email-check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'password', processingYear: 2026 }),
      });
    });

    await page.route('**/auth/session-status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          secondsRemaining: 3_600,
        }),
      });
    });

    await page.route('**/client/order', async (route) => {
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
    });

    await use(page);
  },
});

export { expect, type Page };
