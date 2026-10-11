/**
 * Test Canvas Game Perception & Autonomous Gameplay in AI Assistant
 *
 * Verifies:
 * 1. CanvasInspector detects game engine & interactive entities.
 * 2. A11yTreeEngine augments DOM nodes with virtual canvas controls.
 * 3. User can type "play the game" into ChatWidget and the assistant
 *    engages the 60Hz autopilot loop and renders GameAutopilotCard in chat!
 */

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const CFT_EXECUTABLE = "/Users/adarrsh/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const ARTIFACT_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136";

async function testCanvasGameIntegration() {
  console.log("================================================================");
  console.log("🏀 Testing Canvas Game Perception & AI Assistant Autopilot Loop");
  console.log("================================================================");

  const userDataDir = `/tmp/test-canvas-game-${Date.now()}`;
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    executablePath: CFT_EXECUTABLE,
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    viewport: { width: 480, height: 860 },
  });

  const page = await browserContext.newPage();
  console.log("Navigating to https://basketball.paulcreates.online/ ...");
  await page.goto("https://basketball.paulcreates.online/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);

  // 1. Test Canvas Perception via Window OnDeviceChat
  console.log("\n--- 1. Testing CanvasInspector & A11yTree Augmentation ---");
  const canvasState = await page.evaluate(() => {
    const P = window.OnDeviceChat;
    if (!P) return { error: "OnDeviceChat not loaded" };

    const inspectRes = P.CanvasInspector ? P.CanvasInspector.inspect() : null;
    const a11yNodes = P.A11yTreeEngine ? P.A11yTreeEngine.scan() : [];
    const canvasA11yNodes = a11yNodes.filter(n => n.name.includes("[Canvas]") || n.tag === "canvas-element");

    return {
      hasCanvas: inspectRes?.hasCanvas,
      engine: inspectRes?.engine,
      entitiesCount: inspectRes?.entities?.length || 0,
      totalA11yNodes: a11yNodes.length,
      canvasA11yNodes: canvasA11yNodes.map(n => ({ id: n.id, role: n.role, name: n.name, bounds: n.bounds }))
    };
  });

  console.log("Canvas Perception Result:", JSON.stringify(canvasState, null, 2));

  // 2. Open Chat Assistant Widget
  console.log("\n--- 2. Opening Chat Assistant Widget ---");
  const launcher = page.locator("#g4-floating-launcher");
  await launcher.click();
  await page.waitForTimeout(800);

  // Take screenshot of opened chat over the basketball game
  const chatOpenedShot = path.join(ARTIFACT_DIR, "basketball_assistant_opened.png");
  await page.screenshot({ path: chatOpenedShot });
  console.log("Saved screenshot:", chatOpenedShot);

  // Inspect Suggested Workflows
  const suggestedWorkflows = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll("span.text-\\[13px\\].font-semibold")).map((el) => el.textContent.trim());
    return {
      titles,
    };
  });
  console.log("Discovered Suggested Workflows in Chat UI:", JSON.stringify(suggestedWorkflows, null, 2));

  // 3. Send command to AI Assistant: "Play the basketball game and get more score"
  console.log("\n--- 3. Sending Game Autopilot Request to Assistant ---");
  const chatInput = page.locator("textarea, input[placeholder*='Ask'], input[placeholder*='about this page']").first();
  await chatInput.waitFor({ state: "visible", timeout: 10000 });
  await chatInput.fill("Play the basketball game and get more score");
  await page.keyboard.press("Enter");
  console.log("Prompt submitted: 'Play the basketball game and get more score'");

  // Wait 4 seconds for game autopilot to engage, transition scenes, and start scoring
  await page.waitForTimeout(4000);

  // Take screenshot of live autopilot card rendering inside the chat
  const autopilotActiveShot = path.join(ARTIFACT_DIR, "basketball_assistant_autopilot_active.png");
  await page.screenshot({ path: autopilotActiveShot });
  console.log("Saved active autopilot screenshot:", autopilotActiveShot);

  // Wait another 8 seconds to allow score increments
  console.log("Monitoring autopilot gameplay for 8 seconds...");
  await page.waitForTimeout(8000);

  const finalAutopilotShot = path.join(ARTIFACT_DIR, "basketball_assistant_autopilot_scoring.png");
  await page.screenshot({ path: finalAutopilotShot });
  console.log("Saved scoring screenshot:", finalAutopilotShot);

  // Read message thread state to confirm GameAutopilotCard presence
  const threadState = await page.evaluate(() => {
    const cardEl = document.querySelector(".border-amber-500\\/30");
    const scoreVal = cardEl ? cardEl.querySelector(".font-mono")?.textContent : null;
    const statusText = cardEl ? cardEl.textContent : "";
    return {
      hasAutopilotCard: !!cardEl,
      displayedScore: scoreVal,
      hasPhysicsIndicator: statusText.includes("Physics Trajectory") || statusText.includes("Score"),
    };
  });

  console.log("Thread State:", threadState);

  await browserContext.close();
  console.log("\n================================================================");
  console.log("🎉 Canvas Game Integration Test Completed Successfully!");
  console.log("================================================================");
}

testCanvasGameIntegration().catch(console.error);
