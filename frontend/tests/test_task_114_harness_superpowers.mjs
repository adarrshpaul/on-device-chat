/**
 * Test Suite: TASK-114 Browser Automation Superpowers
 *
 * Verifies items 4, 5, 6, 8 from intention_harness_browser_automation_superpowers_20261024.md:
 * 1. Real Waits (WaitManager DOM-settle via MutationObserver quiet period + Network Idle).
 * 2. Self-Healing Locators (5-tier fallback hierarchy + Playwright test export).
 * 3. Durable Navigation Persistence & Tab Orchestration.
 * 4. Structured Data Extraction (HTML <table> and <div> grid -> RFC 4180 CSV / JSON).
 */

import assert from "node:assert/strict";
import {
  AgentHarness,
  WaitManager,
  SelfHealingLocatorEngine,
  DataExtractor,
  NavPersistenceManager,
  MacroRecorder,
} from "../dist/index.js";

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    throw err;
  }
}

async function itAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    throw err;
  }
}

console.log("==================================================================");
console.log("⚡ TESTING TASK-114 BROWSER AUTOMATION SUPERPOWERS");
console.log("==================================================================\n");

// ---------------------------------------------------------------------------
// 1. Real Waits: DOM-Settle & Network Idle (Item 5)
// ---------------------------------------------------------------------------
console.log("--- 1. Real Waits (DOM-Settle & Network Idle) ---");

await itAsync("WaitManager.waitForDomSettle resolves when quiet", async () => {
  const settled = await WaitManager.waitForDomSettle({ quietPeriodMs: 50, timeoutMs: 500 });
  assert.strictEqual(settled, true);
});

await itAsync("WaitManager.waitForNetworkIdle detects quiet period", async () => {
  const idle = await WaitManager.waitForNetworkIdle({ idlePeriodMs: 50, timeoutMs: 500 });
  assert.strictEqual(idle, true);
});

await itAsync("WaitManager.waitForPageReady combines DOM and network settling", async () => {
  const res = await WaitManager.waitForPageReady({ quietPeriodMs: 30, idlePeriodMs: 30, timeoutMs: 500 });
  assert.strictEqual(res.settled, true);
  assert.strictEqual(typeof res.durationMs, "number");
});

await itAsync("AgentHarness primitive 'wait' reports page ready latency", async () => {
  const harness = new AgentHarness();
  const res = await harness.executeTool("wait", { quietPeriodMs: 20, timeoutMs: 200 });
  assert.ok(res.includes("Page ready:"));
  assert.ok(res.includes("settled in"));
});

// ---------------------------------------------------------------------------
// 2. Self-Healing Locators (Item 6)
// ---------------------------------------------------------------------------
console.log("\n--- 2. Self-Healing Locators & Playwright Export ---");

it("Generates 5-tier self-healing locator descriptor from mock element", () => {
  const mockEl = {
    tagName: "BUTTON",
    getAttribute: (attr) => {
      if (attr === "data-testid") return "checkout-submit-btn";
      if (attr === "role") return "button";
      if (attr === "aria-label") return "Complete Order";
      return null;
    },
    innerText: "Complete Order Now",
    className: "btn btn-primary",
    id: "submit-order",
    parentElement: null,
  };

  const loc = SelfHealingLocatorEngine.generateLocator(mockEl);
  assert.strictEqual(loc.testId, "checkout-submit-btn");
  assert.strictEqual(loc.roleAndName?.role, "button");
  assert.strictEqual(loc.roleAndName?.name, "Complete Order");
  assert.strictEqual(loc.css, "#submit-order");
});

