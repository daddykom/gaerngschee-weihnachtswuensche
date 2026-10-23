import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Start route', () => {
  test('displays the email form', async ({ page }) => {
    await page.goto('/start');
    await expectTranslatedText(page.locator('h1'), 'app.anmeldung.title');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Mehr zum Datenschutz' }),
    ).toHaveAttribute('href', '/datenschutz');
  });

  test('displays the Fairgate info box with a background color', async ({ page }) => {
    await page.goto('/start');

    const backgroundColor = await page
      .locator('app-info-box .info-box')
      .evaluate((element) => getComputedStyle(element).backgroundColor);

    expect(backgroundColor).toMatch(/^rgb\(/);
  });

  test('validates an invalid email without calling the backend', async ({ page }) => {
    let requestCalled = false;
    await page.route('http://localhost:8083/public/start', async (route) => {
      requestCalled = true;
      await route.continue();
    });

    await page.goto('/start');
    await page.locator('input[type="email"]').fill('invalid');
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expectTranslatedText(page.getByRole('alert'), 'app.anmeldung.errors.email.email');
    expect(requestCalled).toBe(false);
  });

  test('submits the email request and shows the success page', async ({ page }) => {
    await page.route('http://localhost:8083/public/start', async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        email: 'person@example.com',
        language: 'de',
      });
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ sent: true }),
      });
    });

    await page.goto('/start');
    await page.locator('input[type="email"]').fill('person@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page).toHaveURL(/\/start\/success$/);
    const alert = page.getByRole('alert');
    await expectTranslatedText(alert, 'app.anmeldung.emailSentTitle');
    await expectTranslatedText(alert, 'app.anmeldung.emailSentMessage');
    const successNavigation = page.getByRole('navigation', { name: 'Erfolgsnavigation' });
    await expect(successNavigation.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    );
    await expect(successNavigation.getByRole('link', { name: 'Anmeldung' })).toHaveAttribute(
      'href',
      '/start',
    );
  });
});
