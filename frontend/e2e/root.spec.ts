import { expectTranslatedText } from './support/assertions';
import { expect, test } from './support/test';

test.describe('Root route', () => {
  test('shows the public campaign landing page', async ({ page }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_start_date', value: '2000-01-01' },
          { variableName: 'fulfiller_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_availability_status', value: 'open' },
        ]),
      });
    });

    await page.goto('/');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.locator('.home-choice--fulfill')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(240, 226, 223)');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(33, 33, 33)');
    await expect(page.locator('.app-header')).toHaveCSS('background-color', 'rgb(245, 182, 211)');
    await expect(page.locator('.app-footer')).toHaveCSS('background-color', 'rgb(245, 182, 211)');
    await expect(page.locator('.home-choice--submit')).toHaveCSS(
      'background-color',
      'rgb(245, 182, 211)',
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#e30614');
    const manifest = await (await page.request.get('/site.webmanifest')).json();
    expect(manifest).toMatchObject({ theme_color: '#e30614', background_color: '#f0e2df' });
    await expectTranslatedText(page.locator('h1'), 'app.home.title');
    await expectTranslatedText(page.locator('.home__lead'), 'app.home.lead');
    const submitLink = page.locator('a[href="/start"]');
    const fulfillLink = page.locator('a[href="/erfuellen"]');
    await expect(submitLink).toHaveAttribute('mat-stroked-button', '');
    await expect(fulfillLink).toHaveAttribute('mat-flat-button', '');
    await expect(submitLink).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(submitLink).toHaveCSS('color', 'rgb(33, 33, 33)');
    await expect(submitLink).toHaveCSS('border-color', 'rgb(33, 33, 33)');
    await expect(fulfillLink).toHaveCSS('background-color', 'rgb(227, 6, 20)');
    await expect(fulfillLink).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expectTranslatedText(submitLink, 'app.home.submit.action');
    await expectTranslatedText(fulfillLink, 'app.home.fulfill.action');
    const faqPanels = page.locator('mat-expansion-panel');
    await expect(page.locator('.home-faq__section')).toHaveCount(2);
    await expect(faqPanels).toHaveCount(7);
    await faqPanels.nth(0).locator('mat-expansion-panel-header').click();
    await expect(faqPanels.nth(0).locator('.home-faq__answer')).toBeVisible();
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toHaveCSS('color', 'rgb(160, 5, 16)');
    await expect(loginLink).toHaveCSS('text-decoration-line', 'underline');
    const footerLink = page.locator('.app-footer a').first();
    await expect(footerLink).toHaveCSS('color', 'rgb(160, 5, 16)');
    await expect(footerLink).toHaveCSS('text-decoration-line', 'underline');
    const contrasts = await page.evaluate(() => {
      const luminance = (color: string) => {
        const channels = color
          .match(/\d+/g)!
          .slice(0, 3)
          .map(Number)
          .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      return [
        ['.app-footer a', '.app-footer'],
        ['a[href="/login"]', '.home-choice--submit'],
        ['a[href="/erfuellen"]', 'a[href="/erfuellen"]'],
        ['a[href="/start"]', 'a[href="/start"]'],
      ].map(([text, surface]) => {
        const foreground = luminance(getComputedStyle(document.querySelector(text)!).color);
        const background = luminance(
          getComputedStyle(document.querySelector(surface)!).backgroundColor,
        );
        return (
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
        );
      });
    });
    for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
    await fulfillLink.focus();
    await expect(fulfillLink).toHaveCSS('background-color', 'rgb(227, 6, 20)');
    await expect(fulfillLink).toHaveCSS('color', 'rgb(255, 255, 255)');
    await fulfillLink.hover();
    await expect(fulfillLink).toHaveCSS('background-color', 'rgb(227, 6, 20)');
    await expect(faqPanels.first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expectTranslatedText(loginLink, 'app.home.login');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.home-choice--fulfill')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    const homeActions = page.locator('.home__choices a');
    await expect(homeActions).toHaveCount(3);
    await expect(homeActions.nth(0)).toHaveAttribute('href', '/start');
    await expectTranslatedText(homeActions.nth(1), 'app.home.login');
    await expect(homeActions.nth(2)).toHaveAttribute('href', '/erfuellen');
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const rem = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      const px = (factor: number) => `${Number((rem * factor).toFixed(2))}px`;
      for (const card of [
        page.locator('.home-choice--submit'),
        page.locator('.home-choice--fulfill'),
        page.locator('.home-faq'),
      ]) {
        await expect(card).toHaveCSS('border-radius', px(1));
        await expect(card).not.toHaveCSS('box-shadow', 'none');
        for (const side of ['top', 'right', 'bottom', 'left']) {
          await expect(card).toHaveCSS(`border-${side}-width`, '0px');
        }
      }
      for (const side of ['top', 'right', 'bottom', 'left']) {
        await expect(page.locator('.home-faq')).toHaveCSS(`padding-${side}`, px(1));
        await expect(page.locator('.home-faq > mat-card-content')).toHaveCSS(
          `padding-${side}`,
          '0px',
        );
      }
      for (const heading of await page.locator('.home-faq__section h2').all()) {
        await expect(heading).toHaveCSS('font-size', px(1.25));
        await expect(heading).toHaveCSS('margin-bottom', px(0.5));
      }
      for (const question of await page.locator('.home-faq__question').all()) {
        await expect(question).toHaveCSS('border-radius', px(1));
        for (const side of ['top', 'right', 'bottom', 'left']) {
          await expect(question).toHaveCSS(
            `padding-${side}`,
            px(side === 'top' || side === 'bottom' ? 0.5 : 1),
          );
        }
        await expect(question.locator('mat-panel-title')).toHaveCSS('font-size', px(1));
        await expect(question.locator('mat-panel-title')).toHaveCSS('font-weight', '400');
      }
      await expect(faqPanels.first().locator('.home-faq__answer')).toHaveCSS('font-size', px(1));
      await expect(faqPanels.first().locator('.home-faq__answer')).toHaveCSS(
        'color',
        'rgb(89, 89, 89)',
      );
      await page.mouse.move(0, 0);
      const question = page.locator('.home-faq__question').last();
      const background = await question.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      const answerBackground = await faqPanels
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(background).not.toBe(answerBackground);
      await question.hover();
      await expect
        .poll(() => question.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toBe(background);
    }
  });

  test('shows the campaign start date instead of the receive link before launch', async ({
    page,
  }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2999-01-01' },
          { variableName: 'campaign_end_date', value: '2999-12-31' },
          { variableName: 'fulfiller_start_date', value: '2000-01-01' },
          { variableName: 'fulfiller_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_availability_status', value: 'open' },
        ]),
      });
    });

    await page.goto('/');
    await expectTranslatedText(page.locator('main'), 'app.home.submit.notStarted');
    await expect(page.locator('a[href="/start"]')).toHaveCount(0);
  });

  test('replaces the submission link with a capacity notice when the backend reports exhausted capacity', async ({
    page,
  }) => {
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
          { variableName: 'campaign_availability_status', value: 'capacity_reached' },
          { variableName: 'fulfiller_start_date', value: '2000-01-01' },
          { variableName: 'fulfiller_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_availability_status', value: 'open' },
        ]),
      });
    });

    await page.goto('/');
    await expectTranslatedText(page.locator('main'), 'app.home.submit.capacityReached');
    await expect(page.locator('a[href="/start"]')).toHaveCount(0);
    await expectTranslatedText(page.locator('a[href="/erfuellen"]'), 'app.home.fulfill.action');
  });

  test('shows logout for an authenticated user and returns home after logout', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'gaerngschee.auth',
        JSON.stringify({
          userId: 'admin-1',
          group: 'admin',
          fairgateUserExists: null,
          childrenCount: null,
          adultsCount: null,
          salutation: null,
        }),
      );
    });
    await page.route('http://localhost:8083/auth/session-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', secondsRemaining: 3600 }),
      });
    });
    await page.route('http://localhost:8083/public/configuration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_start_date', value: '2000-01-01' },
          { variableName: 'fulfiller_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_availability_status', value: 'open' },
        ]),
      });
    });
    await page.route('http://localhost:8083/auth/logout', async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await page.waitForURL('**/');
    await expectTranslatedText(page.locator('a[href="/login"]'), 'app.home.login');
  });
});
