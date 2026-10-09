// Standalone DOM Mock for Node.js test environment
class MockElement {
  constructor(tag, attrs = {}, text = "") {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.textContent = text;
    this.value = attrs.value || "";
    this.placeholder = attrs.placeholder || "";
    this.id = attrs.id || "";
    this.className = attrs.class || "";
    this.type = attrs.type || (tag === "input" ? "text" : "");
    this.isConnected = true;
    this.listeners = {};
    this.children = [];
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, val) { this.attrs[name] = val; }
  hasAttribute(name) { return name in this.attrs; }
  getBoundingClientRect() { return { top: 50, left: 20, width: 120, height: 40, bottom: 90, right: 140 }; }
  scrollIntoView() {}
  focus() { this.dispatchEvent({ type: "focus" }); }
  addEventListener(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
  dispatchEvent(event) { (this.listeners[event.type || event] || []).forEach(fn => fn(event)); return true; }
  click() { this.dispatchEvent({ type: "click" }); }
  closest() { return null; }
}

const elLink = new MockElement("a", { href: "/catalog", "aria-label": "Catalog Navigation" }, "Catalog");
const elBtn = new MockElement("button", { id: "add-to-cart-btn", "aria-label": "Add Keyboard to Cart" }, "Add to Cart");
const elInput = new MockElement("input", { type: "text", id: "email-field", placeholder: "Enter your email" }, "");
const elSelect = new MockElement("select", { id: "color-select" }, "");

const mockElements = [elLink, elBtn, elInput, elSelect];

globalThis.window = {
  location: { href: "https://example.com/shop", pathname: "/shop", hash: "" },
  scrollY: 0,
  innerHeight: 800,
  innerWidth: 1024,
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto" }),
};
globalThis.document = {
  title: "Test Store",
  activeElement: null,
  body: new MockElement("body"),
  querySelectorAll: (query) => mockElements,
  querySelector: (query) => {
    if (query === "#add-to-cart-btn" || query.includes("add-to-cart")) return elBtn;
    if (query === "#email-field" || query.includes("email")) return elInput;
    if (query.includes("select")) return elSelect;
    return mockElements[0];
  },
  getElementById: (id) => mockElements.find(e => e.id === id) || null,
  createElement: (tag) => new MockElement(tag),
};
document.body.appendChild = (el) => { mockElements.push(el); };
globalThis.HTMLElement = MockElement;
globalThis.HTMLInputElement = MockElement;
globalThis.HTMLSelectElement = MockElement;
globalThis.HTMLAnchorElement = MockElement;
globalThis.PointerEvent = function(type) { this.type = type; };
globalThis.FocusEvent = function(type) { this.type = type; };
globalThis.InputEvent = function(type, opts) { this.type = type; this.data = opts?.data; };
globalThis.KeyboardEvent = function(type, opts) { this.type = type; this.key = opts?.key; };
globalThis.MouseEvent = function(type) { this.type = type; };

// Import bundled primitives from dist/index.js
const {
  A11yTreeEngine,
  ActionDispatcher,
  StateDeltaVerifier,
  AgentHarness,
} = await import("../dist/index.js");
const { parseHarnessDecision } = await import("../src/lib/harnessDecisionParser.ts");

console.log("======================================================================");
console.log("🚀 TESTING NUMERIC ELEMENT GROUNDING, A11Y TREE & STATE DELTA ENGINE");
console.log("======================================================================\n");


// TEST SUITE 1: A11yTreeEngine
console.log("📌 Category 1: A11yTree Scanning & Token-Compact Representation");
const scannedNodes = A11yTreeEngine.scan({ viewportOnly: false, maxItems: 10 });
console.log(`Scanned ${scannedNodes.length} interactive elements.`);

if (scannedNodes.length < 4) {
  throw new Error(`Expected at least 4 interactive nodes, got ${scannedNodes.length}`);
}

const formatted = A11yTreeEngine.formatForPrompt(scannedNodes);
console.log("Formatted a11y tree output:\n" + formatted);

if (!formatted.includes("[1]")) throw new Error("Formatted output missing [1] index");
if (!formatted.includes("button") && !formatted.includes("link")) throw new Error("Formatted output missing roles");
console.log("  ✅ PASS: A11yTreeEngine correctly extracted and formatted indexed nodes.\n");

// TEST SUITE 2: Node Lookup & O(1) Target Resolution
console.log("📌 Category 2: Integer Target Resolution (ActionDispatcher)");
const node1 = A11yTreeEngine.getNodeById(1);
if (!node1) throw new Error("A11yTreeEngine failed to find node 1");
console.log(`Node 1: [${node1.id}] ${node1.role} "${node1.name}"`);

const resolvedById = ActionDispatcher.resolveTarget(1);
if (!resolvedById.element) throw new Error("Failed resolving target by integer 1");
if (resolvedById.matchedVia !== "a11y-id") throw new Error("Expected matchedVia 'a11y-id'");
console.log(`Resolved target 1 -> ${resolvedById.identifierDescription}`);

const resolvedByString = ActionDispatcher.resolveTarget("[1]");
if (!resolvedByString.element) throw new Error("Failed resolving target by string '[1]'");
console.log(`Resolved target "[1]" -> ${resolvedByString.identifierDescription}`);

const resolvedBySelector = ActionDispatcher.resolveTarget("#add-to-cart-btn");
if (!resolvedBySelector.element) throw new Error("Failed resolving target by selector '#add-to-cart-btn'");
if (resolvedBySelector.matchedVia !== "css-selector") throw new Error("Expected matchedVia 'css-selector'");
console.log(`Resolved selector '#add-to-cart-btn' -> ${resolvedBySelector.identifierDescription}`);
console.log("  ✅ PASS: ActionDispatcher seamlessly resolves both integer IDs and CSS selectors.\n");

// TEST SUITE 3: Synthetic Actions (Click & Type)
console.log("📌 Category 3: Synthetic Human Actions & Event Propagation");
let clicked = false;
const btn = document.getElementById("add-to-cart-btn");
btn.addEventListener("click", () => { clicked = true; });

await ActionDispatcher.click(btn);
if (!clicked) throw new Error("Synthetic click failed to trigger event listener");
console.log("  ✅ PASS: Synthetic click dispatched and captured.");

const input = document.getElementById("email-field");
let inputVal = "";
input.addEventListener("input", (e) => { inputVal = input.value; });

await ActionDispatcher.type(input, "agent@antigravity.dev", { clearFirst: true, pressEnter: true });
if (input.value !== "agent@antigravity.dev") throw new Error(`Type failed: expected 'agent@antigravity.dev', got '${input.value}'`);
console.log(`  ✅ PASS: Synthetic type updated reactive value to '${input.value}'.\n`);

// TEST SUITE 4: State Delta Verifier
console.log("📌 Category 4: State Delta Verification (OODA Loop Closure)");
const beforeSnap = StateDeltaVerifier.captureSnapshot();
window.location.hash = "#catalog";
const newEl = document.createElement("div");
newEl.className = "toast";
document.body.appendChild(newEl);
const afterSnap = StateDeltaVerifier.captureSnapshot();

const delta = StateDeltaVerifier.computeDelta(beforeSnap, afterSnap);
console.log("Computed delta summary:", delta.summary);
if (!delta.hasStateChanged) throw new Error("StateDeltaVerifier failed to detect hash and DOM changes");
if (!delta.urlChanged) throw new Error("StateDeltaVerifier failed to detect URL hash change");
console.log("  ✅ PASS: StateDeltaVerifier correctly identified state transition.\n");

// TEST SUITE 5: Harness Decision Parsing for Numeric Tools
console.log("📌 Category 5: Decision Parsing for Numeric ID Tool Calls");
const decisions = [
  { raw: '{"tool": "click", "args": {"target": 1}}', expectedTool: "click", expectedTarget: 1 },
  { raw: '{"tool": "click", "args": {"targetId": 2}}', expectedTool: "click", expectedTarget: 2 },
  { raw: '{"click": 3}', expectedTool: "click", expectedTarget: 3 },
  { raw: '{"click": {"target": 4}}', expectedTool: "click", expectedTarget: 4 },
  { raw: 'CLICK(5)', expectedTool: "browse", expectedTarget: "5" },
  { raw: '{"tool": "type", "args": {"target": 2, "value": "shoes"}}', expectedTool: "type", expectedTarget: 2 },
  { raw: 'TYPE(4, "test")', expectedTool: "browse", expectedTarget: "4" },
];

for (const d of decisions) {
  const parsed = parseHarnessDecision(d.raw);
  if (parsed.tool !== d.expectedTool) {
    throw new Error(`Expected tool '${d.expectedTool}', got '${parsed.tool}' for '${d.raw}'`);
  }
  const argTarget = parsed.args.target ?? parsed.args.targetId;
  if (String(argTarget) !== String(d.expectedTarget)) {
    throw new Error(`Expected target '${d.expectedTarget}', got '${argTarget}' for '${d.raw}'`);
  }
}
console.log("  ✅ PASS: Parser cleanly extracts integer targets across all syntax variations.\n");

// TEST SUITE 6: Agent Harness End-to-End Tool Execution
console.log("📌 Category 6: End-to-End Harness Execution with Numeric Targets");
const harness = new AgentHarness();

// Execute click using numeric ID 1
const clickRes = await harness.executeTool("click", { target: 1 });
console.log("Harness executeTool('click', { target: 1 }) ->", clickRes);
if (!clickRes.includes("Successfully clicked")) throw new Error(`Click by ID failed: ${clickRes}`);
if (!clickRes.includes("State transition:")) throw new Error(`Click missing state transition summary: ${clickRes}`);

// Execute type using numeric ID 3 (or selector fallback)
const typeRes = await harness.executeTool("type", { target: "#email-field", value: "hello@world.com" });
console.log("Harness executeTool('type') ->", typeRes);
if (!typeRes.includes("Successfully typed")) throw new Error(`Type failed: ${typeRes}`);

console.log("  ✅ PASS: End-to-end numeric element execution with state feedback succeeded.\n");

console.log("======================================================================");
console.log("🎉 ALL NUMERIC GROUNDING & SOTA WEB AGENT TESTS PASSED (6/6 SUITES)!");
console.log("======================================================================");
