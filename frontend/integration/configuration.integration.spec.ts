import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './support/admin-login';
import { authHeaders } from './support/auth-header';

test.describe('Integration configuration', () => {
  test('saves both a handover date and a free-text date range without changing campaign date validation', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const response = await page.request.get('http://localhost:8082/admin/configuration');
    expect(response.status()).toBe(200);
    const configs = await response.json();
    const handover = configs.find(
      (config: { variableName: string }) => config.variableName === 'fulfiller_handover_date',
    );
    expect(handover.pattern).toBeNull();
    for (const name of ['fulfiller_start_date', 'fulfiller_end_date']) {
      expect(
        configs.find((config: { variableName: string }) => config.variableName === name).pattern,
      ).toBeTruthy();
    }
    await page.goto('/admin/configuration');
    try {
      for (const value of ['19. Dezember 2026', '17.–19. Dezember 2026']) {
        const input = page.getByRole('textbox', { name: 'fulfiller_handover_date', exact: true });
        await input.fill(value);
        const saved = page.waitForResponse(
          (response) =>
            response.url().endsWith(`/admin/configuration/${handover.id}`) &&
            response.request().method() === 'PATCH',
        );
        await page.getByRole('button', { name: 'Konfiguration speichern' }).click();
        expect((await saved).status()).toBe(200);
        await page.reload();
        await expect(input).toHaveValue(value);
        const publicConfig = await page.request.get('http://localhost:8082/public/configuration');
        expect(publicConfig.status()).toBe(200);
        expect(
          (await publicConfig.json()).find(
            (config: { variableName: string }) => config.variableName === 'fulfiller_handover_date',
          ).value,
        ).toBe(value);
      }
    } finally {
      const restored = await page.request.patch(
        `http://localhost:8082/admin/configuration/${handover.id}`,
        {
          headers: await authHeaders(page),
          data: { value: handover.value },
        },
      );
      expect(restored.status()).toBe(200);
    }
  });

  test('loads, saves and reloads a configuration value', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/configuration');

    const input = page.getByLabel('fairgate_test_email');
    await expect(input).toHaveValue('isabelle.joss@gaerngschee.ch');
    await input.fill('integration.changed@example.com');
    await page.getByRole('button', { name: 'Konfiguration speichern' }).click();
    await expect(page.getByText('Die Konfiguration wurde gespeichert.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('fairgate_test_email')).toHaveValue(
      'integration.changed@example.com',
    );

    await page.getByLabel('fairgate_test_email').fill('isabelle.joss@gaerngschee.ch');
    await page.getByRole('button', { name: 'Konfiguration speichern' }).click();
    await expect(page.getByText('Die Konfiguration wurde gespeichert.')).toBeVisible();
  });
});
