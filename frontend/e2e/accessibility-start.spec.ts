import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Start route accessibility', () => {
  test('exposes landmarks, headings, labels and keyboard-focusable controls', async ({ page }) => {
    await page.goto('/start');

    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole('heading', { name: 'Deine E-Mail-Adresse', exact: true }),
    ).toBeVisible();

    const email = page.getByRole('textbox', { name: 'E-Mail-Adresse' });
    const continueButton = page.getByRole('button', { name: 'Weiter' });
    await expect(email).toBeVisible();
    await expect(continueButton).toBeVisible();

    const ids = await page
      .locator('[id]')
      .evaluateAll((elements) => elements.map((element) => element.id));
    expect(new Set(ids).size).toBe(ids.length);

    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(continueButton).toBeFocused();
  });

  test('announces validation errors in an alert region', async ({ page }) => {
    await page.goto('/start');
    await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('invalid');
    await page.getByRole('button', { name: 'Weiter' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expectTranslatedText(alert, 'app.anmeldung.errors.email.email');
  });
});
