import { expect, test } from '@playwright/test';
import { expectTranslatedText } from '../e2e/support/assertions';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';
import { seedFulfillerCapacityFixture } from './support/fulfiller-capacity';

const API_URL = 'http://localhost:8082';

test.describe('Integration fulfiller capacity', () => {
  test('keeps the fulfiller access open beyond the yearly limits and blocks new registrations instead', async ({
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
      expect(
        openConfiguration.find(
          (configuration: { variableName: string }) =>
            configuration.variableName === 'campaign_availability_status',
        ).value,
      ).toBe('open');
      expect((await page.request.get(`${API_URL}/public/fulfiller/orders`)).status()).toBe(200);

      await update(ordersLimit.id, '1');
      await update(itemsLimit.id, '1');

      const closedConfiguration = await (
        await page.request.get(`${API_URL}/public/configuration`)
      ).json();
      expect(
        closedConfiguration.find(
          (configuration: { variableName: string }) =>
            configuration.variableName === 'fulfiller_availability_status',
        ).value,
      ).toBe('open');
      expect(
        closedConfiguration.find(
          (configuration: { variableName: string }) =>
            configuration.variableName === 'campaign_availability_status',
        ).value,
      ).toBe('capacity_reached');

      const ordersResponse = await page.request.get(`${API_URL}/public/fulfiller/orders`);
      expect(ordersResponse.status()).toBe(200);
      const orders = (await ordersResponse.json()).orders as Array<{
        id: string;
        items: Array<{ id: string }>;
      }>;
      const capacityOrder = orders.find((order) => order.id === 'integration-capacity-order-1');
      expect(capacityOrder?.items.some((item) => item.id === 'integration-capacity-item-1')).toBe(
        true,
      );

      const registrationResponse = await page.request.post(`${API_URL}/public/start`, {
        headers: await authHeaders(page),
        data: { email: 'capacity-registration@example.com', language: 'de' },
      });
      expect(registrationResponse.status()).toBe(403);
      expect((await registrationResponse.json()).error.code).toBe('CAMPAIGN_CAPACITY_REACHED');

      await page.goto('/');
      await expectTranslatedText(page.locator('main'), 'app.home.submit.capacityReached');
      await expect(page.locator('a[href="/start"]')).toHaveCount(0);
      await expectTranslatedText(page.locator('a[href="/erfuellen"]'), 'app.home.fulfill.action');
    } finally {
      await update(ordersLimit.id, '999999');
      await update(itemsLimit.id, '600');
    }
  });
});
