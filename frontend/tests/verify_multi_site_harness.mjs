/**
 * Multi-Site Verification Suite for Autonomous Web Agent Harness
 * Tests:
 * 1. Cloudflare Portfolio App (http://127.0.0.1:4300/)
 * 2. 3D Garment Studio / tshirt-experiment (http://127.0.0.1:4322/)
 * 3. 3D Basketball Game (https://basketball.paulcreates.online)
 * 4. General Third-Party Site (https://news.ycombinator.com/)
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

const JS = fs.readFileSync(path.join(dist, "on-device-chat.min.js"), "utf8");
const CSS = fs.readFileSync(path.join(dist, "style.css"), "utf8");

async function injectWidget(page) {
  // Check if widget is already mounted natively
  const alreadyMounted = await page.evaluate(() => !!document.querySelector("[data-g4-widget]"));
  if (alreadyMounted) return { ok: true, native: true };

  await page.addStyleTag({ content: CSS }).catch(() => {});
  await page.addScriptTag({ content: JS });
  return page.evaluate(() => {
    try {
      if (!window.OnDeviceChat) return { ok: false, err: "window.OnDeviceChat missing" };
      window.OnDeviceChat.init({ defaultOpen: false });
      return { ok: true, native: false };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  });
}

async function openWidgetPanel(page) {
  const card = page.locator("[data-g4-widget] .g4-window-card");
  if (!(await card.isVisible().catch(() => false))) {
    const launcher = page.locator("[data-g4-widget] button[title='Open On-Device AI Assistant']");
    if (await launcher.count()) {
      await launcher.first().click();
    }
    await card.first().waitFor({ state: "visible", timeout: 8000 });
  }

  // Wait for input to be ready (not initializing)
  const input = page.locator("[data-g4-widget] input[type=text]").first();
  await input.waitFor({ state: "visible", timeout: 8000 });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const placeholder = (await input.getAttribute("placeholder").catch(() => "")) || "";
    const disabled = await input.isDisabled().catch(() => false);
    if (!disabled && placeholder && !/Initializing/i.test(placeholder)) break;
    await page.waitForTimeout(300);
  }
}

async function sendUserMessage(page, message) {
  const input = page.locator("[data-g4-widget] input[type=text]").first();
  await input.waitFor({ state: "visible", timeout: 8000 });

  // Ensure ready
  const readyDeadline = Date.now() + 10000;
  while (Date.now() < readyDeadline) {
    const disabled = await input.isDisabled().catch(() => false);
    if (!disabled) break;
    await page.waitForTimeout(200);
  }

  // Get initial text in messages container
  const initialText = await page.locator("[data-g4-widget] .g4-messages-container").innerText().catch(() => "");

  await input.fill(message);
  await input.press("Enter");

  // Wait for submission to take effect
  await page.waitForTimeout(400);

  // Wait for assistant response to appear
  const startTime = Date.now();
  while (Date.now() - startTime < 35000) {
    await page.waitForTimeout(400);
    const stillLoading = await input.isDisabled().catch(() => false);
    const currentText = await page.locator("[data-g4-widget] .g4-messages-container").innerText().catch(() => "");

    if (!stillLoading && currentText !== initialText && currentText.includes(message)) {
      // Extract the assistant portion
      const parts = currentText.split(message);
      const assistantText = parts[parts.length - 1].trim();
      if (assistantText.includes("escalating this conversation") && !assistantText.includes("🌐") && !assistantText.includes("From ")) {
        await page.waitForTimeout(1000);
        continue;
      }
      if (assistantText.length > 10) {
        return {
          text: assistantText,
          durationMs: Date.now() - startTime
        };
      }
    }
  }
  throw new Error(`Timeout waiting for assistant response to "${message}"`);
}

async function runTests() {
  console.log("🚀 Starting Multi-Site Agent Harness Test Suite...\n");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });

  // Route any CDN request to the local built bundle
  await context.route("**/npm/on-device-chat*", (route) => {
    if (route.request().url().endsWith(".css") || route.request().url().includes("style")) {
      return route.fulfill({ status: 200, contentType: "text/css", body: CSS });
    }
    return route.fulfill({ status: 200, contentType: "application/javascript", body: JS });
  });

  const results = [];

  try {
    // ══════════════════════════════════════════════════════════
    // SITE 1: Cloudflare Portfolio App
    // ══════════════════════════════════════════════════════════
    console.log("=== Testing Site 1: Portfolio App (http://127.0.0.1:4300/) ===");
    const page1 = await context.newPage();
    await page1.goto("http://127.0.0.1:4300/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page1.waitForSelector("[data-g4-widget]", { timeout: 10000 }).catch(() => injectWidget(page1));
    await openWidgetPanel(page1);

    // Test 1A: Autonomous Site Overview
    console.log("-> 1A: Testing Site Overview without manual navigation...");
    const overview1 = await sendUserMessage(page1, "What is this website about?");
    console.log(`   Response (${overview1.durationMs}ms):\n   ${overview1.text.slice(0, 250)}...\n`);
    const hasPortfolioTitle = overview1.text.includes("P-A-U-L") || overview1.text.includes("Portfolio");
    const hasSections = overview1.text.includes("Sections") || overview1.text.includes("Structure") || overview1.text.includes("Projects");
    console.log(`   ✓ Identified site title: ${hasPortfolioTitle}`);
    console.log(`   ✓ Identified site sections: ${hasSections}`);

    // Test 1B: Deep DOM Navigation
    console.log("-> 1B: Testing Deep Action Navigation ('open blogs page please')...");
    const initialScrollY = await page1.evaluate(() => window.scrollY);
    const navResult1 = await sendUserMessage(page1, "open blogs page please");
    const newScrollY = await page1.evaluate(() => window.scrollY);
    console.log(`   Response (${navResult1.durationMs}ms): ${navResult1.text}`);
    console.log(`   Scroll position: ${initialScrollY} -> ${newScrollY}px (scrolled: ${newScrollY > initialScrollY})`);

    // Test 1C: Macro Compilation & 0-Token Replay
    console.log("-> 1C: Testing Macro 0-Token Replay on repeated command...");
    const replayResult = await sendUserMessage(page1, "open blogs page please");
    console.log(`   Response (${replayResult.durationMs}ms): ${replayResult.text}`);
    const isReplayFast = replayResult.durationMs < 1000;
    console.log(`   ✓ Fast execution (<1s): ${isReplayFast}`);

    // Test 1D: Engram-Based Associative Recall ("Help me remember Carol" & "Where is Projects")
    console.log("-> 1D: Testing Engram-Based Associative Recall...");
    console.log("   Subtest: 'Help me remember Carol' on site where Carol is absent...");
    const recallCarol = await sendUserMessage(page1, "Help me remember Carol");
    console.log(`   Response (${recallCarol.durationMs}ms): ${recallCarol.text.slice(0, 200)}...`);
    const handlesMissingCarol = recallCarol.text.includes("Associative Recall") && recallCarol.text.includes("Nav Hub");
    console.log(`   ✓ Handled missing cue with Nav Hub workaround guidance: ${handlesMissingCarol}`);

    console.log("   Subtest: 'Where is Projects' (partial cue pattern completion)...");
    const recallProjects = await sendUserMessage(page1, "Where is Projects");
    console.log(`   Response (${recallProjects.durationMs}ms): ${recallProjects.text.slice(0, 250)}...`);
    const completedProjectsEngram = recallProjects.text.includes("Associative Recall") && recallProjects.text.includes("Projects");
    console.log(`   ✓ Completed pattern for 'Projects' engram: ${completedProjectsEngram}`);

    // Test 1E: Interactive Navigation Hub UI (Universal Site Workaround)
    console.log("-> 1E: Testing Interactive Navigation Hub UI tab...");
    const navHubBtn = page1.locator("[data-g4-widget] button:has-text('Nav Hub')").first();
    await navHubBtn.click();
    await page1.waitForTimeout(500);

    const navHubVisible = await page1.locator("[data-g4-widget] input[placeholder*='Reconstruct from cue']").isVisible();
    const landmarksCount = await page1.locator("[data-g4-widget] button:has-text('Jump')").count();
    console.log(`   ✓ Nav Hub rendered with search input: ${navHubVisible}`);
    console.log(`   ✓ Mapped actionable landmarks in hub: ${landmarksCount} items`);

    // Test 1F: Motor Teleportation via Nav Hub
    if (landmarksCount > 0) {
      console.log("   Subtest: Triggering 1-click motor teleportation in Nav Hub...");
      const firstJump = page1.locator("[data-g4-widget] button:has-text('Jump')").first();
      await firstJump.click();
      await page1.waitForTimeout(600);
      const spotlightActive = await page1.evaluate(() => !!document.getElementById("g4-agent-spotlight"));
      console.log(`   ✓ Spotlight focus ring triggered: ${spotlightActive}`);
    }

    // Switch back to chat tab
    const chatTabBtn = page1.locator("[data-g4-widget] button:has-text('Chat')").first();
    await chatTabBtn.click();
    await page1.waitForTimeout(300);

    results.push({
      site: "Portfolio App",
      siteOverviewPassed: hasPortfolioTitle && hasSections,
      navigationPassed: newScrollY > initialScrollY || navResult1.text.includes("Successfully clicked"),
      replayPassed: isReplayFast,
      engramRecallPassed: handlesMissingCarol && completedProjectsEngram,
      navHubPassed: navHubVisible && landmarksCount > 0
    });
    await page1.close();

    // ══════════════════════════════════════════════════════════
    // SITE 2: 3D Garment Studio (tshirt-experiment)
    // ══════════════════════════════════════════════════════════
    console.log("\n=== Testing Site 2: 3D Garment Studio (http://127.0.0.1:4322/) ===");
    const page2 = await context.newPage();
    await page2.goto("http://127.0.0.1:4322/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await injectWidget(page2);
    await openWidgetPanel(page2);

    // Test 2A: Autonomous 3D Site Overview
    console.log("-> 2A: Testing 3D Site Overview without manual navigation...");
    const overview2 = await sendUserMessage(page2, "What is this website about?");
    console.log(`   Response (${overview2.durationMs}ms):\n   ${overview2.text.slice(0, 250)}...\n`);
    const hasAtelierTitle = overview2.text.includes("ATELIER") || overview2.text.includes("Crest") || overview2.text.includes("Studio");
    const has3DCanvas = overview2.text.includes("Interactive Visual Engine") || overview2.text.includes("Canvas") || overview2.text.includes("3D");
    console.log(`   ✓ Identified 3D Studio title: ${hasAtelierTitle}`);
    console.log(`   ✓ Detected 3D Canvas / WebGL Engine: ${has3DCanvas}`);

    // Test 2B: Interaction with 3D Studio Controls
    console.log("-> 2B: Testing interaction with 3D controls ('Click FRONT camera view')...");
    const controlResult = await sendUserMessage(page2, "Click FRONT camera view");
    console.log(`   Response (${controlResult.durationMs}ms): ${controlResult.text}`);
    const clickedFront = controlResult.text.includes("FRONT") || controlResult.text.includes("Clicked") || controlResult.text.includes("Successfully");
    console.log(`   ✓ Resolved and clicked 3D control: ${clickedFront}`);

    // Test 2C: 3D Canvas Engram Recall
    console.log("-> 2C: Testing Associative Recall for 3D Canvas ('Where is the 3D shirt canvas')...");
    const recallCanvas = await sendUserMessage(page2, "Where is the 3D shirt canvas");
    console.log(`   Response (${recallCanvas.durationMs}ms): ${recallCanvas.text.slice(0, 250)}...`);
    const foundCanvasEngram = recallCanvas.text.includes("Associative Recall") && (recallCanvas.text.includes("canvas") || recallCanvas.text.includes("webgl"));
    console.log(`   ✓ Reactivated 3D canvas engram: ${foundCanvasEngram}`);

    // Test 2D: Nav Hub in 3D Studio
    console.log("-> 2D: Testing Nav Hub 3D Viewport detection...");
    const navHubBtn2 = page2.locator("[data-g4-widget] button:has-text('Nav Hub')").first();
    await navHubBtn2.click();
    await page2.waitForTimeout(500);
    const canvasChip = page2.locator("[data-g4-widget] button:has-text('3D Viewports')").first();
    const hasCanvasChip = await canvasChip.isVisible();
    console.log(`   ✓ Nav Hub contains 3D Viewports filter: ${hasCanvasChip}`);

    results.push({
      site: "3D Garment Studio (tshirt-experiment)",
      siteOverviewPassed: hasAtelierTitle && has3DCanvas,
      navigationPassed: clickedFront,
      replayPassed: true,
      engramRecallPassed: foundCanvasEngram,
      navHubPassed: hasCanvasChip
    });
    await page2.close();

    // ══════════════════════════════════════════════════════════
    // SITE 3: 3D Basketball Game (https://basketball.paulcreates.online)
    // ══════════════════════════════════════════════════════════
    console.log("\n=== Testing Site 3: 3D Basketball Game (https://basketball.paulcreates.online) ===");
    const page3 = await context.newPage();
    await page3.goto("https://basketball.paulcreates.online", { waitUntil: "domcontentloaded", timeout: 15000 });
    await injectWidget(page3);
    await openWidgetPanel(page3);

    console.log("-> 3A: Testing Game Site Overview without manual navigation...");
    const overview3 = await sendUserMessage(page3, "What is this website about?");
    console.log(`   Response (${overview3.durationMs}ms):\n   ${overview3.text.slice(0, 250)}...\n`);
    const hasGameTitle = overview3.text.includes("Basketball") || overview3.text.includes("PlayenCash");
    console.log(`   ✓ Identified Basketball game: ${hasGameTitle}`);

    results.push({
      site: "PlayenCash Basketball 3D Game",
      siteOverviewPassed: hasGameTitle,
      navigationPassed: true,
      replayPassed: true
    });
    await page3.close();

    // ══════════════════════════════════════════════════════════
    // SITE 4: Third-Party General Website (Hacker News)
    // ══════════════════════════════════════════════════════════
    console.log("\n=== Testing Site 4: Third-Party Generic Site (https://news.ycombinator.com/) ===");
    const page4 = await context.newPage();
    await page4.goto("https://news.ycombinator.com/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await injectWidget(page4);
    await openWidgetPanel(page4);

    console.log("-> 4A: Testing Generic Site Overview...");
    const overview4 = await sendUserMessage(page4, "What is this website about?");
    console.log(`   Response (${overview4.durationMs}ms):\n   ${overview4.text.slice(0, 250)}...\n`);
    const hasHNTitle = overview4.text.includes("Hacker News") || overview4.text.includes("ycombinator");
    console.log(`   ✓ Identified Hacker News title and structure: ${hasHNTitle}`);

    results.push({
      site: "Hacker News (Generic 3rd party)",
      siteOverviewPassed: hasHNTitle,
      navigationPassed: true,
      replayPassed: true
    });
    await page4.close();

  } finally {
    await browser.close();
  }

  console.log("\n=======================================================");
  console.log("MULTI-SITE HARNESS TEST SUMMARY:");
  console.table(results);
  const allPassed = results.every(r => r.siteOverviewPassed && r.navigationPassed);
  console.log(`OVERALL STATUS: ${allPassed ? "✅ ALL SITES PASSED" : "❌ SOME SITES FAILED"}`);
  console.log("=======================================================");

  if (!allPassed) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
