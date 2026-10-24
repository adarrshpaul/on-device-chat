/**
 * Comprehensive Browser-Driven Test Suite for:
 * 1. OpenUI / DIL Typed Component Stream (UISpecEngine & bindOrDrop)
 * 2. vllm-sr/d3-nano & Vega Decision Scorer (decisionScorerRegistry)
 * 
 * Runs in real Chromium headless browser against active DOM.
 */

import assert from "node:assert";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist");

console.log("==================================================================");
console.log("🧪 TESTING OPENUI TYPED COMPONENT STREAM & D3-NANO DECISION SCORER");
console.log("==================================================================");

async function runTests() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const css = fs.readFileSync(path.join(DIST_DIR, "style.css"), "utf8");
  const js = fs.readFileSync(path.join(DIST_DIR, "on-device-chat.min.js"), "utf8");

  const testHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OpenUI & D3-Nano Test Page</title>
      </head>
      <body>
        <div id="test-fixture">
          <button id="checkout-btn" data-testid="checkout" class="btn primary">Proceed to Checkout</button>
          <button id="continue-shopping-btn" class="btn secondary">Continue Shopping</button>
          <table id="device-table">
            <thead><tr><th>Port</th><th>Status</th></tr></thead>
            <tbody>
              <tr id="row-p1"><td>Port 1</td><td><button class="toggle-port" data-port="1">Enable</button></td></tr>
              <tr id="row-p2"><td>Port 2</td><td><button class="toggle-port" data-port="2">Enable</button></td></tr>
            </tbody>
          </table>
          <form id="network-form">
            <input type="text" id="ip-address" name="ip" value="192.168.1.1" />
            <input type="number" id="vlan-id" name="vlan" value="10" />
          </form>
        </div>
      </body>
    </html>
  `;

  await page.setContent(testHtml);

  // Inject widget CSS & JS
  await page.evaluate((cssText) => {
    const s = document.createElement("style");
    s.id = "edge-operator-styles";
    s.textContent = cssText;
    document.head.appendChild(s);
  }, css);
  await page.addScriptTag({ content: js });

  try {
    // -------------------------------------------------------------
    // TEST 1: UISpecEngine bindOrDrop (Rule 7 Zero Fraud & Live DOM)
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: UISpecEngine bindOrDrop (Rule 7 Zero Fraud & Live DOM) ---");
    const test1Results = await page.evaluate(async () => {
      const { UISpecEngine } = window.EdgeOperator;

      const validConfirm = {
        kind: "confirm",
        id: "spec_1",
        title: "Checkout Confirmation",
        action: { tool: "click", ref: { selector: "#checkout-btn" } },
      };

      const phantomConfirm = {
        kind: "confirm",
        id: "spec_2",
        title: "Fake Phantom Button",
        action: { tool: "click", ref: { selector: "#non-existent-button-999" } },
      };

      const bound = UISpecEngine.bindOrDrop([validConfirm, phantomConfirm]);

      // Batch test
      const batchSpec = {
        kind: "batchPreview",
        id: "batch_1",
        title: "Port Commissioning",
        columns: ["Port", "Action"],
        rows: [
          { id: "r1", ref: { selector: "button[data-port='1']" }, cells: ["Port 1", "Enable"], selected: true },
          { id: "r2", ref: { selector: "button[data-port='2']" }, cells: ["Port 2", "Enable"], selected: true },
          { id: "r3", ref: { selector: "button[data-port='999']" }, cells: ["Port 999", "Enable"], selected: true },
        ],
      };
      const boundBatch = UISpecEngine.bindOrDrop([batchSpec]);

      return {
        boundConfirmCount: bound.length,
        retainedConfirmId: bound[0]?.id,
        batchRowsCount: boundBatch[0]?.rows?.length,
      };
    });

    assert.strictEqual(test1Results.boundConfirmCount, 1, "Must retain only 1 valid spec");
    assert.strictEqual(test1Results.retainedConfirmId, "spec_1");
    assert.strictEqual(test1Results.batchRowsCount, 2, "Must drop the phantom batch row");
    console.log("  ✅ PASS: Phantom element ref dropped, live element refs verified (Rule 7 & 9 compliant)!");

    // -------------------------------------------------------------
    // TEST 2: UISpecEngine executeAction on physical DOM
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: UISpecEngine executeAction on physical DOM ---");
    const test2Results = await page.evaluate(async () => {
      const { UISpecEngine, SafetyGate } = window.EdgeOperator;
      if (SafetyGate && typeof SafetyGate.setConfirmHandler === "function") {
        SafetyGate.setConfirmHandler(async () => true);
      }
      let clicks = 0;
      const btn = document.getElementById("checkout-btn");
      btn.addEventListener("click", () => clicks++);

      const res = await UISpecEngine.executeAction({
        tool: "click",
        ref: { selector: "#checkout-btn" },
        repeatCount: 2,
      });

      return {
        success: res.success,
        clicks,
        latencyMs: res.latencyMs,
      };
    });

    assert.strictEqual(test2Results.success, true);
    assert.strictEqual(test2Results.clicks, 2, "Must fire repeat clicks");
    console.log(`  ✅ PASS: UISpecEngine physically executed 2 clicks (latency: ${test2Results.latencyMs}ms)!`);

    // -------------------------------------------------------------
    // TEST 3: VegaOnDeviceScorer
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: VegaOnDeviceScorer ---");
    const test3Results = await page.evaluate(async () => {
      const { VegaOnDeviceScorer } = window.EdgeOperator;
      const scorer = new VegaOnDeviceScorer();
      const candidates = [
        { id: "c1", text: "Proceed to Checkout", role: "button", selector: "#checkout-btn" },
        { id: "c2", text: "Continue Shopping", role: "button", selector: "#continue-shopping-btn" },
      ];
      const res = await scorer.score("checkout order", candidates);
      return {
        placement: res.placement,
        bestIndex: res.bestIndex,
        margin: res.margin,
        latencyMs: res.latencyMs,
        sumScores: res.scores.reduce((a, b) => a + b, 0),
      };
    });

    assert.strictEqual(test3Results.placement, "on-device");
    assert.strictEqual(test3Results.bestIndex, 0, "Checkout button must win for checkout goal");
    assert.ok(Math.abs(test3Results.sumScores - 1.0) < 0.01, "Scores must sum to 1.0");
    console.log(`  ✅ PASS: Vega scored on-device in ${test3Results.latencyMs}ms (margin: ${(test3Results.margin * 100).toFixed(1)}%)!`);

    // -------------------------------------------------------------
    // TEST 4: D3NanoDecisionScorer (System One Single Forward Pass)
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: D3NanoDecisionScorer (System One Choice Model) ---");
    const test4Results = await page.evaluate(async () => {
      const { D3NanoDecisionScorer } = window.EdgeOperator;
      const scorer = new D3NanoDecisionScorer();
      const candidates = [
        { id: "c1", text: "Proceed to Checkout", role: "button", selector: "#checkout-btn" },
        { id: "c2", text: "Continue Shopping", role: "button", selector: "#continue-shopping-btn" },
      ];
      const res = await scorer.score("complete purchase and checkout", candidates);
      return {
        engineUsed: res.engineUsed,
        bestIndex: res.bestIndex,
        margin: res.margin,
        latencyMs: res.latencyMs,
      };
    });

    assert.ok(test4Results.engineUsed.includes("d3-nano"));
    assert.strictEqual(test4Results.bestIndex, 0);
    assert.ok(test4Results.margin > 0);
    console.log(`  ✅ PASS: d3-nano single-forward pass discriminated target in ${test4Results.latencyMs}ms (margin: ${(test4Results.margin * 100).toFixed(1)}%)!`);

    // -------------------------------------------------------------
    // TEST 5: DecisionScorerRegistry Tie-Breaker & Air-Gap Defense
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: DecisionScorerRegistry Tie-Breaker & Air-Gap Defense ---");
    const test5Results = await page.evaluate(async () => {
      const { decisionScorerRegistry, D3NanoDecisionScorer } = window.EdgeOperator;
      const candidates = [
        { id: "c1", text: "Proceed to Checkout", role: "button", selector: "#checkout-btn" },
        { id: "c2", text: "Continue Shopping", role: "button", selector: "#continue-shopping-btn" },
      ];
      const regRes = await decisionScorerRegistry.scoreCandidates("click button", candidates);

      // Air-gap test
      window.EO_AIRGAP = true;
      const airScorer = new D3NanoDecisionScorer();
      let airGapBlocked = false;
      try {
        await airScorer.score("checkout", candidates);
      } catch (err) {
        airGapBlocked = err.message.includes("air-gap");
      }
      delete window.EO_AIRGAP;

      return {
        resolvedEngine: regRes.engineUsed,
        airGapBlocked,
      };
    });

    assert.ok(test5Results.resolvedEngine.length > 0);
    assert.strictEqual(test5Results.airGapBlocked, true, "Air-gap must block remote decision calls");
    console.log(`  ✅ PASS: Scorer registry resolved decision (${test5Results.resolvedEngine}) and air-gap blocked remote egress!`);

    console.log("\n==================================================================");
    console.log("🎉 ALL OPENUI & D3-NANO REAL BROWSER INTEGRATION TESTS PASSED (5/5)!");
    console.log("==================================================================");
  } finally {
    await browser.close();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
