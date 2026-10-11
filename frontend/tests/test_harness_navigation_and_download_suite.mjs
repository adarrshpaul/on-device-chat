import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function runTestSuite() {
  console.log("🌐 Launching Chromium for comprehensive navigation & download suite...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log("Navigating to https://paulcreates.online ...");
  await page.goto("https://paulcreates.online", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  const bundleCode = fs.readFileSync(
    "/Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/frontend/dist/on-device-chat.min.js",
    "utf8"
  );

  await page.evaluate((code) => {
    if (window.OnDeviceChat) window.OnDeviceChat.destroy();
    const old = document.querySelector("script[data-auto-init]");
    if (old) old.remove();
    eval(code);
    window.OnDeviceChat.init({ defaultOpen: true });
  }, bundleCode);

  await page.waitForTimeout(1000);

  const testQueries = [
    { query: "download resume", expectedType: "download" },
    { query: "download cv", expectedType: "download" },
    { query: "get resume", expectedType: "download" },
    { query: "go to projects", expectedType: "nav" },
    { query: "about", expectedType: "nav" },
  ];

  for (const { query, expectedType } of testQueries) {
    console.log(`\n🧪 Testing: "${query}" (expected: ${expectedType})...`);
    const input = await page.$("#gemma4-widget-root textarea, #gemma4-widget-root input");
    if (!input) throw new Error("Input not found");

    await input.fill(query);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);

    const latestMessage = await page.evaluate(() => {
      const root = document.getElementById("gemma4-widget-root");
      const msgEls = Array.from(root.querySelectorAll(".prose, [data-message-role], .g4-message, p"));
      const texts = msgEls.map(m => m.textContent?.trim()).filter(Boolean);
      return texts[texts.length - 1] || "";
    });

    console.log(`💬 Assistant response: ${latestMessage}`);

    if (expectedType === "download") {
      if (!latestMessage.includes("Triggered download") || !latestMessage.includes("Resume")) {
        throw new Error(`Expected download response, got: ${latestMessage}`);
      }
      console.log(`✅ PASSED: Correctly executed download action.`);
    } else if (expectedType === "nav") {
      if (!latestMessage.includes("Navigated")) {
        throw new Error(`Expected navigation response, got: ${latestMessage}`);
      }
      console.log(`✅ PASSED: Correctly executed landmark navigation.`);
    }
  }

  await page.screenshot({ path: "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/download_and_nav_suite_verified.png" });
  console.log("\n🎉 All 5/5 test cases passed successfully!");
  await browser.close();
}

runTestSuite().catch((err) => {
  console.error("❌ Suite error:", err);
  process.exit(1);
});
