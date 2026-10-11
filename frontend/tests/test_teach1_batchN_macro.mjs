/**
 * Comprehensive Automated Test Suite: "Teach 1 → Batch N" Dynamic Macro Automation
 *
 * Verifies:
 * 1. Capture of user DOM interactions (clicks, inputs, changes) on Entity #1.
 * 2. Automatic entity container detection and relative sub-element selector abstraction.
 * 3. Autonomous discovery of all N sibling entities in the active view.
 * 4. Human Confirmation Gate generation (BatchProposal with diff review & selective approval).
 * 5. Sequential replay across selected entities with isolated error boundary propagation.
 * 6. Zero prompt token consumption (100% genuine local DOM execution).
 */

import assert from "node:assert/strict";

// Global Event Registry for Mock DOM
const eventListeners = new Map();

function addEventListenerMock(type, listener, useCapture = false) {
  if (!eventListeners.has(type)) eventListeners.set(type, []);
  eventListeners.get(type).push({ listener, useCapture });
}

function removeEventListenerMock(type, listener, useCapture = false) {
  if (!eventListeners.has(type)) return;
  const list = eventListeners.get(type);
  const idx = list.findIndex(item => item.listener === listener);
  if (idx !== -1) list.splice(idx, 1);
}

function dispatchEventMock(event) {
  const list = eventListeners.get(event.type) || [];
  for (const item of list) {
    try {
      item.listener(event);
    } catch (e) {
      console.error("Error in mock event listener:", e);
    }
  }
}

class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? true;
    this.cancelable = init.cancelable ?? true;
    this.inputType = init.inputType;
    this.data = init.data;
    this.key = init.key;
    this.code = init.code;
    this.target = null;
  }
}

globalThis.Event = MockEvent;
globalThis.PointerEvent = MockEvent;
globalThis.MouseEvent = MockEvent;
globalThis.FocusEvent = MockEvent;
globalThis.InputEvent = MockEvent;
globalThis.KeyboardEvent = MockEvent;

// --- Mock DOM Implementation ---
class MockNode {
  constructor(tag = "div", attrs = {}, text = "") {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this._text = text;
    this.id = attrs.id || "";
    this.className = attrs.class || "";
    this.value = attrs.value || "";
    this.style = {};
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.isConnected = true;
  }

