import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';
import { seedFulfillerCapacityFixture } from './support/fulfiller-capacity';

const API_URL = 'http://localhost:8082';

test.describe('Integration fulfiller capacity', () => {
  test('switches the public fulfiller access off when either yearly limit is exceeded', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const headers = await authHeaders(page);
    const configurationResponse = await page.request.get(`${API_URL}/admin/configuration`, {
      headers,
    });
    const configurations = await configurationResponse.json();
    const ordersLimit = configurations.find(
      (configuration: { variableName: string }) =>
        configuration.variableName === 'maximum_orders_per_year',
    );
    const itemsLimit = configurations.find(
      (configuration: { variableName: string }) =>
        configuration.variableName === 'maximum_order_items_per_year',
    );

    if (!ordersLimit || !itemsLimit) {
      throw new Error('Expected fulfiller capacity configuration values.');
    }

    const update = async (id: string, value: string): Promise<void> => {
      const response = await page.request.patch(`${API_URL}/admin/configuration/${id}`, {
        headers,
        data: { value },
      });
      expect(response.ok()).toBeTruthy();
    };

    try {
      await update(ordersLimit.id, '999999');
      await update(itemsLimit.id, '999999');
      seedFulfillerCapacityFixture();

      const openConfigurationResponse = await page.request.get(`${API_URL}/public/configuration`);
      const openConfiguration = await openConfigurationResponse.json();
      expect(
        openConfiguration.find(
          (configuration: { variableName: string }) =>
            configuration.variableName === 'fulfiller_availability_status',
        ).value,
      ).toBe('open');
      expect((await page.request.get(`${API_URL}/public/fulfiller/orders`)).status()).toBe(200);

      await update(ordersLimit.id, '1');
      await expectFulfillerAccessClosed(page, 'app.home.fulfill.ended');

      await update(ordersLimit.id, '999999');
      await update(itemsLimit.id, '1');
      await expectFulfillerAccessClosed(page, 'app.home.fulfill.ended');
    } finally {
      await update(ordersLimit.id, '999999');
      await update(itemsLimit.id, '600');
    }
  });
});

async function expectFulfillerAccessClosed(
  page: import('@playwright/test').Page,
  translationKey: string,
): Promise<void> {
  const configurationResponse = await page.request.get(`${API_URL}/public/configuration`);
  const configuration = await configurationResponse.json();
  expect(
    configuration.find(
      (entry: { variableName: string }) => entry.variableName === 'fulfiller_availability_status',
    ).value,
  ).toBe('ended');

  const ordersResponse = await page.request.get(`${API_URL}/public/fulfiller/orders`);
  expect(ordersResponse.status()).toBe(403);
  expect((await ordersResponse.json()).error.code).toBe('FULFILLER_ENDED');

  const reservationResponse = await page.request.post(
    `${API_URL}/public/fulfiller-reservation-start`,
    {
      headers: await authHeaders(page),
      data: {
        itemId: 'integration-capacity-item-1',
        email: 'fulfiller@example.com',
        language: 'de',
        privacyAccepted: true,
      },
    },
  );
  expect(reservationResponse.status()).toBe(403);
  expect((await reservationResponse.json()).error.code).toBe('FULFILLER_ENDED');

  await page.goto('/');
  await expectTranslatedText(page.locator('main'), translationKey);
  await expect(page.locator('a[href="/erfuellen"]')).toHaveCount(0);
}
