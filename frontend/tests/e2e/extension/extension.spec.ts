import {
  test,
  expect,
  SEL,
  captureBaseline,
  cspViolations,
  newOnly,
  pageStatus,
  recordCsp,
  sendToTab,
  styleFingerprint,
  trackPage,
  type Baseline,
} from './fixtures';
import { TARGETS } from './sites';

test('popup renders without runtime errors', async ({ extContext, extensionId }) => {
  const page = await extContext.newPage();
  const t = trackPage(page);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('body')).not.toBeEmpty();
  expect(t.pageErrors).toEqual([]);
});

for (const target of TARGETS) {
  test.describe(`extension on ${target.name}`, () => {
    let baseline: Baseline;

    test.beforeAll(async () => {
      baseline = await captureBaseline(target.url);
    });

    test('mounts widget, zero new errors, zero CSP violations, zero style leaks', async ({ extContext, sw }) => {
      const page = await extContext.newPage();
      const t = trackPage(page);
      await recordCsp(page);
      await page.goto(target.url, { waitUntil: 'load', timeout: 45_000 });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(2_000);

      if (baseline.nativeWidget) {
        // Page embeds its own widget natively; wait past content.js init delay
        await page.waitForTimeout(2_500);
      } else {
        await expect
          .poll(async () => (await pageStatus(sw, page.url()))?.isInitialized ?? false, {
            timeout: 15_000,
            message: 'content script never reported isInitialized',
          })
          .toBe(true);
        await expect(page.locator(SEL.root)).toBeAttached();
      }

      // Ensure exactly one launcher is visible (no double-launcher clash)
      await expect(page.locator(SEL.launcher).filter({ visible: true })).toHaveCount(1);

      await page.waitForTimeout(1_000);
      expect.soft(newOnly(t.pageErrors, baseline.pageErrors), 'new page errors').toEqual([]);
      expect.soft(newOnly(t.consoleErrors, baseline.consoleErrors), 'new console errors').toEqual([]);
      expect.soft(newOnly(await cspViolations(page), baseline.csp), 'new CSP violations').toEqual([]);
      expect(await styleFingerprint(page), 'host computed styles changed').toEqual(baseline.styles);
    });

    test('launcher opens panel; input field is accessible', async ({ extContext }) => {
      const page = await extContext.newPage();
      await page.goto(target.url, { waitUntil: 'load', timeout: 45_000 });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(1_500);

      const launcher = page.locator(SEL.launcher).filter({ visible: true }).first();
      await expect(launcher).toBeVisible({ timeout: 15_000 });
      await expect(launcher).toBeInViewport();
      await launcher.click();

      const widget = page.locator(SEL.widget).first();
      const input = widget.getByPlaceholder(SEL.input);
      await expect(input).toBeVisible();
      await expect(input).toBeInViewport();

      // In headless Chromium without Gemini Nano, prompt API may report unavailable
      const ready = await expect(input).toBeEditable({ timeout: 10_000 }).then(() => true, () => false);
      if (!ready) {
        test.info().annotations.push({
          type: 'engine',
          description: 'Local on-device engine not ready in headless mode; skipping text query submit',
        });
        return;
      }
      await input.fill('What is on this page?');
      await widget.locator('button[type="submit"][aria-label="Send message"]').click();
      await expect(widget.getByText('What is on this page?', { exact: true })).toBeVisible();
      const stop = widget.getByRole('button', { name: 'Stop generation' });
      if (await stop.isVisible()) {
        await stop.click({ timeout: 1500 }).catch(() => {});
      }
      await expect(page.locator('body')).toBeVisible();
    });

    test('TOGGLE_WIDGET message opens the panel', async ({ extContext, sw }) => {
      test.skip(baseline.nativeWidget, 'Host embeds its own widget; extension yields to native widget');
      const page = await extContext.newPage();
      await page.goto(target.url, { waitUntil: 'load', timeout: 45_000 });
      await expect.poll(async () => (await pageStatus(sw, page.url()))?.isInitialized ?? false).toBe(true);
      await sendToTab(sw, page.url(), { type: 'TOGGLE_WIDGET' });
      await expect(page.locator(SEL.widget).getByPlaceholder(SEL.input)).toBeVisible();
    });
  });
}
