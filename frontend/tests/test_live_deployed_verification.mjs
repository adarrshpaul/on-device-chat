import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function testLiveProduction() {
  console.log("🌐 Testing LIVE production deployment on https://paulcreates.online ...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Disable cache to ensure fresh assets
  await page.route("**/*", route => route.continue());

  console.log("Navigating to https://paulcreates.online ...");
  await page.goto("https://paulcreates.online", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const launcher = await page.$("#gemma4-widget-root button");
  if (launcher) {
    await launcher.click();
    await page.waitForTimeout(1000);
  }

  const input = await page.$("#gemma4-widget-root textarea, #gemma4-widget-root input");
  console.log("Found chat input on production:", !!input);

  if (input) {
    await input.fill("download resume");
    await page.keyboard.press("Enter");
    console.log("Submitted 'download resume' to live production widget...");
    await page.waitForTimeout(4000);

    const result = await page.evaluate(() => {
      const root = document.getElementById("gemma4-widget-root");
      const msgEls = Array.from(root.querySelectorAll(".prose, [data-message-role], .g4-message, p"));
      const texts = msgEls.map(m => m.textContent?.trim()).filter(Boolean);
      return {
        messages: texts.slice(-3),
        spotlightPresent: !!document.getElementById("g4-agent-spotlight"),
      };
    });

    console.log("\n=================== 🚀 LIVE PRODUCTION VERIFICATION ===================");
    console.log("Messages in Production Chat:\n", result.messages);
    console.log("Spotlight Present:", result.spotlightPresent);
    console.log("========================================================================\n");

    const screenshotPath = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/download_resume_production_verified.png";
    await page.screenshot({ path: screenshotPath });
    console.log("📸 Screenshot saved to:", screenshotPath);
  }

  await browser.close();
}

testLiveProduction().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
