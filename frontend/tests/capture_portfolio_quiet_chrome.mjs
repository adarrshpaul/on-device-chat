import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function capture() {
  console.log("📸 Capturing portfolio quiet chrome screenshots...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:4300/");
  await page.waitForTimeout(1500);

  // 1. Open widget
  const widgetButton = await page.$("[data-g4-widget] button, .g4-widget-container button");
  if (widgetButton) {
    await widgetButton.click();
    await page.waitForTimeout(600);
  }

  await page.waitForSelector(".g4-window-card", { timeout: 5000 });

  // Capture empty state
  await page.screenshot({
    path: "/Users/adarrsh/.gemini/antigravity/brain/5543457e-561a-41e2-beaa-8b771acceca5/portfolio_quiet_empty_state.png",
    fullPage: false,
  });
  console.log("✅ Captured portfolio_quiet_empty_state.png");

  // 2. Open overflow menu (•••)
  const overflowBtn = await page.$("button[title='More Views & Studio']");
  if (overflowBtn) {
    await overflowBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "/Users/adarrsh/.gemini/antigravity/brain/5543457e-561a-41e2-beaa-8b771acceca5/portfolio_quiet_overflow_menu.png",
      fullPage: false,
    });
    console.log("✅ Captured portfolio_quiet_overflow_menu.png");
    // Click outside to dismiss popover
    await page.click(".g4-window-card");
    await page.waitForTimeout(300);
  }

  // 3. Send query "What actions can you perform on this page?"
  const inputSelector = ".g4-window-card input[type='text'], .g4-window-card textarea";
  await page.fill(inputSelector, "What actions can you perform on this page?");
  await page.press(inputSelector, "Enter");
  await page.waitForTimeout(3000);

  // Capture thread view with DecisionCard
  await page.screenshot({
    path: "/Users/adarrsh/.gemini/antigravity/brain/5543457e-561a-41e2-beaa-8b771acceca5/portfolio_quiet_thread_view.png",
    fullPage: false,
  });
  console.log("✅ Captured portfolio_quiet_thread_view.png");

  await browser.close();
  console.log("🎉 All captures complete!");
}

capture().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
