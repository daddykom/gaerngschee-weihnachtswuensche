import { expect, type Locator } from '@playwright/test';

export async function expectTranslatedText(
  locator: Locator,
  translationKey: string,
): Promise<void> {
  await expect(locator).toBeVisible();
  await expect(locator).toHaveText(/\S+/);
  await expect(locator).not.toContainText(translationKey);
}
