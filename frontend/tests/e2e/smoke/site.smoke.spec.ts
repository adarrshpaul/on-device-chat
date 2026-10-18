import { test, expect } from '@playwright/test';

const EXPECTED = process.env.EXPECTED_VERSION;
const IS_STAGING = (process.env.BASE_URL ?? '').includes('stg.');

test.beforeAll(() => {
  if (!process.env.BASE_URL || !EXPECTED) {
    throw new Error('BASE_URL and EXPECTED_VERSION environment variables are required');
  }
});

test('serves 200 with the expected bundle version (edge propagation check)', async ({ page }) => {
  await expect
    .poll(
      async () => {
        const res = await page.goto('/', { waitUntil: 'load', timeout: 30_000 });
        if (res?.status() !== 200) return `HTTP ${res?.status()}`;
        return page.evaluate(() => (window as any).EdgeOperator?.version ?? 'EdgeOperator missing');
      },
      { timeout: 180_000, intervals: [5_000] }
    )
    .toBe(EXPECTED);
});

test('no uncaught page errors or failed same-origin asset requests', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(baseURL!)) {
      failed.push(`${r.url()} ${r.failure()?.errorText}`);
    }
  });
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('widget launcher renders and fits desktop and mobile viewports', async ({ page }) => {
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(vp);
    await page.goto('/', { waitUntil: 'load', timeout: 30_000 });
    const launcher = page
      .locator('[data-eo-launcher], .eo-launcher-button, .g4-launcher-button')
      .filter({ visible: true })
      .first();
    await expect(launcher).toBeInViewport();
    await launcher.click();
    await expect(
      page
        .locator('[data-eo-widget]')
        .getByPlaceholder(/Ask about this page|Initializing local engine/)
    ).toBeInViewport();
  }
});

test('staging environment enforces noindex header', async ({ request }) => {
  test.skip(!IS_STAGING, 'Applicable only to staging environment');
  const res = await request.get('/');
  expect(res.headers()['x-robots-tag'] ?? '').toContain('noindex');
});
