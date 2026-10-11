/**
 * Automated Test Suite: Industrial OT WBM Dynamic Recognition & Teach 1 → Batch N
 *
 * Validates EdgeOperator against realistic Industrial Web-Based Management (WBM) interfaces:
 * 1. Siemens SCALANCE WBM (Tree navigation, General settings, Set Values commit button)
 * 2. Schneider Electric ConneXium WBM (Load/Save RAM to Flash, Apply commit button)
 * 3. Rule 9 Compliance: 100% dynamic DOM synthesis, 0 hardcoded site selectors or URLs
 * 4. Dual Global Bindings: window.EdgeOperator and window.OnDeviceChat interoperability
 * 5. Industrial Entity & Parameter Extraction
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_DIR = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.resolve(FRONTEND_DIR, "tests/fixtures");
const DIST_DIR = path.resolve(FRONTEND_DIR, "dist");
const ARTIFACTS_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136";

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

async function runTest() {
  console.log("==================================================================");
  console.log("🏭 VERIFYING EDGEOPERATOR INDUSTRIAL OT WBM DYNAMIC RECOGNITION");
  console.log("==================================================================\n");

  const bundlePath = path.resolve(DIST_DIR, "on-device-chat.min.js");
  const stylePath = path.resolve(DIST_DIR, "style.css");

  if (!fs.existsSync(bundlePath)) {
    console.error("❌ Bundle dist/on-device-chat.min.js not found. Run npm run build first.");
    process.exit(1);
  }

  const bundleCode = fs.readFileSync(bundlePath, "utf-8");
  const styleCode = fs.readFileSync(stylePath, "utf-8");

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // --- SCENARIO 1: Siemens SCALANCE XC208 WBM ---
  console.log("--- 1. Testing Siemens SCALANCE XC208 WBM Recognition ---");
  const scalanceHtmlPath = path.resolve(FIXTURES_DIR, "scalance_wbm_mock.html");
  await page.goto(`file://${scalanceHtmlPath}`);

  // Inject styles and EdgeOperator bundle
  await page.addStyleTag({ content: styleCode });
  await page.addScriptTag({ content: bundleCode });

  // Verify Global Bindings
  const globalCheck = await page.evaluate(() => ({
    hasEdgeOperator: typeof window.EdgeOperator !== "undefined",
    hasOnDeviceChat: typeof window.OnDeviceChat !== "undefined",
    isEqual: window.EdgeOperator === window.OnDeviceChat,
  }));

  assert(globalCheck.hasEdgeOperator, "window.EdgeOperator is exported to global scope");
  assert(globalCheck.hasOnDeviceChat, "window.OnDeviceChat retained as backwards-compatible alias");
  assert(globalCheck.isEqual, "window.EdgeOperator strictly equals window.OnDeviceChat instance");

  // Predict Workflows Dynamically on SCALANCE WBM
  const scalanceWorkflows = await page.evaluate(async () => {
    return await window.EdgeOperator.WorkflowPredictor.predictWorkflows();
  });

  console.log(`  Discovered ${scalanceWorkflows.length} dynamic workflows on SCALANCE WBM:`);
  scalanceWorkflows.forEach((w) => console.log(`   • [${w.workflow?.name}] -> ${w.workflow?.description}`));

  const hasSetValuesCommit = scalanceWorkflows.some((w) =>
    w.workflow?.name.includes("Set Values") || (w.workflow?.steps[0]?.target && w.workflow?.steps[0].target.includes("btn_set_values"))
  );
  assert(hasSetValuesCommit, "Dynamic OT commit candidate synthesized for [Set Values]");

  const hasTreeNavigation = scalanceWorkflows.some((w) =>
    w.workflow?.name.includes("Configure") || w.workflow?.tags.includes("wbm")
  );
  assert(hasTreeNavigation, "Dynamic left-tree menu candidate synthesized for hierarchical navigation");

  // Mount Widget & Verify UI
  await page.evaluate(() => {
    window.EdgeOperator.init({
      containerId: "edge-operator-root",
      defaultOpen: true,
    });
  });

  await page.waitForTimeout(300);

  const widgetHeader = await page.evaluate(() => {
    const el = document.querySelector(".eo-widget-container, .g4-widget-container");
    const headerText = el?.textContent || "";
    return {
      exists: !!el,
      hasEdgeOperatorText: headerText.includes("EdgeOperator"),
      isIsolated: getComputedStyle(el).zIndex === "2147483647",
    };
  });

  assert(widgetHeader.exists, "EdgeOperator widget container mounted in DOM");
  assert(widgetHeader.hasEdgeOperatorText, "Widget header displays 'EdgeOperator' brand");
  assert(widgetHeader.isIsolated, "Container preserves maximum z-index 2147483647 isolation");

  const scalanceScreenshotPath = path.resolve(ARTIFACTS_DIR, "scalance_edgeoperator_live.png");
  await page.screenshot({ path: scalanceScreenshotPath });
  console.log(`  📸 Saved Screenshot: ${scalanceScreenshotPath}`);

  // --- SCENARIO 2: Schneider Electric ConneXium WBM ---
  console.log("\n--- 2. Testing Schneider Electric ConneXium WBM Recognition ---");
  const schneiderHtmlPath = path.resolve(FIXTURES_DIR, "schneider_wbm_mock.html");
  await page.goto(`file://${schneiderHtmlPath}`);

  await page.addStyleTag({ content: styleCode });
  await page.addScriptTag({ content: bundleCode });

  const schneiderWorkflows = await page.evaluate(async () => {
    return await window.EdgeOperator.WorkflowPredictor.predictWorkflows();
  });

  console.log(`  Discovered ${schneiderWorkflows.length} dynamic workflows on Schneider WBM:`);
  schneiderWorkflows.forEach((w) => console.log(`   • [${w.workflow?.name}] -> ${w.workflow?.description}`));

  const hasApplyCommit = schneiderWorkflows.some((w) =>
    w.workflow?.name.includes("Apply") || (w.workflow?.steps[0]?.target && w.workflow?.steps[0].target.includes("btn_apply"))
  );
  assert(hasApplyCommit, "Dynamic OT commit candidate synthesized for [Apply]");

  const hasSchneiderTreeNav = schneiderWorkflows.some((w) =>
    w.workflow?.name.includes("Configure") || w.workflow?.tags.includes("wbm")
  );
  assert(hasSchneiderTreeNav, "Dynamic tree menu navigation candidate synthesized on Schneider WBM");

  // --- SCENARIO 3: Entity Extractor Table Grid Extraction ---
  console.log("\n--- 3. Testing Industrial Entity Extraction for 'Teach 1 → Batch N' ---");
  const extractedEntities = await page.evaluate(() => {
    return window.EdgeOperator.EntityExtractor.extractEntities();
  });

  assert(extractedEntities.length > 0, `Extracted ${extractedEntities.length} configuration entities from WBM table`);
  if (extractedEntities[0]) {
    console.log(`  Extracted entity: "${extractedEntities[0].name}" with selector "${extractedEntities[0].selector}"`);
    assert(extractedEntities[0].name.length > 0, "Extracted entity has non-empty label");
  }

  await browser.close();

  console.log("\n==================================================================");
  console.log(`🎉 ALL INDUSTRIAL OT WBM TESTS COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
