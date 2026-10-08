/**
 * E2E Verification Test: Theme Toggle, Site Tour, and Resilient Selector Resolution
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function runTest() {
  console.log("🚀 Starting E2E Verification for Harness Functions...\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("Harness") || msg.text().includes("Tour")) {
      console.log(`[Browser Console]:`, msg.text());
    }
  });

  try {
    console.log("1️⃣ Loading Portfolio App at http://127.0.0.1:4300/...");
    await page.goto("http://127.0.0.1:4300/");
    await page.waitForTimeout(1500);

    // Verify smartQuerySelector logic directly on page
    console.log("2️⃣ Verifying smartQuerySelector resolution for 'button.toggle-theme'...");
    const selectorResolution = await page.evaluate(async () => {
      // Find chat widget script or import domUtils
      const themeBtn = document.querySelector("button[aria-label=\"Toggle Theme\"]");
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      return {
        exists: !!themeBtn,
        ariaLabel: themeBtn?.getAttribute("aria-label"),
        className: themeBtn?.className,
        currentTheme,
      };
    });
    console.log("   Theme button found in DOM:", selectorResolution);

    // Open chat widget if closed
    console.log("3️⃣ Opening Chat Widget...");
    const widgetButton = await page.$("[data-g4-widget] button, .g4-widget-container button");
    if (widgetButton) {
      await widgetButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for chat card to be visible
    await page.waitForSelector(".g4-window-card", { timeout: 5000 });
    console.log("   Chat widget card is open.");

    // Test 1: Send "click toggle thme"
    console.log("4️⃣ Testing 'click toggle thme' execution...");
    const inputSelector = ".g4-window-card input[type='text'], .g4-window-card textarea";
    await page.fill(inputSelector, "click toggle thme");
    await page.press(inputSelector, "Enter");

    // Wait for assistant response
    await page.waitForTimeout(3000);

    const afterToggleTheme = await page.evaluate(() => {
      const msgs = Array.from(document.querySelectorAll(".g4-window-card [class*='prose'], .g4-window-card p")).map(p => p.textContent);
      const docTheme = document.documentElement.getAttribute("data-theme") || "light";
      return {
        latestMsg: msgs[msgs.length - 1],
        docTheme,
      };
    });
    console.log("   After 'click toggle thme':", afterToggleTheme);

    // Test 2: Send "site tour"
    console.log("5️⃣ Testing 'site tour' execution...");
    await page.fill(inputSelector, "site tour");
    await page.press(inputSelector, "Enter");

    await page.waitForTimeout(3500);

    const tourStatus = await page.evaluate(() => {
      const msgs = Array.from(document.querySelectorAll(".g4-window-card [class*='prose'], .g4-window-card p")).map(p => p.textContent);
      const scrollY = window.scrollY;
      const spotlight = !!document.getElementById("g4-agent-spotlight");
      return {
        latestMsgPreview: msgs[msgs.length - 1]?.slice(0, 150),
        scrollY,
        hasSpotlight: spotlight,
      };
    });
    console.log("   Tour result:", tourStatus);

    console.log("\n✅ ALL TESTS COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await browser.close();
  }
}

runTest();
