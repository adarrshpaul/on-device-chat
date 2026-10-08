/**
 * E2E Verification Test: Actions Inquiry vs Action Macros
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function runTest() {
  console.log("🚀 Testing 'What actions can you perform on this page?' & Macro Isolation...\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("http://127.0.0.1:4300/");
    await page.waitForTimeout(1500);

    // Open chat widget
    const widgetButton = await page.$("[data-g4-widget] button, .g4-widget-container button");
    if (widgetButton) {
      await widgetButton.click();
      await page.waitForTimeout(500);
    }

    await page.waitForSelector(".g4-window-card", { timeout: 5000 });
    console.log("1️⃣ Chat widget is open.");

    // Query 1: "What actions can you perform on this page?"
    console.log("2️⃣ Sending 'What actions can you perform on this page?'...");
    const inputSelector = ".g4-window-card input[type='text'], .g4-window-card textarea";
    await page.fill(inputSelector, "What actions can you perform on this page?");
    await page.press(inputSelector, "Enter");

    await page.waitForTimeout(2500);

    const result = await page.evaluate(() => {
      const msgs = Array.from(document.querySelectorAll(".g4-window-card [class*='prose'], .g4-window-card p")).map(p => p.textContent);
      const latest = msgs[msgs.length - 1] || "";
      return {
        isMacro: latest.includes("Executed verified site recipe"),
        hasThemeAction: latest.includes("Theme Control") || latest.includes("toggle theme"),
        hasSiteTour: latest.includes("Site Tour") || latest.includes("site tour"),
        fullTextPreview: latest.slice(0, 200),
      };
    });

    console.log("   Result:", result);

    if (result.isMacro) {
      throw new Error("FAILED: Informational question was hijacked by an action macro!");
    }
    if (!result.hasThemeAction || !result.hasSiteTour) {
      throw new Error("FAILED: Response did not detail available interactive actions!");
    }

    console.log("✅ Query answered with full capabilities breakdown, 0 false macro executions!");
    console.log("\n✅ ALL TESTS COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