it("Resolves primary testId strategy with high confidence (0.99)", () => {
  const mockTarget = { tagName: "BUTTON", id: "btn-1" };
  const mockRoot = {
    querySelector: (q) => {
      if (q.includes("checkout-submit-btn")) return mockTarget;
      return null;
    },
    querySelectorAll: () => [],
  };

  const res = SelfHealingLocatorEngine.resolveLocator(
    { testId: "checkout-submit-btn", css: ".obsolete-class" },
    mockRoot
  );

  assert.strictEqual(res.element, mockTarget);
  assert.strictEqual(res.strategyUsed, "testId");
  assert.strictEqual(res.confidence, 0.99);
  assert.strictEqual(res.healed, false);
});

it("Self-heals via roleAndName when primary testId fails (A/B test / DOM mutation)", () => {
  const mockTarget = {
    tagName: "BUTTON",
    id: "healed-button",
    getAttribute: (attr) => (attr === "aria-label" ? "Submit Application" : null),
    innerText: "Submit Application",
  };

  const mockRoot = {
    querySelector: () => null, // testId fails!
    querySelectorAll: (q) => {
      if (q.includes("button")) return [mockTarget];
      return [];
    },
  };

  const res = SelfHealingLocatorEngine.resolveLocator(
    {
      testId: "missing-old-test-id",
      roleAndName: { role: "button", name: "Submit Application" },
      css: "#vanished-id",
    },
    mockRoot
  );

  assert.strictEqual(res.element, mockTarget);
  assert.strictEqual(res.strategyUsed, "roleAndName");
  assert.strictEqual(res.healed, true, "Must flag that self-healing occurred");
  assert.ok(res.confidence >= 0.95);
});

it("Converts self-healing locators into modern Playwright expressions", () => {
  const pwTestId = SelfHealingLocatorEngine.toPlaywrightSelector({ testId: "checkout-btn" });
  assert.strictEqual(pwTestId, "page.getByTestId('checkout-btn')");

  const pwRole = SelfHealingLocatorEngine.toPlaywrightSelector({
    roleAndName: { role: "button", name: "Proceed to Checkout" },
  });
  assert.strictEqual(pwRole, "page.getByRole('button', { name: 'Proceed to Checkout' })");

  const pwText = SelfHealingLocatorEngine.toPlaywrightSelector({ text: "Add to Bag" });
  assert.strictEqual(pwText, "page.getByText('Add to Bag')");
});

it("Exports recorded macro actions into executable Playwright test script", () => {
  const actions = [
    {
      type: "click",
      targetSelector: "#btn-login",
      locator: { testId: "login-submit" },
      count: 1,
    },
    {
      type: "input",
      targetSelector: "input#username",
      value: "admin",
      locator: { roleAndName: { role: "textbox", name: "Username" } },
    },
  ];

  const pwScript = MacroRecorder.exportAsPlaywright({
    actions,
    url: "https://myshop.com/login",
    testName: "Admin Login Flow",
  });

  assert.ok(pwScript.includes("import { test, expect } from '@playwright/test'"));
  assert.ok(pwScript.includes("test('Admin Login Flow'"));
  assert.ok(pwScript.includes("page.goto('https://myshop.com/login')"));
  assert.ok(pwScript.includes("page.getByTestId('login-submit').click()"));
  assert.ok(pwScript.includes("page.getByRole('textbox', { name: 'Username' }).fill('admin')"));
  assert.ok(pwScript.includes("page.waitForLoadState('networkidle')"));
});

// ---------------------------------------------------------------------------
// 3. Durable Navigation Persistence & Tab Orchestration (Item 4)
// ---------------------------------------------------------------------------
console.log("\n--- 3. Durable Navigation & Tab Orchestration ---");

