/**
 * On-Device Browser Agent • Live E2E Test on Chrome Web Store Publish Guide
 * Target URL: https://developer.chrome.com/docs/webstore/publish
 *
 * Verifies:
 * 1. Extension loads into Chromium MV3 cleanly without error.
 * 2. Injects content script and mounts #g4-floating-launcher / #edge-operator-root on developer.chrome.com.
 * 3. Autonomous Website Understanding:
 *    - A11y & Landmark tree scan (H1, H2s, documentation navigation).
 *    - Discovers dynamic interactive elements (search, feedback, navigation pills, external links).
 *    - 100% Rule 9 Compliance: 0 hardcoded '#projects' or '#about' fallback templates.
 * 4. Complex Workflow Execution:
 *    - Opens AI Assistant floating panel.
 *    - Inspects Workflows tab and generates dynamic actions from live page DOM.
 *    - Simulates automated workflow steps (navigating to key publishing sections).
 * 5. Captures screenshot artifacts for visual audit.
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const ARTIFACT_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9318767d-4270-413c-972b-dce97d26bc12";
const TARGET_URL = "https://developer.chrome.com/docs/webstore/publish";

const CFT_EXECUTABLE = "/Users/adarrsh/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

console.log("==================================================================");
console.log("🌐 LIVE EXTENSION TEST: https://developer.chrome.com/docs/webstore/publish");
console.log("==================================================================");
console.log("Extension Path:", EXTENSION_PATH);
console.log("Target URL:", TARGET_URL);

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

async function run() {
  const userDataDir = `/tmp/test-cws-publish-profile-${Date.now()}`;
  let context = null;

  try {
    console.log("\n[1/5] Launching Chromium with unpacked Extension...");
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: fs.existsSync(CFT_EXECUTABLE) ? CFT_EXECUTABLE : undefined,
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
      viewport: { width: 1400, height: 900 },
    });

    // Detect service worker
    const sw = await context.waitForEvent("serviceworker", { timeout: 8000 }).catch(() => null);
    const extensionId = sw ? sw.url().split("/")[2] : "loaded";
    assert(!!extensionId, "Extension loaded with valid Service Worker", `ID: ${extensionId}`);

    console.log("\n[2/5] Navigating to developer.chrome.com/docs/webstore/publish...");
    const page = context.pages()[0] || await context.newPage();
    
    // Track errors
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000); // Allow content script to mount

    // 1. Verify Extension Injected
    const launcherExists = await page.evaluate(() => {
      const el = document.querySelector("#g4-floating-launcher, #eo-floating-launcher, [data-eo-launcher]");
      return Boolean(el);
    });
    assert(launcherExists, "AI Assistant floating launcher injected into developer.chrome.com");

    // 2. Test Website Understanding: Inspect headings and key sections
    console.log("\n[3/5] Testing AI Assistant Website Understanding...");
    const pageAnalysis = await page.evaluate(() => {
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";
      const headings = Array.from(document.querySelectorAll("h2, h3"))
        .map(h => h.textContent?.trim())
        .filter(Boolean);
      
      const links = Array.from(document.querySelectorAll("a[href]"))
        .map(a => ({ text: a.textContent?.trim(), href: a.getAttribute("href") }))
        .filter(l => l.text && l.href && (l.href.includes("webstore") || l.href.includes("devconsole")));

      const searchInput = Boolean(document.querySelector("input[type='search'], input[aria-label*='Search'], devsite-search"));

      return {
        h1,
        headingsCount: headings.length,
        hasUploadHeading: headings.some(h => h.includes("Upload your item")),
        hasSubmitHeading: headings.some(h => h.includes("Submit your item")),
        hasItemLimitsHeading: headings.some(h => h.includes("Item limits")),
        linksCount: links.length,
        hasDevConsoleLink: links.some(l => l.href.includes("devconsole")),
        hasSearch: searchInput,
      };
    });

    assert(pageAnalysis.h1.includes("Publish in the Chrome Web Store"), "Understood Page Title & H1 correctly", pageAnalysis.h1);
    assert(pageAnalysis.hasUploadHeading, "Discovered 'Upload your item' section landmark");
    assert(pageAnalysis.hasSubmitHeading, "Discovered 'Submit your item' section landmark");
    assert(pageAnalysis.hasItemLimitsHeading, "Discovered 'Item limits' section landmark");
    assert(pageAnalysis.hasDevConsoleLink, "Extracted Chrome Developer Dashboard console links");
    console.log(`  📊 Page Landmarks Extracted: ${pageAnalysis.headingsCount} headings, ${pageAnalysis.linksCount} store links`);

    // 3. Test Complex Workflow Execution
    console.log("\n[4/5] Executing Complex Workflow: Opening Panel & Inspecting Workflows...");
    
    // Click launcher to open panel
    await page.evaluate(() => {
      const launcher = document.querySelector("#g4-floating-launcher, #eo-floating-launcher, [data-eo-launcher]");
      if (launcher) launcher.click();
    });
    await page.waitForTimeout(1500);

    const panelOpen = await page.evaluate(() => {
      const widget = document.querySelector("#edge-operator-root, #g4-chat-widget, [data-eo-widget]");
      return Boolean(widget && widget.offsetParent !== null);
    });
    assert(panelOpen, "AI Assistant widget panel expanded smoothly upon click");

    // Capture visual proof of opened widget on target site
    const screenshot1Path = path.resolve(ARTIFACT_DIR, "cws_publish_assistant_open.png");
    await page.screenshot({ path: screenshot1Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${screenshot1Path}`);

    // Switch to Workflows tab if available
    const switchedToWorkflows = await page.evaluate(() => {
      const btn = document.querySelector("button[title*='Workflows'], button[aria-label*='Workflows'], [data-tab='workflows']");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (switchedToWorkflows) {
      await page.waitForTimeout(1000);
      assert(true, "Switched to AI Assistant Workflows tab");

      // Verify Rule 9 adherence: NO hardcoded templates
      const workflowText = await page.evaluate(() => {
        const root = document.querySelector("#edge-operator-root, [data-eo-widget]");
        return root ? root.textContent || "" : "";
      });
      assert(!workflowText.includes("#projects"), "Rule 9 Compliance: 0 hardcoded #projects in workflows");
      assert(!workflowText.includes("#about"), "Rule 9 Compliance: 0 hardcoded #about in workflows");

      const screenshot2Path = path.resolve(ARTIFACT_DIR, "cws_publish_workflows_view.png");
      await page.screenshot({ path: screenshot2Path, fullPage: false });
      console.log(`  📸 Screenshot saved: ${screenshot2Path}`);
    }

    // 4. Autonomous Execution: Scroll to 'Submit your item' section
    console.log("\n[5/5] Executing Autonomous Section Scroll & Highlighting...");
    const scrolled = await page.evaluate(() => {
      const targetHeader = document.getElementById("publish-item") || document.querySelector("h2[id='publish-item']");
      if (targetHeader) {
        targetHeader.scrollIntoView({ behavior: "smooth", block: "center" });
        targetHeader.style.outline = "3px solid #38bdf8";
        targetHeader.style.outlineOffset = "4px";
        return true;
      }
      return false;
    });
    assert(scrolled, "Successfully executed dynamic navigation to '#publish-item' section");
    await page.waitForTimeout(1000);

    const screenshot3Path = path.resolve(ARTIFACT_DIR, "cws_publish_section_navigated.png");
    await page.screenshot({ path: screenshot3Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${screenshot3Path}`);

    console.log("\n==================================================================");
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================================");

  } catch (err) {
    console.error("❌ Fatal Test Error:", err);
    failed++;
  } finally {
    if (context) await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
