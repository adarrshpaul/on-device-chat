import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function testShadow() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log("Navigating to https://paulcreates.online ...");
  await page.goto("https://paulcreates.online", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const shadowInfo = await page.evaluate(async () => {
    const chatEl = document.querySelector("on-device-chat");
    if (!chatEl || !chatEl.shadowRoot) {
      return { found: false, error: "No shadowRoot on <on-device-chat>" };
    }
    const root = chatEl.shadowRoot;
    const allButtons = Array.from(root.querySelectorAll("button")).map(b => ({
      text: b.textContent?.trim(),
      ariaLabel: b.getAttribute("aria-label"),
      className: b.className
    }));

    // Find launch button and click it to open chat window
    const launchBtn = root.querySelector("button[aria-label*='Ask' i], button[aria-label*='Chat' i], button");
    if (launchBtn) {
      launchBtn.click();
    }

    return {
      found: true,
      buttons: allButtons,
      hasTextarea: !!root.querySelector("textarea, input")
    };
  });

  console.log("Shadow DOM Info:", shadowInfo);
  await page.waitForTimeout(1500);

  // Now type into the chat within shadow DOM
  const chatResponse = await page.evaluate(async () => {
    const chatEl = document.querySelector("on-device-chat");
    const root = chatEl.shadowRoot;
    const input = root.querySelector("textarea, input[type='text']");
    if (!input) return { error: "No input found in shadowRoot" };

    input.value = "download resume";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const form = input.closest("form");
    const sendBtn = root.querySelector("button[type='submit'], button[aria-label*='Send' i]");
    if (sendBtn) {
      sendBtn.click();
    } else if (form) {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    } else {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    }

    // Wait for response
    await new Promise(r => setTimeout(r, 4000));

    // Get all text content from conversation container
    const dialog = root.querySelector("[role='dialog'], .g4-window-card, main") || root;
    return {
      dialogSnippet: dialog.textContent?.slice(-800) || "",
    };
  });

  console.log("Chat Response Snippet:\n", chatResponse);

  await page.screenshot({ path: "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/download_resume_live_chat.png" });
  console.log("Screenshot saved to download_resume_live_chat.png");

  await browser.close();
}

testShadow().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
