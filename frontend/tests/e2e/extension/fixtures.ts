import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `chrome` namespace exists only inside sw.evaluate() callbacks (service worker scope).
declare const chrome: any;

const here = path.dirname(fileURLToPath(import.meta.url));
export const EXTENSION_DIR = path.resolve(here, '../../../../extension');
export const VIEWPORT = { width: 1440, height: 900 };

// Selectors come from content.js toggleWidget() and ChatWidget.tsx (data-eo-widget).
export const SEL = {
  root: '#edge-operator-root',
  widget: '[data-eo-widget]',
  launcher:
    '[data-eo-launcher], #eo-floating-launcher, #g4-floating-launcher, .eo-launcher-button, .g4-launcher-button',
  input: /Ask about this page|Initializing local engine/,
};

type WorkerFx = { extContext: BrowserContext; sw: Worker; extensionId: string };

export const test = base.extend<object, WorkerFx>({
  extContext: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      if (!fs.existsSync(path.join(EXTENSION_DIR, 'manifest.json'))) {
        throw new Error(`No manifest at ${EXTENSION_DIR}. Run npm run build:extension first.`);
      }
      // Fresh persistent profile directory for every worker. Never point this at a real user Chrome profile.
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eo-profile-'));
      const context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chromium', // Branded Chrome 137+ restricts --load-extension
        headless: !process.env.HEADED,
        viewport: VIEWPORT,
        args: [
          `--disable-extensions-except=${EXTENSION_DIR}`,
          `--load-extension=${EXTENSION_DIR}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });
      await use(context);
      await context.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    },
    { scope: 'worker' },
  ],
  sw: [
    async ({ extContext }, use) => {
      const sw = extContext.serviceWorkers()[0] ?? (await extContext.waitForEvent('serviceworker'));
      await use(sw);
    },
    { scope: 'worker' },
  ],
  extensionId: [async ({ sw }, use) => use(new URL(sw.url()).host), { scope: 'worker' }],
});
export const expect = test.expect;

export type PageStatus = { isInitialized: boolean; isRecording: boolean; entitiesCount: number; url: string };

/**
 * window.EdgeOperator lives in the content script's isolated world, so page.evaluate()
 * cannot see it directly. Query the content script directly via chrome.tabs.sendMessage.
 */
export function pageStatus(sw: Worker, url: string): Promise<PageStatus | null> {
  return sw.evaluate(async (target: string) => {
    const norm = (u: string) => (u ? u.replace(/\/$/, '') : '');
    const tabs = await chrome.tabs.query({});
    const matching = tabs.filter((t: any) => norm(t.url) === norm(target));
    const tab = matching.find((t: any) => t.active) ?? matching[matching.length - 1];
    if (tab?.id === undefined) return null;
    try {
      return await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATUS' }, { frameId: 0 });
    } catch {
      return null;
    }
  }, url);
}

export function sendToTab(sw: Worker, url: string, message: object) {
  return sw.evaluate(
    async ([target, msg]: [string, object]) => {
      const norm = (u: string) => (u ? u.replace(/\/$/, '') : '');
      const tabs = await chrome.tabs.query({});
      const matching = tabs.filter((t: any) => norm(t.url) === norm(target));
      const tab = matching.find((t: any) => t.active) ?? matching[matching.length - 1];
      if (!tab?.id) throw new Error(`Tab not found for url: ${target}`);
      return chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 });
    },
    [url, message] as [string, object],
  );
}

export async function openCleanPage(extContext: BrowserContext, url?: string): Promise<Page> {
  const oldPages = extContext.pages();
  const page = await extContext.newPage();
  for (const old of oldPages) {
    await old.close().catch(() => {});
  }
  if (url) {
    await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
  }
  return page;
}

export function trackPage(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  return { pageErrors, consoleErrors };
}

export async function recordCsp(page: Page) {
  await page.addInitScript(() => {
    (window as any).__eoCsp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as any).__eoCsp.push(`${e.effectiveDirective} ${e.blockedURI}`);
    });
  });
}
export const cspViolations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as any).__eoCsp ?? []);

/** Computed styles of host elements (excluding the widget). Any delta means CSS leaked onto host. */
export function styleFingerprint(page: Page): Promise<Record<string, string>> {
  return page.evaluate((exclude: string) => {
    const PROPS = [
      'display', 'position', 'visibility', 'box-sizing', 'font-family', 'font-size',
      'line-height', 'color', 'background-color', 'padding-top'
    ];
    const SELECTORS = [
      'html', 'body', 'header', 'nav', 'main', 'footer', 'h1', 'h2', 'p', 'a',
      'button', 'input', '.container', '.hidden', '.flex', '.block', '.fixed'
    ];
    const out: Record<string, string> = {};
    for (const sel of SELECTORS) {
      const el = [...document.querySelectorAll(sel)].find((e) => !e.closest(exclude));
      if (!el) continue;
      const cs = getComputedStyle(el);
      out[sel] = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
    }
    out['::horizontal-overflow'] = String(document.documentElement.scrollWidth > window.innerWidth);
    return out;
  }, `${SEL.widget}, ${SEL.root}`);
}

export type Baseline = {
  styles: Record<string, string>;
  pageErrors: string[];
  consoleErrors: string[];
  csp: string[];
  nativeWidget: boolean;
};

/** Same target page in a vanilla Chromium instance with zero extensions, as the baseline. */
export async function captureBaseline(url: string): Promise<Baseline> {
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const t = trackPage(page);
    await recordCsp(page);
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(2_000);
    return {
      styles: await styleFingerprint(page),
      pageErrors: t.pageErrors,
      consoleErrors: t.consoleErrors,
      csp: await cspViolations(page),
      nativeWidget: (await page.locator(SEL.launcher).filter({ visible: true }).count()) > 0,
    };
  } finally {
    await browser.close();
  }
}

export const newOnly = (now: string[], before: string[]) =>
  now.filter((x) => !before.includes(x) && !x.includes('compute-pressure'));
