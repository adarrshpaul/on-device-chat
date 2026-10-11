import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function testDownloadResume() {
  console.log("🌐 Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log("Navigating to https://paulcreates.online ...");
  await page.goto("https://paulcreates.online", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  // Destroy old instance, inject new bundle, and re-init!
  console.log("Destroying old instance and injecting fresh local bundle...");
  const reinitResult = await page.evaluate(async (bundleCode) => {
    if (window.OnDeviceChat) {
      window.OnDeviceChat.destroy();
    }
    const oldScript = document.querySelector("script[data-auto-init]");
    if (oldScript) oldScript.remove();

    // Execute bundle
    eval(bundleCode);

    if (window.OnDeviceChat) {
      window.OnDeviceChat.init({ defaultOpen: true });
      return { success: true };
    }
    return { success: false, reason: "No OnDeviceChat after eval" };
  }, fs.readFileSync("/Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/frontend/dist/on-device-chat.min.js", "utf8"));

  console.log("Reinit result:", reinitResult);
  await page.waitForTimeout(1500);

  const input = await page.$("#gemma4-widget-root textarea, #gemma4-widget-root input");
  console.log("Found chat input:", !!input);

  if (input) {
    await input.fill("download resume");
    await page.keyboard.press("Enter");
    console.log("Submitted 'download resume' to chat...");
    await page.waitForTimeout(3500);

    const result = await page.evaluate(() => {
      const root = document.getElementById("gemma4-widget-root");
      const msgEls = Array.from(root.querySelectorAll(".prose, [data-message-role], .g4-message, p"));
      const texts = msgEls.map(m => m.textContent?.trim()).filter(Boolean);
      return {
        messages: texts.slice(-4),
        spotlightPresent: !!document.getElementById("g4-agent-spotlight"),
      };
    });

    console.log("\n=================== 📥 LIVE TEST RESULT ===================");
    console.log("Messages in Chat:\n", result.messages);
    console.log("Spotlight Present:", result.spotlightPresent);
    console.log("===========================================================\n");

    const screenshotPath = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/download_resume_fixed_live.png";
    await page.screenshot({ path: screenshotPath });
    console.log("Screenshot saved to:", screenshotPath);
  }

  await browser.close();
}

testDownloadResume().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
