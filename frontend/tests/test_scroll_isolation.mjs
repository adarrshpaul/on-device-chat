/**
 * Scroll Isolation & Anti-Scroll Bleed Verification Test
 * Verifies that mouse wheel / trackpad scrolling inside the chat widget
 * NEVER causes the host webpage underneath to scroll.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function runScrollTest() {
  console.log("🚀 Testing Chat Widget Scroll Isolation against Background Scroll Bleed...\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    console.log("-> Navigating to Portfolio App (http://127.0.0.1:4300/)...");
    await page.goto("http://127.0.0.1:4300/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1000);

    const initialHostScroll = await page.evaluate(() => window.scrollY);
    console.log(`   Initial host window.scrollY: ${initialHostScroll}px`);

    // 1. Open the widget
    const card = page.locator("[data-g4-widget] .g4-window-card");
    if (!(await card.isVisible().catch(() => false))) {
      const launcher = page.locator("[data-g4-widget] button[title='Open On-Device AI Assistant']");
      if (await launcher.count()) {
        await launcher.first().click();
      }
      await card.first().waitFor({ state: "visible", timeout: 8000 });
    }
    console.log("   ✓ Chat widget opened.");

    // Get bounding box of the widget card
    const cardBox = await card.boundingBox();
    if (!cardBox) throw new Error("Could not get bounding box of .g4-window-card");
    console.log(`   Widget bounds: (${Math.round(cardBox.x)}, ${Math.round(cardBox.y)}, ${Math.round(cardBox.width)}x${Math.round(cardBox.height)})`);

    // 2. Test Wheel over Header (non-scrollable area)
    console.log("\n-> Test 1: Mouse wheel over Widget Header...");
    const headerX = cardBox.x + cardBox.width / 2;
    const headerY = cardBox.y + 25; // Header area
    await page.mouse.move(headerX, headerY);
    await page.mouse.wheel(0, 400); // Try to scroll down
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -400); // Try to scroll up
    await page.waitForTimeout(300);

    const hostScrollAfterHeader = await page.evaluate(() => window.scrollY);
    console.log(`   Host window.scrollY after header wheel: ${hostScrollAfterHeader}px`);
    if (hostScrollAfterHeader !== initialHostScroll) {
      throw new Error(`Background page scrolled from ${initialHostScroll} to ${hostScrollAfterHeader} while scrolling header!`);
    }
    console.log("   ✓ Host page stayed locked at 0px when scrolling over header.");

    // 3. Test Wheel over Input Area (non-scrollable area)
    console.log("\n-> Test 2: Mouse wheel over Widget Input Area...");
    const inputY = cardBox.y + cardBox.height - 35;
    await page.mouse.move(headerX, inputY);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);

    const hostScrollAfterInput = await page.evaluate(() => window.scrollY);
    console.log(`   Host window.scrollY after input wheel: ${hostScrollAfterInput}px`);
    if (hostScrollAfterInput !== initialHostScroll) {
      throw new Error(`Background page scrolled from ${initialHostScroll} to ${hostScrollAfterInput} while scrolling input!`);
    }
    console.log("   ✓ Host page stayed locked at 0px when scrolling over input bar.");

    // 4. Test Wheel inside Messages Container at Boundaries
    console.log("\n-> Test 3: Mouse wheel inside Messages Container at boundary limits...");
    const bodyY = cardBox.y + cardBox.height / 2;
    await page.mouse.move(headerX, bodyY);

    // Extreme upward scroll when already at top
    await page.mouse.wheel(0, -1000);
    await page.waitForTimeout(300);

    const hostScrollAfterTopBound = await page.evaluate(() => window.scrollY);
    console.log(`   Host window.scrollY after top boundary wheel: ${hostScrollAfterTopBound}px`);
    if (hostScrollAfterTopBound !== initialHostScroll) {
      throw new Error(`Background page scrolled on top boundary: ${hostScrollAfterTopBound}px`);
    }
    console.log("   ✓ Top boundary momentum did NOT leak to background.");

    // Extreme downward scroll
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(300);

    const hostScrollAfterBottomBound = await page.evaluate(() => window.scrollY);
    console.log(`   Host window.scrollY after bottom boundary wheel: ${hostScrollAfterBottomBound}px`);
    if (hostScrollAfterBottomBound !== initialHostScroll) {
      throw new Error(`Background page scrolled on bottom boundary: ${hostScrollAfterBottomBound}px`);
    }
    console.log("   ✓ Bottom boundary momentum did NOT leak to background.");

    // 5. Test Wheel inside Navigation Hub tab
    console.log("\n-> Test 4: Mouse wheel inside Navigation Hub tab...");
    const navHubBtn = page.locator("[data-g4-widget] button:has-text('Nav Hub')").first();
    await navHubBtn.click();
    await page.waitForTimeout(500);

    // Scroll through the landmark list
    await page.mouse.move(headerX, bodyY);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(300);

    const hostScrollAfterNavHub = await page.evaluate(() => window.scrollY);
    console.log(`   Host window.scrollY after Nav Hub scrolling: ${hostScrollAfterNavHub}px`);
    if (hostScrollAfterNavHub !== initialHostScroll) {
      throw new Error(`Background page scrolled while using Nav Hub: ${hostScrollAfterNavHub}px`);
    }
    console.log("   ✓ Nav Hub scroll was 100% contained within widget.");

    console.log("\n=======================================================");
    console.log("🎉 SCROLL ISOLATION TEST: 100% PASSED!");
    console.log("Website underneath NEVER scrolled during widget interaction.");
    console.log("=======================================================");
  } finally {
    await browser.close();
  }
}

runScrollTest().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