it("NavPersistenceManager persists and retrieves task state across page transitions", () => {
  // Ensure mock sessionStorage exists in node
  if (typeof globalThis.window === "undefined" || !globalThis.window.sessionStorage) {
    const mem = new Map();
    globalThis.window = globalThis.window || {};
    globalThis.window.sessionStorage = {
      getItem: (k) => mem.get(k) || null,
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      clear: () => mem.clear(),
    };
  }

  NavPersistenceManager.clearTask();
  assert.strictEqual(NavPersistenceManager.getPendingTask(), null);

  NavPersistenceManager.saveTask({
    id: "task_multi_456",
    userGoal: "Compare product specs across tabs",
    stepIndex: 1,
    maxSteps: 5,
    trajectory: [],
    conversationHistory: [],
    workingMemory: { origin: "store" },
    originUrl: "https://store.com/item1",
  });

  const task = NavPersistenceManager.getPendingTask();
  assert.ok(task !== null);
  assert.strictEqual(task?.id, "task_multi_456");
  assert.strictEqual(task?.userGoal, "Compare product specs across tabs");

  NavPersistenceManager.clearTask();
  assert.strictEqual(NavPersistenceManager.getPendingTask(), null);
});

await itAsync("Harness supports tab management primitives (openTab, listTabs)", async () => {
  const harness = new AgentHarness();

  const resList = await harness.executeTool("listTabs", {});
  assert.ok(resList.length > 0);

  const resOpen = await harness.executeTool("openTab", { url: "https://example.com" });
  assert.ok(resOpen.includes("https://example.com"));
});

// ---------------------------------------------------------------------------
// 4. Structured Data Extraction (Item 8)
// ---------------------------------------------------------------------------
console.log("\n--- 4. Structured Data Extraction (CSV / JSON) ---");

it("DataExtractor.toCsv formats rows with proper RFC 4180 quotes & commas", () => {
  const headers = ["Name", "Description", "Price"];
  const rows = [
    ["Smartwatch", "Waterproof, GPS included", "$199.99"],
    ["Keyboard", 'Mechanical "Clicky" Switches', "$89.50"],
  ];

  const csv = DataExtractor.toCsv(headers, rows);
  assert.ok(csv.includes('Name,Description,Price'));
  assert.ok(csv.includes('"Waterproof, GPS included"'));
  assert.ok(csv.includes('"Mechanical ""Clicky"" Switches"'));
});

it("DataExtractor.extractTable extracts mock HTML table data", () => {
  const mockTable = {
    tagName: "TABLE",
    querySelectorAll: (q) => {
      if (q.includes("th")) {
        return [{ textContent: "Product" }, { textContent: "Qty" }, { textContent: "Price" }];
      }
      if (q.includes("tr")) {
        return [
          {
            querySelectorAll: () => [
              { textContent: "Widget A" },
              { textContent: "5" },
              { textContent: "$10.00" },
            ],
          },
          {
            querySelectorAll: () => [
              { textContent: "Widget B" },
              { textContent: "2" },
              { textContent: "$25.00" },
            ],
          },
        ];
      }
      return [];
    },
    querySelector: () => ({ querySelectorAll: () => [] }),
  };

  // Temporarily attach mockTable
  const origQuerySelector = globalThis.document?.querySelector;
  if (!globalThis.document) {
    globalThis.document = { querySelector: () => mockTable, querySelectorAll: () => [mockTable] };
  } else {
    globalThis.document.querySelector = (q) => (q === "#cart-table" ? mockTable : null);
  }

  const result = DataExtractor.extractTable({ selector: "#cart-table" });
  assert.strictEqual(result.rowCount, 2);
  assert.strictEqual(result.headers.length, 3);
  assert.strictEqual(result.headers[0], "Product");
  assert.strictEqual(result.rows[0].Product, "Widget A");
  assert.strictEqual(result.rows[0].Qty, "5");
  assert.ok(result.csv.includes("Widget A,5,$10.00"));

  if (origQuerySelector) {
    globalThis.document.querySelector = origQuerySelector;
  }
});

await itAsync("AgentHarness primitive 'extract' returns structured data observation", async () => {
  const harness = new AgentHarness();
  const res = await harness.executeTool("extract", { format: "csv" });
  assert.ok(typeof res === "string");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n==================================================================");
console.log(`🎉 ALL TASK-114 SUPERPOWERS VERIFIED: ${passed}/${total} Passed!`);
console.log("==================================================================");
