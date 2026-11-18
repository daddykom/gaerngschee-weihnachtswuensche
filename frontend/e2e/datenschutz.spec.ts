import { expect, test } from '@playwright/test';

test.describe('Privacy route', () => {
  test('renders the static privacy content', async ({ page }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/datenschutz');

    await expect(page.locator('h1')).toHaveText('Datenschutz – Gärngschee Wunschzettel-Aktion');
    const content = page.locator('.legal-page__content');
    for (const text of [
      'Anmeldung bei der Wunschzettelaktion',
      'die sich bei Fairgate registriert haben, um einen Bedürftigkeitsnachweis zu hinterlegen',
      'um deine Weihnachtswünsche später der richtigen Anmeldung zuzuordnen',
      'deinen persönlichen Wunschzettel-QR-Code vor. Den erhältst du per E-Mail.',
      'ob das Weihnachtspäckli der richtigen Person abgegeben wird',
      'Informationen zur Aktion wie Abholort und QR-Code',
      'geben deine E-Mail-Adresse nicht an Dritte weiter',
      'Du kannst uns fragen, welche Daten wir über dich gespeichert haben.',
      'Du kannst von uns verlangen:',
      'dass wir falsche Daten korrigieren.',
      'dass wir deine Daten, die wir nicht mehr benötigen, löschen.',
      'Stand: September 2026',
    ]) {
      await expect(content).toContainText(text);
    }
    await expect(content).not.toContainText('Weihnachtswünsche-Anwendung');
    await expect(page.locator('.legal-page__content')).toContainText('Prüfung bei Fairgate');
    await expect(page.locator('.legal-page__content')).toContainText('Statistik mit Matomo');
    await expect(page.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute(
      'href',
      '/datenschutz',
    );
  });
});
