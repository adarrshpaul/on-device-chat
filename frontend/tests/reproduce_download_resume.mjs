import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function testDownloadResume() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log("Navigating to https://paulcreates.online ...");
  await page.goto("https://paulcreates.online", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if chat widget button exists
  const chatBtn = await page.$("button[aria-label*='Chat' i], button[aria-label*='Ask' i], button.g4-launch-btn, [data-g4-launch]");
  console.log("Chat button found:", !!chatBtn);

  if (chatBtn) {
    await chatBtn.click();
    await page.waitForTimeout(1000);
  }

  // Find chat input textarea or input
  const inputEl = await page.$("textarea, input[placeholder*='Ask' i], input[placeholder*='message' i], .g4-chat-input");
  console.log("Input found:", !!inputEl);

  if (inputEl) {
    await inputEl.fill("download resume");
    await page.keyboard.press("Enter");
    console.log("Sent 'download resume' to chat input...");
    await page.waitForTimeout(3000);

    // Get last assistant message
    const messages = await page.evaluate(() => {
      const msgs = Array.from(document.querySelectorAll(".g4-message, [data-message-role], .prose, .message"));
      return msgs.map(m => m.textContent?.trim()).filter(Boolean);
    });
    console.log("Chat messages:", messages.slice(-3));

    // Capture screenshot
    await page.screenshot({ path: "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/download_resume_reproduce.png" });
    console.log("Screenshot saved.");
  }

  await browser.close();
}

testDownloadResume().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
