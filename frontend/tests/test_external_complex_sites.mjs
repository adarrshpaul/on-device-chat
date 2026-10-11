/**
 * Live External Complex Website Testing Suite
 * Tests Chrome Extension against real-world production websites:
 * 1. Books to Scrape (e-commerce catalog with 20 items/page, categories, star ratings, prices)
 * 2. SauceDemo (interactive multi-step e-commerce store with inputs, sorting, cart actions)
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const CFT_EXECUTABLE = "/Users/adarrsh/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const ARTIFACT_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136";

console.log("==================================================================");
console.log("🌍 Testing Extension on Complex Real-World E-Commerce Websites");
console.log("==================================================================");

async function runTest() {
  const userDataDir = `/tmp/test-ext-complex-sites-${Date.now()}`;
  let context = null;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: CFT_EXECUTABLE,
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--no-default-browser-check"
      ],
      viewport: { width: 1280, height: 850 }
    });

    const page = context.pages()[0] || await context.newPage();

    // -------------------------------------------------------------
    // SITE 1: Books to Scrape (Real Multi-Product E-Commerce Catalog)
    // -------------------------------------------------------------
    console.log("\n=========================================================");
    console.log("TEST 1: Books to Scrape (https://books.toscrape.com/)");
    console.log("=========================================================");

    await page.goto("https://books.toscrape.com/", { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("Page loaded. Title:", await page.title());

    // Check for launcher button
    const launcherSelector = "#g4-floating-launcher, .g4-launcher-button";
    await page.waitForSelector(launcherSelector, { state: "visible", timeout: 8000 });
    console.log("✅ Floating launcher appeared on Books to Scrape!");

    // Capture screenshot of host page with floating launcher
    const btsScreenshot1 = path.join(ARTIFACT_DIR, "complex_bts_page_with_launcher.png");
    await page.screenshot({ path: btsScreenshot1 });
    console.log("📸 Screenshot saved:", btsScreenshot1);

    // Expand chat widget
    console.log("Expanding chat widget...");
    await page.click(launcherSelector);
    await page.waitForTimeout(1500);

    // Verify chat window opened
    const chatRoot = await page.$("#gemma4-widget-root");
    const widgetText = await page.$eval("#gemma4-widget-root", el => el.innerText);
    console.log("Chat opened! Active domain in widget:", widgetText.includes("books.toscrape.com") ? "YES" : "NO");

    const btsScreenshot2 = path.join(ARTIFACT_DIR, "complex_bts_chat_opened.png");
    await page.screenshot({ path: btsScreenshot2 });
    console.log("📸 Screenshot saved:", btsScreenshot2);

    // Test Entity Detection on Books to Scrape:
    // Does the agent find the 20 book items on this unfamiliar page?
    const entityResult = await page.evaluate(() => {
      if (window.OnDeviceChat && window.OnDeviceChat.MacroRecorder) {
        // Look for book elements
        const sampleBook = document.querySelector("article.product_pod, .product_pod, li.col-xs-6");
        if (sampleBook) {
          const siblings = window.OnDeviceChat.MacroRecorder.findSiblingEntities(sampleBook);
          return { foundSample: true, count: siblings.length };
        }
      }
      return { foundSample: false, count: 0 };
    });
    console.log("DOM Sibling Entity Detection on Books to Scrape:", entityResult);

    // Test Triggering Teach 1 -> Batch N Macro on Books to Scrape
    const macroBtn = await page.$("button:has-text('Teach 1'), button:has-text('Batch')");
    if (macroBtn) {
      console.log("Clicking Teach 1 → Batch N Macro button...");
      await macroBtn.click();
      await page.waitForTimeout(1200);

      const btsScreenshot3 = path.join(ARTIFACT_DIR, "complex_bts_macro_active.png");
      await page.screenshot({ path: btsScreenshot3 });
      console.log("📸 Macro screenshot saved:", btsScreenshot3);

      // Now simulate a click on "Add to basket" on the first book (Row 1)
      console.log("Simulating user demonstration on Book 1 ('Add to basket')...");
      const firstAddBtn = await page.$("article.product_pod:first-of-type button[type='submit'], .product_pod button");
      if (firstAddBtn) {
        await firstAddBtn.click();
        await page.waitForTimeout(1000);
      }

      // Finish recording
      const doneBtn = await page.$("button:has-text('Done Recording')");
      if (doneBtn) {
        console.log("Clicking Done Recording...");
        await doneBtn.click();
        await page.waitForTimeout(1500);

        const btsScreenshot4 = path.join(ARTIFACT_DIR, "complex_bts_batch_confirmation.png");
        await page.screenshot({ path: btsScreenshot4 });
        console.log("📸 Batch confirmation card screenshot saved:", btsScreenshot4);
      }
    }

    // -------------------------------------------------------------
    // SITE 2: SauceDemo (Interactive React E-Commerce Store)
    // -------------------------------------------------------------
    console.log("\n=========================================================");
    console.log("TEST 2: SauceDemo (https://www.saucedemo.com/)");
    console.log("=========================================================");

    await page.goto("https://www.saucedemo.com/", { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("SauceDemo loaded. Title:", await page.title());

    // Check launcher on login page
    await page.waitForSelector(launcherSelector, { state: "visible", timeout: 8000 });
    console.log("✅ Floating launcher appeared on SauceDemo login page!");

    // Capture screenshot of login page
    const sdScreenshot1 = path.join(ARTIFACT_DIR, "complex_saucedemo_login.png");
    await page.screenshot({ path: sdScreenshot1 });
    console.log("📸 Screenshot saved:", sdScreenshot1);

    // Perform standard login to get into the complex inventory dashboard
    console.log("Logging into SauceDemo standard_user...");
    await page.fill("#user-name", "standard_user");
    await page.fill("#password", "secret_sauce");
    await page.click("#login-button");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    console.log("Logged into inventory. Title:", await page.title());

    // Verify launcher is still present after page redirect / SPA navigation
    await page.waitForSelector(launcherSelector, { state: "visible", timeout: 8000 });
    console.log("✅ Floating launcher persisted after login redirect!");

    const sdScreenshot2 = path.join(ARTIFACT_DIR, "complex_saucedemo_inventory_with_launcher.png");
    await page.screenshot({ path: sdScreenshot2 });
    console.log("📸 Screenshot saved:", sdScreenshot2);

    // Open chat on inventory page
    await page.click(launcherSelector);
    await page.waitForTimeout(1500);

    const sdScreenshot3 = path.join(ARTIFACT_DIR, "complex_saucedemo_chat_opened.png");
    await page.screenshot({ path: sdScreenshot3 });
    console.log("📸 Screenshot saved:", sdScreenshot3);

    // Test Teach 1 -> Batch N on SauceDemo inventory items
    console.log("Testing Teach 1 → Batch N on SauceDemo inventory items...");
    const sdMacroBtn = await page.$("button:has-text('Teach 1'), button:has-text('Batch')");
    if (sdMacroBtn) {
      await sdMacroBtn.click();
      await page.waitForTimeout(1200);

      // Perform user demonstration: click "Add to cart" on item 1
      const item1AddBtn = await page.$(".inventory_item:first-of-type button");
      if (item1AddBtn) {
        console.log("Clicking 'Add to cart' on Item 1...");
        await item1AddBtn.click();
        await page.waitForTimeout(1000);
      }

      // Finish recording
      const doneBtn = await page.$("button:has-text('Done Recording')");
      if (doneBtn) {
        await doneBtn.click();
        await page.waitForTimeout(1500);

        const sdScreenshot4 = path.join(ARTIFACT_DIR, "complex_saucedemo_batch_confirmation.png");
        await page.screenshot({ path: sdScreenshot4 });
        console.log("📸 SauceDemo confirmation card saved:", sdScreenshot4);
      }
    }

    console.log("\n=========================================================");
    console.log("🎉 Complex External E-Commerce Site Tests Completed!");
    console.log("=========================================================");

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    if (context) await context.close();
  }
}

runTest();
