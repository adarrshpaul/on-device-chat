import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function inspectWidget() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log("Navigating to https://paulcreates.online ...");
  await page.goto("https://paulcreates.online", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const root = document.getElementById("gemma4-widget-root");
    if (!root) return { hasRoot: false };
    const html = root.innerHTML.slice(0, 300);
    const buttons = Array.from(root.querySelectorAll("button")).map(b => ({
      text: b.textContent?.trim(),
      aria: b.getAttribute("aria-label"),
      cls: b.className
    }));
    return { hasRoot: true, buttons, snippet: html };
  });

  console.log("Widget Info:", info);

  // If chat is collapsed, click the launcher button
  if (info.hasRoot) {
    const launcher = await page.$("#gemma4-widget-root button");
    if (launcher) {
      await launcher.click();
      await page.waitForTimeout(1000);
    }

    const input = await page.$("#gemma4-widget-root textarea, #gemma4-widget-root input");
    console.log("Found chat input:", !!input);
    if (input) {
      await input.fill("download resume");
      await page.keyboard.press("Enter");
      console.log("Submitted 'download resume'!");
      await page.waitForTimeout(3500);

      const msgs = await page.evaluate(() => {
        const root = document.getElementById("gemma4-widget-root");
        const msgEls = Array.from(root.querySelectorAll(".prose, [data-message-role], .g4-message, p"));
        return msgEls.map(m => m.textContent?.trim()).filter(Boolean).slice(-6);
      });
      console.log("Messages in Chat:\n", msgs);

      await page.screenshot({ path: "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/download_resume_reproduced_live.png" });
      console.log("Captured screenshot!");
    }
  }

  await browser.close();
}

inspectWidget().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