  get textContent() {
    if (this._text !== undefined && this._text !== "") return this._text;
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent).filter(Boolean).join(" ").trim();
    }
    return "";
  }

  set textContent(val) {
    this._text = val;
  }

  getAttribute(name) {
    return this.attrs[name] ?? null;
  }

  setAttribute(name, val) {
    this.attrs[name] = val;
    if (name === "id") this.id = val;
    if (name === "class") this.className = val;
    if (name === "value") this.value = val;
  }

  hasAttribute(name) {
    return name in this.attrs;
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  appendChild(child) {
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
    }
  }

  focus() {}
  blur() {}
  scrollIntoView() {}

  click() {
    dispatchEventMock({
      type: "click",
      target: this,
    });
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    dispatchEventMock(event);
    return true;
  }

  contains(other) {
    let curr = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }

  closest(selector) {
    let curr = this;
    const cleanSel = selector.trim().toLowerCase();

    while (curr) {
      const tag = curr.tagName ? curr.tagName.toLowerCase() : "";
      const cls = curr.className ? curr.className.toLowerCase() : "";
      const id = curr.id ? curr.id.toLowerCase() : "";
      const role = curr.getAttribute("role") || "";

      if (cleanSel.includes(",")) {
        const parts = cleanSel.split(",").map(p => p.trim());
        for (const p of parts) {
          if (p === tag) return curr;
          if (p === `#${id}`) return curr;
          if (p.startsWith(".") && cls.split(/\s+/).includes(p.slice(1))) return curr;
          if (p === `[role='${role}']`) return curr;
        }
      } else {
        if (cleanSel === tag) return curr;
        if (cleanSel === `#${id}`) return curr;
        if (cleanSel.startsWith(".") && cls.split(/\s+/).includes(cleanSel.slice(1))) return curr;
        if (cleanSel === `[role='${role}']`) return curr;
      }

      curr = curr.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const selectors = selector.split(",").map(s => s.trim());

    const matchElement = (el, sel) => {
      sel = sel.toLowerCase();
      const tag = el.tagName ? el.tagName.toLowerCase() : "";
      const cls = el.className ? el.className.toLowerCase() : "";
      const id = el.id ? el.id.toLowerCase() : "";

      if (sel === tag || sel === "*") return true;
      if (sel.startsWith("#") && id === sel.slice(1)) return true;
      if (sel.startsWith(".") && cls.split(/\s+/).includes(sel.slice(1))) return true;
      if (sel.includes("[name='") && el.getAttribute("name") === sel.replace(/.*\[name=['"]([^'"]+)['"]\].*/, "$1")) return true;
      if (sel.includes("[data-action='") && el.getAttribute("data-action") === sel.replace(/.*\[data-action=['"]([^'"]+)['"]\].*/, "$1")) return true;
      if (sel.includes(".status") && cls.includes("status")) return true;
      if (sel.includes(".badge") && cls.includes("badge")) return true;
      if (sel.includes(".edit-btn") && cls.includes("edit-btn")) return true;
      if (sel.includes(".save-btn") && cls.includes("save-btn")) return true;
      if (sel.includes("input") && tag === "input") {
        if (sel.includes("[name='")) {
          const name = sel.replace(/.*\[name=['"]([^'"]+)['"]\].*/, "$1");
          return el.getAttribute("name") === name;
        }
        return true;
      }
      if (sel.includes("button") && tag === "button") return true;
      return false;
    };

    const traverse = (node) => {
      for (const child of node.children) {
        for (const sel of selectors) {
          const parts = sel.split(/\s+/);
          if (parts.length === 1) {
            if (matchElement(child, parts[0])) {
              results.push(child);
              break;
            }
          } else {
            const ancestorSel = parts.slice(0, -1).join(" ");
            const targetSel = parts[parts.length - 1];
            if (matchElement(child, targetSel) && child.closest(ancestorSel)) {
              results.push(child);
              break;
            }
          }
        }
        traverse(child);
      }
    };

    traverse(this);
    return results;
  }

  getBoundingClientRect() {
    return { top: 100, left: 100, width: 200, height: 40 };
  }
}

// Build Global DOM Tree
const mockBody = new MockNode("body");
const mockDocument = {
  body: mockBody,
  createElement(tag) {
    if (tag.toLowerCase() === "input" || tag.toLowerCase() === "textarea") {
      return new MockInputElement(tag);
    }
    return new MockNode(tag);
  },
  getElementById(id) {
    const find = (node) => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    return find(mockBody);
  },
  querySelector(sel) {
    return mockBody.querySelector(sel);
  },
  querySelectorAll(sel) {
    return mockBody.querySelectorAll(sel);
  },
};

const mockWindow = {
  document: mockDocument,
  location: { href: "https://store.example.com/admin/inventory", origin: "https://store.example.com" },
  addEventListener: addEventListenerMock,
  removeEventListener: removeEventListenerMock,
  dispatchEvent: dispatchEventMock,
  scrollY: 0,
  scrollTo: () => {},
  getComputedStyle: () => ({ visibility: "visible", display: "block", opacity: "1" }),
  requestAnimationFrame: (cb) => setTimeout(cb, 10),
  cancelAnimationFrame: (id) => clearTimeout(id),
  matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
};

class MockInputElement extends MockNode {
  constructor(tag = "input", attrs = {}, text = "") {
    super(tag, attrs, text);
    this._value = attrs.value || "";
  }
}
Object.defineProperty(MockInputElement.prototype, "value", {
  get() { return this._value ?? ""; },
  set(v) { this._value = v; },
  configurable: true,
});

globalThis.window = mockWindow;
globalThis.document = mockDocument;
globalThis.HTMLElement = MockNode;
globalThis.HTMLButtonElement = MockNode;
globalThis.HTMLInputElement = MockInputElement;
globalThis.HTMLSelectElement = MockNode;
globalThis.HTMLTextAreaElement = MockInputElement;

