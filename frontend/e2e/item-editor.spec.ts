import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Existing wish editor route', () => {
  for (const width of [390, 1280]) {
    test(`shows the original wish, editable current version and feedback at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const originalTitle = '<b>Original wish title</b>';
      const originalDescription = 'Original wish description\nOriginal second line';
      const feedback = 'Please review <b>the size</b>.\nPlease check the description.';
      await page.route('http://localhost:8083/auth/registration-login', (route) =>
        route.fulfill({
          json: {
            user: { id: 'client-1', email: 'client@example.com', group: 'wunschbesteller' },
            group: 'wunschbesteller',
            firstAccess: false,
            requiredPasswordReset: false,
            fairgateStatus: 'valid',
            fairgateUserExists: true,
            adultsCount: 1,
            childrenCount: 0,
          },
        }),
      );
      await page.route('http://localhost:8083/client/order', (route) =>
        route.fulfill({
          json: {
            year: 2026,
            fairgateStatus: 'valid',
            fairgateUserExists: true,
            adultsCount: 1,
            childrenCount: 0,
            canEdit: true,
            order: {
              id: 'order-1',
              status: 'changes_requested',
              adultsCount: 1,
              childrenCount: 0,
              originalText: 'Original family text',
              currentText: 'Edited family text',
              adminNotes: null,
              items: [
                {
                  id: 'item-1',
                  orderId: 'order-1',
                  category: 'gift',
                  personType: 'adult',
                  personIndex: 1,
                  originalTitle,
                  originalDescription,
                  currentTitle: 'Edited wish title',
                  currentDescription: 'Edited wish description',
                  status: 'rejected',
                  adminNotes: feedback,
                },
              ],
            },
          },
        }),
      );
      await page.goto('/client-login?token=registration-token');
      await page.waitForURL('**/bestellung');
      await page.getByRole('button', { name: 'Ändern' }).click();
      await page.waitForURL('**/bestellung/wunsch/item-1');

      const title = page.locator('[aria-labelledby="original-wish-title-heading"]');
      const description = page.locator('[aria-labelledby="original-wish-description-heading"]');
      await expectTranslatedText(title.getByRole('heading'), 'app.order.items.originalTitle');
      await expectTranslatedText(
        description.getByRole('heading'),
        'app.order.items.originalDescription',
      );
      await expect(title.locator('p')).toHaveText(originalTitle);
      await expect(title.locator('b')).toHaveCount(0);
      await expect(description.locator('p')).toHaveText(originalDescription);
      await expect(title.getByRole('textbox')).toHaveCount(0);
      await expect(description.getByRole('textbox')).toHaveCount(0);
      const currentTitle = page.getByRole('textbox', { name: 'Aktueller Wunschtitel' });
      const currentDescription = page.getByRole('textbox', { name: 'Aktuelle Wunschbeschreibung' });
      await expect(currentTitle).toHaveValue('Edited wish title');
      await expect(currentDescription).toHaveValue('Edited wish description');
      await expect(currentTitle).toBeEditable();
      await expect(currentDescription).toBeEditable();
      const note = page.locator('app-item-editor app-info-box');
      await expectTranslatedText(note, 'app.order.items.feedback');
      await expect(note).toContainText(feedback);
      await expect(note.locator('b')).toHaveCount(0);
      await expect(note.locator('p')).toHaveCSS('white-space', 'pre-line');

      await currentTitle.fill('Requester-approved title');
      await currentDescription.fill('Requester-approved description');
      await expect(title.locator('p')).toHaveText(originalTitle);
      await expect(description.locator('p')).toHaveText(originalDescription);
      await expect(note).toContainText(feedback);
    });
  }
});
