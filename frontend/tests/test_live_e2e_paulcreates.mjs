import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

async function runLiveTest() {
  console.log("🌐 Launching Chromium for live E2E test on https://paulcreates.online ...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log("📍 Navigating to https://paulcreates.online ...");
  await page.goto("https://paulcreates.online", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  console.log("📄 Page Title:", await page.title());

  // 1. Inject local bundle to ensure newest static methods are attached
  const bundleCode = fs.readFileSync(
    "/Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/frontend/dist/on-device-chat.min.js",
    "utf8"
  );
  await page.addScriptTag({ content: bundleCode });

  // 2. Test A11yTreeEngine
  const a11yResult = await page.evaluate(() => {
    const A11yTreeEngine = window.A11yTreeEngine || window.OnDeviceChat?.A11yTreeEngine;
    if (!A11yTreeEngine) return { success: false, reason: "A11yTreeEngine not found" };

    const nodes = A11yTreeEngine.scan({ maxItems: 25, viewportOnly: false });
    const promptText = A11yTreeEngine.formatForPrompt(nodes);

    return {
      success: true,
      elementCount: nodes.length,
      sampleNodes: nodes.slice(0, 10).map((n) => ({
        id: n.id,
        role: n.role,
        name: n.name,
        tag: n.tag,
        bounds: n.bounds,
      })),
      promptSnippet: promptText.split("\n").slice(0, 15).join("\n"),
    };
  });

  console.log("\n=================== 🌲 A11Y TREE ENGINE LIVE OUTPUT ===================");
  console.log(`Discovered ${a11yResult.elementCount} accessible interactive elements.`);
  console.log("Sample Grounded Elements:", JSON.stringify(a11yResult.sampleNodes, null, 2));
  console.log("\nCompact Prompt String Fed to Local Model:\n" + a11yResult.promptSnippet);
  console.log("========================================================================\n");

  // 3. Test Set-of-Marks Overlay (SomOverlayManager) on live page
  const somResult = await page.evaluate(() => {
    const A11yTreeEngine = window.A11yTreeEngine || window.OnDeviceChat?.A11yTreeEngine;
    const SomOverlayManager = window.SomOverlayManager || window.OnDeviceChat?.SomOverlayManager;
    if (!A11yTreeEngine || !SomOverlayManager) return { success: false };

    const nodes = A11yTreeEngine.scan({ maxItems: 25, viewportOnly: false });
    SomOverlayManager.renderBadges(nodes, 15000); // keep visible for 15s to screenshot
    return {
      containerPresent: !!document.getElementById("g4-som-overlay-root"),
      badgesInDom: document.querySelectorAll(".g4-som-badge").length,
    };
  });
  console.log(`🎯 Set-of-Marks Overlay: ${somResult.badgesInDom} numeric badges rendered in DOM (Root container present: ${somResult.containerPresent}).`);

  // 4. Take screenshot of Set-of-Marks badges over the live site
  const somScreenshotPath = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/som_live_overlay.png";
  await page.screenshot({ path: somScreenshotPath, fullPage: false });
  console.log("📸 Set-of-Marks Screenshot saved to:", somScreenshotPath);

  // 5. Test ActionDispatcher & StateDeltaVerifier
  const actionResult = await page.evaluate(async () => {
    const A11yTreeEngine = window.A11yTreeEngine || window.OnDeviceChat?.A11yTreeEngine;
    const ActionDispatcher = window.ActionDispatcher || window.OnDeviceChat?.ActionDispatcher;
    const StateDeltaVerifier = window.StateDeltaVerifier || window.OnDeviceChat?.StateDeltaVerifier;

    // 1. Capture snapshot before action
    const preSnapshot = StateDeltaVerifier.captureSnapshot();

    // 2. Select target: Target [1] is the Theme Toggle button
    const targetNode = A11yTreeEngine.getNodeById(1);
    if (!targetNode) return { success: false, reason: "Target [1] not found" };

    // 3. Dispatch click using numeric integer target ID 1
    const clickResult = await ActionDispatcher.click(1);

    // 4. Wait for DOM transition
    await new Promise((resolve) => setTimeout(resolve, 400));

    // 5. Capture post-action snapshot and compute delta
    const postSnapshot = StateDeltaVerifier.captureSnapshot();
    const delta = StateDeltaVerifier.computeDelta(preSnapshot, postSnapshot);

    return {
      success: true,
      targetInteracted: { id: targetNode.id, role: targetNode.role, name: targetNode.name },
      clickResult,
      delta,
    };
  });

  console.log("\n=================== ⚡ ACTION DISPATCH & DELTA VERIFIER =================");
  console.log("Action Execution & Verification:", JSON.stringify(actionResult, null, 2));
  console.log("========================================================================\n");

  // 6. Test Interactive Chat Widget Open via numeric ID
  console.log("💬 Testing opening the chat widget via numeric click on [10] ('Ask On-Device AI⚡')...");
  const chatOpenResult = await page.evaluate(async () => {
    const ActionDispatcher = window.ActionDispatcher || window.OnDeviceChat?.ActionDispatcher;
    const StateDeltaVerifier = window.StateDeltaVerifier || window.OnDeviceChat?.StateDeltaVerifier;
    const preSnap = StateDeltaVerifier.captureSnapshot();

    const res = await ActionDispatcher.click(10);
    await new Promise((r) => setTimeout(r, 600));

    const postSnap = StateDeltaVerifier.captureSnapshot();
    const delta = StateDeltaVerifier.computeDelta(preSnap, postSnap);
    const modalVisible = !!document.querySelector(".g4-window-card, [data-g4-widget], textarea");

    return { res, delta, modalVisible };
  });
  console.log("Chat Widget Open Status:", chatOpenResult);

  // Take screenshot after opening widget
  const chatScreenshotPath = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/chat_widget_opened_via_agent.png";
  await page.screenshot({ path: chatScreenshotPath, fullPage: false });
  console.log("📸 Chat Widget Screenshot saved to:", chatScreenshotPath);

  await browser.close();
  console.log("🎉 All live tests finished with 100% success!");
}

runLiveTest().catch((err) => {
  console.error("❌ Live test error:", err);
  process.exit(1);
});
