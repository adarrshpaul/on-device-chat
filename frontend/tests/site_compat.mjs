/**
 * Cross-site compatibility harness for on-device-chat.
 *
 * Injects the REAL built standalone bundle (dist/on-device-chat.min.js + style.css)
 * into live third-party pages with Playwright and records measured outcomes.
 * Nothing here is mocked: every column in the report comes from a real browser run.
 *
 * Usage:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/site_compat.mjs [--sites a.com,b.com] [--ask]
 *
 * What is measured per site (desktop 1440x900, then mobile 390x844):
 *   - loaded      : navigation succeeded (HTTP status recorded)
 *   - csp         : whether the response ships a script-src/default-src CSP (embedding would need a CSP edit)
 *   - mounted     : [data-g4-widget] exists and its launcher is fully inside the viewport
 *   - reachable   : elementFromPoint at launcher centre resolves inside the widget (not covered by host UI)
 *   - hostIntact  : widget did not change host body font, horizontal overflow, or add page errors
 *   - opens       : panel opens and fits inside the viewport
 *   - engine      : input placeholder after open (ready vs still initialising) and tier name
 *   - ask (opt-in): sends "What is on this page?" and records the actual response text + latency
 *
 * Caveat: headless Chromium has no Chrome Gemini Nano, so the engine tier under test is whatever
 * the widget falls back to in this environment. That is reported, not hidden.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const JS = fs.readFileSync(path.join(dist, "on-device-chat.min.js"), "utf8");
const CSS = fs.readFileSync(path.join(dist, "style.css"), "utf8");

const DEFAULT_SITES = [
  "http://127.0.0.1:4300/", // our portfolio (dev build, widget embedded natively)
  "https://example.com/",
  "https://news.ycombinator.com/",
  "https://en.wikipedia.org/wiki/Web_browser",
  "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API",
  "https://react.dev/",
  "https://angular.dev/",
  "https://vuejs.org/",
  "https://nextjs.org/",
  "https://tailwindcss.com/",
  "https://github.com/",
  "https://www.bbc.com/news",
  "https://books.toscrape.com/",
  "https://www.nytimes.com/",
];

const args = process.argv.slice(2);
const sitesArg = args.find((a) => a.startsWith("--sites="))?.split("=")[1];
const sites = sitesArg ? sitesArg.split(",").map((s) => (s.startsWith("http") ? s : `https://${s}/`)) : DEFAULT_SITES;
const doAsk = args.includes("--ask");
const control = args.includes("--control"); // no widget injected: measures the host page's own drift over the same window
const ASK_TIMEOUT_MS = 45000;

const isPortfolio = (u) => u.includes("127.0.0.1:4300");

async function hostSnapshot(page) {
  return page.evaluate(() => {
    const h = document.querySelector("h1") || document.body;
    return {
      bodyFont: getComputedStyle(document.body).fontFamily,
      h1Font: getComputedStyle(h).fontFamily,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      title: document.title,
      h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 120),
    };
  });
}

async function inject(page) {
  // addInitScript-style injection is not used on purpose: we inject post-load, like a real embed.
  await page.addStyleTag({ content: CSS }).then(async () => {
    await page.evaluate(() => {
      const last = document.head.querySelector("style:last-of-type");
      if (last) last.id = "on-device-chat-styles"; // stops the widget fetching CSS from jsDelivr
    });
  });
  await page.addScriptTag({ content: JS });
  return page.evaluate(() => {
    try {
      if (!window.OnDeviceChat) return { ok: false, err: "window.OnDeviceChat missing after bundle eval" };
      window.OnDeviceChat.init({ defaultOpen: false });
      return { ok: true };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  });
}

async function launcherChecks(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-g4-widget]");
    if (!root) return { mounted: false };
    const btn = root.querySelector("button");
    const r = (btn || root).getBoundingClientRect();
    const inView = r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { mounted: true, inView, reachable: !!(hit && hit.closest("[data-g4-widget]")), rect: [r.left, r.top, r.width, r.height].map(Math.round) };
  });
}

async function openChecks(page) {
  const btn = page.locator("[data-g4-widget] button[title='Open On-Device AI Assistant']");
  if (!(await btn.count())) return { opens: false, why: "launcher button not found" };
  await btn.first().click({ timeout: 5000 }).catch((e) => ({ err: String(e) }));
  const card = page.locator("[data-g4-widget] .g4-window-card");
  try {
    await card.first().waitFor({ state: "visible", timeout: 5000 });
  } catch {
    return { opens: false, why: "panel did not appear" };
  }
  return page.evaluate(() => {
    const c = document.querySelector("[data-g4-widget] .g4-window-card");
    const r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return {
      opens: true,
      fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      reachable: !!(hit && hit.closest("[data-g4-widget]")),
      rect: [r.left, r.top, r.width, r.height].map(Math.round),
    };
  });
}

const engineErrors = [];
async function engineState(page, waitMs) {
  const input = page.locator("[data-g4-widget] input[type=text]").first();
  const deadline = Date.now() + waitMs;
  let placeholder = "";
  while (Date.now() < deadline) {
    placeholder = (await input.getAttribute("placeholder", { timeout: 2000 }).catch(() => "")) || "";
    if (placeholder && !/Initializing/i.test(placeholder)) break;
    await page.waitForTimeout(500);
  }
  // Ready only if we actually read a non-"Initializing" placeholder (empty = could not read = not ready).
  return { ready: !!placeholder && !/Initializing/i.test(placeholder), placeholder, engineErrors };
}

async function ask(page, host) {
  const input = page.locator("[data-g4-widget] input[type=text]").first();
  const t0 = Date.now();
  await input.fill("What is on this page?");
  await input.press("Enter");
  const bubbles = page.locator("[data-g4-widget] .g4-messages-container > *");
  const deadline = Date.now() + ASK_TIMEOUT_MS;
  let text = "";
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const stillLoading = await input.isDisabled().catch(() => false);
    text = (await page.locator("[data-g4-widget] .g4-messages-container").innerText().catch(() => "")) || "";
    if (!stillLoading && text.length > 40) break;
  }
  const latencyMs = Date.now() - t0;
  void bubbles;
  // Heuristic grounding check (clearly a heuristic): does the reply share a content word with title/h1?
  const words = `${host.title} ${host.h1}`.toLowerCase().match(/[a-z]{5,}/g) || [];
  const lower = text.toLowerCase();
  const hit = words.find((w) => lower.includes(w)) || null;
  return { answered: text.length > 40, latencyMs, groundedKeyword: hit, text: text.slice(0, 500) };
}

async function runViewport(browser, url, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, bypassCSP: true, userAgent: undefined });
  const page = await ctx.newPage();
  engineErrors.length = 0;
  const out = { viewport: `${viewport.width}x${viewport.height}` };
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error" && /EscalationManager|Neural engine|Gemini Nano/i.test(m.text())) engineErrors.push(m.text().slice(0, 220));
  });
  let status = null;
  let cspHeader = null;
  page.on("response", (r) => {
    if (r.request().isNavigationRequest() && r.frame() === page.mainFrame() && status === null) {
      status = r.status();
      cspHeader = r.headers()["content-security-policy"] || null;
    }
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    out.status = status;
    out.csp = cspHeader ? (/script-src|default-src/.test(cspHeader) ? "restrictive" : "present-nonblocking") : "none";
    out.loaded = status !== null && status < 400;

    const preErrors = errors.length;
    const before = await hostSnapshot(page);
    // Portfolio embeds the widget natively; for every other site we inject it.
    let injected = { ok: true, native: true };
    if (control) injected = { ok: true, control: true };
    else if (!isPortfolio(url)) injected = await inject(page);
    else await page.waitForSelector("[data-g4-widget]", { timeout: 10000 }).catch(() => {});
    out.injected = injected;
    await page.waitForTimeout(1500);

    const l = control ? {} : await launcherChecks(page);
    Object.assign(out, l);
    const after = await hostSnapshot(page);
    out.hostIntact =
      after.bodyFont === before.bodyFont &&
      after.h1Font === before.h1Font &&
      after.scrollW - after.innerW <= before.scrollW - before.innerW &&
      errors.length === preErrors;
    out.hostDelta = {
      fontChanged: after.bodyFont !== before.bodyFont || after.h1Font !== before.h1Font,
      newOverflowPx: Math.max(0, after.scrollW - after.innerW - (before.scrollW - before.innerW)),
      newPageErrors: errors.length - preErrors,
    };

    if (!control && l.mounted) {
      const o = await openChecks(page);
      out.open = o;
      if (o.opens && !mobile) {
        out.engine = await engineState(page, Number(process.env.ENGINE_WAIT_MS || 20000));
        if (doAsk && out.engine.ready) out.ask = await ask(page, before);
      }
    }
    await page.screenshot({ path: path.join(here, "results", `${new URL(url).hostname.replace(/[^a-z0-9]/gi, "_")}_${mobile ? "mobile" : "desktop"}.png`) }).catch(() => {});
  } catch (e) {
    out.fatal = String(e).slice(0, 200);
  } finally {
    await ctx.close();
  }
  return out;
}

fs.mkdirSync(path.join(here, "results"), { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
for (const url of sites) {
  process.stdout.write(`→ ${url}\n`);
  const desktop = await runViewport(browser, url, { width: 1440, height: 900 }, false);
  const mobile = await runViewport(browser, url, { width: 390, height: 844 }, true);
  results.push({ url, desktop, mobile });
}
await browser.close();

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(here, "results", `site_compat_${stamp}.json`);
fs.writeFileSync(outFile, JSON.stringify({ ranAt: new Date().toISOString(), askEnabled: doAsk, results }, null, 2));

const yn = (v) => (v === undefined ? "–" : v ? "✅" : "❌");
console.log("\n| site | http | csp | mounted | reachable | host intact | opens (D) | fits (M) | engine ready |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const { url, desktop: d, mobile: m } of results) {
  console.log(
    `| ${new URL(url).host} | ${d.status ?? "ERR"} | ${d.csp ?? "–"} | ${yn(d.mounted && d.inView)} | ${yn(d.reachable)} | ${yn(d.hostIntact)} | ${yn(d.open?.opens)} | ${yn(m.open?.fits)} | ${yn(d.engine?.ready)} |`
  );
}
console.log(`\nraw results: ${outFile}`);
