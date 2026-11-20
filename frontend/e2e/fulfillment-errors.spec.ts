import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Fulfillment dialog error visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost:8083/public/fulfiller/orders**', (route) =>
      route.fulfill({
        json: {
          orders: [
            {
              id: 'order-1',
              year: 2026,
              orderNumber: 12,
              currentText: 'Family information',
              items: [
                {
                  id: 'item-1',
                  itemNumber: 1,
                  wishNumber: '12-1',
                  title: 'Building blocks',
                  category: 'gift',
                  currentDescription: 'A detailed wish description.\n'.repeat(30),
                  fulfillmentStatus: 'available',
                  reservedAt: null,
                  reservationExpiresAt: null,
                },
              ],
            },
          ],
        },
      }),
    );
    await page.route('http://localhost:8083/public/fulfiller/wish-statuses', (route) =>
      route.fulfill({ json: { items: [] } }),
    );
    await page.route('http://localhost:8083/public/fulfiller/availability-version', (route) =>
      route.fulfill({ json: { version: 0 } }),
    );
  });

  for (const width of [390, 1280]) {
    test(`scrolls to invalid email and missing consent at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 600 });
      let submissions = 0;
      await page.route('http://localhost:8083/public/fulfiller-reservation-start', (route) => {
        submissions++;
        return route.fulfill({ json: {} });
      });
      await page.goto('/erfuellen');
      await page.getByRole('button', { name: 'Diesen Wunsch erfüllen' }).click();
      const dialog = page.getByRole('dialog');
      const submit = dialog.getByRole('button', { name: 'Bestätigungslink senden' });
      const email = dialog.getByRole('textbox', { name: 'Deine E-Mail-Adresse' });
      await submit.click();
      await expect(email).toBeFocused();
      await expect(email).toBeInViewport({ ratio: 1 });
      await expectTranslatedText(
        dialog.locator('mat-form-field app-control-error'),
        'app.fulfiller.reservationDialog.errors.email',
      );
      await email.fill('person@example.com');
      await submit.click();
      const consent = dialog.getByRole('checkbox');
      await expect(consent).toBeFocused();
      await expect(consent).toBeInViewport({ ratio: 1 });
      await expectTranslatedText(
        dialog.locator('app-control-error').last(),
        'app.fulfiller.reservationDialog.errors.privacyAccepted',
      );
      expect(submissions).toBe(0);
    });

    test(`scrolls back to server errors and allows retry at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 600 });
      let submissions = 0;
      await page.route('http://localhost:8083/public/fulfiller-reservation-start', (route) => {
        submissions++;
        return route.fulfill({
          status: 429,
          json: { error: { code: 'RATE_LIMITED', details: {} } },
        });
      });
      await page.goto('/erfuellen');
      await page.getByRole('button', { name: 'Diesen Wunsch erfüllen' }).click();
      const dialog = page.getByRole('dialog');
      const email = dialog.getByRole('textbox', { name: 'Deine E-Mail-Adresse' });
      await email.fill('person@example.com');
      await dialog.getByRole('checkbox').check();
      for (let attempt = 1; attempt <= 2; attempt++) {
        await dialog.getByRole('button', { name: 'Bestätigungslink senden' }).click();
        const error = dialog.getByRole('alert');
        await expectTranslatedText(error, 'app.fulfiller.errors.RATE_LIMITED');
        await expect(error).toBeFocused();
        await expect(error).toBeInViewport({ ratio: 1 });
        await expect(email).toHaveValue('person@example.com');
        expect(submissions).toBe(attempt);
      }
    });
  }
});