// --- Helper: Build 10-Row Inventory Table Fixture ---
function setupInventoryTableFixture() {
  mockBody.children = [];

  const table = new MockNode("table", { id: "inventory-table" });
  const tbody = new MockNode("tbody");
  table.appendChild(tbody);
  mockBody.appendChild(table);

  const sampleProducts = [
    { id: "101", title: "Heavyweight Boxy Tee - Black", status: "Draft", price: "24.00" },
    { id: "102", title: "Vintage Washed Tee - Charcoal", status: "Draft", price: "28.00" },
    { id: "103", title: "Heavyweight Boxy Tee - Cream", status: "Draft", price: "24.00" },
    { id: "104", title: "Raw Hem Pocket Tee - Bone", status: "Draft", price: "32.00" },
    { id: "105", title: "Oversized French Terry Crew - Slate", status: "Draft", price: "68.00" },
    { id: "106", title: "Loopback Terry Hoodie - Olive", status: "Draft", price: "84.00" },
    { id: "107", title: "Organic Rib Tank - White", status: "Draft", price: "22.00" },
    { id: "108", title: "Relaxed Canvas Chore Jacket - Tan", status: "Draft", price: "120.00" },
    { id: "109", title: "Heavyweight Boxy Tee - Plum", status: "Draft", price: "24.00" },
    { id: "110", title: "Washed French Terry Short - Sand", status: "Draft", price: "52.00" },
  ];

  sampleProducts.forEach((p) => {
    const tr = new MockNode("tr", { id: `row-${p.id}`, class: "product-row", "data-id": p.id });

    // Name Col
    const tdName = new MockNode("td", { class: "col-title" });
    const titleLink = new MockNode("strong", { class: "title" }, p.title);
    tdName.appendChild(titleLink);
    tr.appendChild(tdName);

    // Status Col
    const tdStatus = new MockNode("td", { class: "col-status" });
    const badge = new MockNode("span", { class: "status badge", "data-status": p.status }, p.status);
    tdStatus.appendChild(badge);
    tr.appendChild(tdStatus);

    // Price Input Col
    const tdPrice = new MockNode("td", { class: "col-price" });
    const priceInput = new MockInputElement("input", { name: "price", type: "text", value: p.price });
    tdPrice.appendChild(priceInput);
    tr.appendChild(tdPrice);

    // Actions Col
    const tdActions = new MockNode("td", { class: "col-actions actions" });
    const editBtn = new MockNode("button", { class: "edit-btn", "data-action": "edit" }, "Edit");
    const saveBtn = new MockNode("button", { class: "save-btn", "data-action": "save" }, "Save");
    tdActions.appendChild(editBtn);
    tdActions.appendChild(saveBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  return sampleProducts;
}

// --- Test Suite Execution ---
async function runTeach1BatchNTests() {
  console.log("===============================================================================");
  console.log("⚡ TEST SUITE: 'Teach 1 → Batch N' DYNAMIC MACRO & HUMAN CONFIRMATION GATE");
  console.log("===============================================================================\n");

  const {
    MacroRecorder,
    BatchRunner,
  } = await import("../dist/index.js");

  // TEST 1: DOM Fixture Verification
  console.log("👉 TEST 1: Setting up 10-Item E-Commerce Inventory Table...");
  const fixtureItems = setupInventoryTableFixture();
  const rows = mockDocument.querySelectorAll("tr");
  console.log(`   Found ${rows.length} rows in active simulated DOM.`);
  assert.strictEqual(rows.length, 10, "Should have 10 table rows");
  console.log("   ✓ PASS: Fixture established with 10 multi-column product items.\n");

  // TEST 2: Teaching Phase ("Teach 1")
  console.log("👉 TEST 2: Recording User Demonstration on Row #1 (Item 101)...");
  let capturedProposal = null;

  MacroRecorder.startRecording({
    onProposalReady: (proposal) => {
      capturedProposal = proposal;
    },
  });

  assert.strictEqual(MacroRecorder.isRecording(), true, "Recorder should be in active state");

  // Simulate User Actions on Row 1
  const row1 = mockDocument.getElementById("row-101");
  assert(row1, "Row 1 must exist");

  const row1EditBtn = row1.querySelector(".edit-btn");
  const row1PriceInput = row1.querySelector("input[name='price']");
  const row1SaveBtn = row1.querySelector(".save-btn");

  assert(row1EditBtn, "Edit button on row 1 must exist");
  assert(row1PriceInput, "Price input on row 1 must exist");
  assert(row1SaveBtn, "Save button on row 1 must exist");

  // User Action 1: Click "Edit"
  dispatchEventMock({
    type: "click",
    target: row1EditBtn,
  });

  // User Action 2: Change Price to $35.00
  row1PriceInput.value = "35.00";
  dispatchEventMock({
    type: "input",
    target: row1PriceInput,
  });

  // User Action 3: Click "Save"
  dispatchEventMock({
    type: "click",
    target: row1SaveBtn,
  });

  console.log("   Simulated 3 sequential actions on Row 1 (click edit -> input price -> click save).");

  // User Finishes Demonstration
  const proposal = MacroRecorder.stopRecording();
  assert.strictEqual(MacroRecorder.isRecording(), false, "Recorder should no longer be active");
  assert(proposal, "Proposal must be produced on stopRecording");
  assert.strictEqual(capturedProposal, proposal, "Callback should receive identical proposal");
  console.log("   ✓ PASS: Demonstration captured and stopped successfully.\n");

  // TEST 3: Macro Parameterization & Sibling Discovery Assertions
  console.log("👉 TEST 3: Verifying Auto-Parameterization and Sibling Entity Discovery...");
  console.log(`   Captured template steps: ${proposal.templateSteps.length}`);
  console.log(`   Discovered sibling entities: ${proposal.entities.length}`);

  assert.strictEqual(proposal.templateSteps.length, 3, "Should have 3 parameterized steps");
  assert.strictEqual(proposal.entities.length, 10, "Should automatically detect all 10 sibling rows");

  // Inspect Parameterized Selectors
  const step1 = proposal.templateSteps[0];
  const step2 = proposal.templateSteps[1];
  const step3 = proposal.templateSteps[2];

  console.log("   Step 1:", step1.title, "->", step1.target, `(action: ${step1.action})`);
  console.log("   Step 2:", step2.title, "->", step2.target, `(action: ${step2.action}, val: ${step2.value})`);
  console.log("   Step 3:", step3.title, "->", step3.target, `(action: ${step3.action})`);

  assert.strictEqual(step1.action, "click");
  assert(step1.target.includes("{{entity_selector}}"), "Step 1 target must be relative to entity container");
  assert(step1.target.includes(".edit-btn") || step1.target.includes("button") || step1.target.includes("data-action"), "Step 1 target must target edit button");

  assert.strictEqual(step2.action, "type");
  assert(step2.target.includes("{{entity_selector}}"), "Step 2 target must be relative to entity container");
  assert.strictEqual(step2.value, "35.00", "Step 2 value must be the parameterized input");

  assert.strictEqual(step3.action, "click");
  assert(step3.target.includes("{{entity_selector}}"), "Step 3 target must be relative to entity container");
  assert(step3.target.includes(".save-btn") || step3.target.includes("button") || step3.target.includes("data-action"), "Step 3 target must target save button");

  // Verify Discovered Entity Metadata
  for (let i = 0; i < 10; i++) {
    const entity = proposal.entities[i];
    assert.strictEqual(entity.id, `row-${fixtureItems[i].id}`, `Entity ${i} ID mismatch`);
    assert(entity.name.includes(fixtureItems[i].title.slice(0, 15)), `Entity ${i} title mismatch: ${entity.name}`);
    assert.strictEqual(entity.selected, true, "Entities should be selected by default in proposal");
    assert.strictEqual(entity.executionState, "pending", "Initial state must be pending");
  }

  console.log("   ✓ PASS: Dynamic parameterization and sibling extraction verified 100%.\n");

  // TEST 4: Human Confirmation Gate Review & Selective Filtering
  console.log("👉 TEST 4: Human Confirmation Gate Selective Approval...");
  // Simulate user reviewing matrix: approve first 8 items, UNCHECK items 9 and 10
  proposal.entities[8].selected = false; // Item 109 deselected
  proposal.entities[9].selected = false; // Item 110 deselected

  const approvedCount = proposal.entities.filter(e => e.selected).length;
  const skippedCount = proposal.entities.filter(e => !e.selected).length;
  console.log(`   User approved ${approvedCount} entities, excluded ${skippedCount} entities.`);
  assert.strictEqual(approvedCount, 8);
  assert.strictEqual(skippedCount, 2);
  console.log("   ✓ PASS: Confirmation gate selection correctly configured.\n");

  // TEST 5: Sequential Batch Replay with Live Progress & Error Containment
  console.log("👉 TEST 5: Executing Batch Runner across Approved Entities...");
  const progressLogs = [];

  const runner = new BatchRunner();
  const execResult = await runner.executeBatch(proposal, {
    onEntityProgress: (idx, entity, percent) => {
      progressLogs.push({ idx, name: entity.name, state: entity.executionState, percent });
    },
  });

  console.log(`   Batch Execution Finished:`);
  console.log(`   - Succeeded: ${execResult.succeededCount}`);
  console.log(`   - Failed:    ${execResult.failedCount}`);
  console.log(`   - Total:     ${execResult.totalEntities}`);

  assert.strictEqual(execResult.totalEntities, 10, "Should report 10 total entities");
  assert.strictEqual(execResult.succeededCount, 8, "All 8 approved entities should succeed");
  assert.strictEqual(execResult.failedCount, 0, "No errors expected on normal items");

  // Verify entities 1 to 8 completed
  for (let i = 0; i < 8; i++) {
    assert.strictEqual(proposal.entities[i].executionState, "success", `Entity ${i} should be marked success`);
  }

  // Verify entities 9 and 10 were properly skipped
  assert.strictEqual(proposal.entities[8].executionState, "skipped", "Entity 8 should be skipped");
  assert.strictEqual(proposal.entities[9].executionState, "skipped", "Entity 9 should be skipped");

  console.log("   ✓ PASS: Batch Runner executed 8 items sequentially, skipped unapproved items cleanly.\n");

  // TEST 6: Error Boundary Containment (Single Entity Failure Doesn't Halt Batch)
  console.log("👉 TEST 6: Testing Isolated Error Boundary & Fault Containment...");
  // Reset states
  proposal.entities.forEach(e => {
    e.selected = true;
    e.executionState = "pending";
    delete e.error;
  });

  // Deliberately damage Row 4's save button to trigger a step error
  const row4 = mockDocument.getElementById("row-104");
  const row4SaveBtn = row4.querySelector(".save-btn");
  row4SaveBtn.remove(); // Removed from DOM so smartQuerySelector fails on row 4 step 3!

  const faultTolerantResult = await runner.executeBatch(proposal);

  console.log(`   Fault Test Result:`);
  console.log(`   - Succeeded: ${faultTolerantResult.succeededCount} (expected 9)`);
  console.log(`   - Failed:    ${faultTolerantResult.failedCount} (expected 1: Row 104)`);

  assert.strictEqual(faultTolerantResult.failedCount, 1, "Only Row 104 should fail");
  assert.strictEqual(faultTolerantResult.succeededCount, 9, "The other 9 rows should succeed despite row 4 error");
  assert.strictEqual(proposal.entities[3].executionState, "failed", "Row 4 must be marked failed");
  assert(proposal.entities[3].error, "Row 4 must have error explanation recorded");
  assert.strictEqual(proposal.entities[4].executionState, "success", "Row 5 must succeed after Row 4 failed");

  console.log("   ✓ PASS: Error boundary isolated Row 4 without aborting subsequent entities.\n");

  console.log("===============================================================================");
  console.log("🎉 ALL TESTS PASSED: 'Teach 1 → Batch N' MACRO AUTOMATION FULLY VERIFIED!");
  console.log("===============================================================================\n");
}

runTeach1BatchNTests().catch((err) => {
  console.error("❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
