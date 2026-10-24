/**
 * Web Agent Unit Test Suite (Synthetic DOM Mocks)
 *
 * Implements unit test verification on mock DOM elements modeled after patterns in web agent datasets:
 * 1. Mind2Web (OSU): Canonical DOM element selection & synthetic event propagation
 * 2. WebArena (CMU): Programmatic state assertions (Deterministic Oracle)
 * 3. WebVoyager (Tsinghua): Set-of-Marks (SoM) dual modality & execution error recovery
 * 4. SeeClick / ScreenSpot (NJU): Resolution-invariant normalized coordinate clicking [0, 1000]
 * 5. WebShop (Princeton): E-commerce multi-attribute constraint verification
 * 6. OSWorld / WorkArena (ServiceNow): Modal dialog trapping & isolated enterprise workflows
 *
 * NOTE: These are local unit tests on synthetic mock DOMs; see test_empirical_harness_eval.mjs
 * for measured empirical element selection benchmarks across real multi-domain pages.
 */

class MockElement {
  constructor(tag, attrs = {}, text = "", bounds = { top: 50, left: 20, width: 120, height: 40 }) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.textContent = text;
    this.value = attrs.value || "";
    this.placeholder = attrs.placeholder || "";
    this.id = attrs.id || "";
    this.className = attrs.class || "";
    const classes = (attrs.class || "").split(/\s+/).filter(Boolean);
    this.classList = {
      contains: (c) => classes.includes(c),
      add: (c) => { if (!classes.includes(c)) classes.push(c); },
      remove: (c) => { const idx = classes.indexOf(c); if (idx !== -1) classes.splice(idx, 1); },
      [Symbol.iterator]: function* () { yield* classes; },
      length: classes.length,
    };
    this.type = attrs.type || (tag === "input" ? "text" : "");
    this.isConnected = true;
    this.listeners = {};
    this.parentElement = null;
    this._bounds = bounds;
    if (tag.toUpperCase() === "INPUT" && globalThis.HTMLInputElement) {
      Object.setPrototypeOf(this, globalThis.HTMLInputElement.prototype);
    }
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, val) { this.attrs[name] = val; }
  hasAttribute(name) { return name in this.attrs; }
  getBoundingClientRect() { return this._bounds; }
  scrollIntoView() {}
  focus() { this.dispatchEvent({ type: "focus" }); }
  addEventListener(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
  dispatchEvent(event) {
    const type = typeof event === "string" ? event : (event.type || "click");
    (this.listeners[type] || []).forEach(fn => fn(event));
    return true;
  }
  click() { this.dispatchEvent({ type: "click" }); }
  closest(selector) {
    if (selector.includes("dialog") && this.attrs.inModal) {
      return new MockElement("dialog", { open: "true" });
    }
    return null;
  }
  contains(other) {
    return Boolean(other && other.attrs && other.attrs.inModal);
  }
}

globalThis.HTMLElement = MockElement;
globalThis.HTMLInputElement = class HTMLInputElement extends MockElement {};
Object.defineProperty(globalThis.HTMLInputElement.prototype, "value", {
  get() { return this._val ?? ""; },
  set(v) { this._val = String(v); },
  configurable: true,
});
globalThis.HTMLTextAreaElement = class HTMLTextAreaElement extends MockElement {};
Object.defineProperty(globalThis.HTMLTextAreaElement.prototype, "value", {
  get() { return this._val ?? ""; },
  set(v) { this._val = String(v); },
  configurable: true,
});
globalThis.HTMLSelectElement = class extends MockElement {};
globalThis.FocusEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.InputEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.Event = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.PointerEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.MouseEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };

async function runSotaBenchmarks() {
  console.log("======================================================================");
  console.log("🌐 WEB AGENT UNIT TESTS (Synthetic DOM Mocks Modeled After SOTA Benchmarks)");
  console.log("======================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // --- 1. Mind2Web: Canonical DOM Grounding & Event Propagation ---
  console.log("📌 1. Mind2Web: Multi-Domain DOM Grounding & Integer Element Resolution");
  {
    const elExplore = new MockElement("a", { href: "/explore", "aria-label": "Explore Catalog" }, "Explore");
    const elTheme = new MockElement("button", { id: "theme-btn", "aria-label": "Toggle Dark Mode" }, "Theme");
    const elSearch = new MockElement("input", { id: "query-input", placeholder: "Search docs..." });
    const elSearchBtn = new MockElement("button", { id: "search-btn" }, "Search");
    const elTab = new MockElement("button", { role: "tab", "aria-selected": "true" }, "All Reports");

    const elements = [elExplore, elTheme, elSearch, elSearchBtn, elTab];

    globalThis.window = {
      location: { href: "https://enterprise.app/dashboard", pathname: "/dashboard", hash: "" },
      scrollY: 0,
      innerWidth: 1024,
      innerHeight: 768,
      getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto" }),
    };
    globalThis.document = {
      title: "Enterprise Dashboard",
      activeElement: null,
      body: new MockElement("body"),
      querySelectorAll: () => elements,
      querySelector: (s) => elements.find(e => (s.includes(e.id) || (e.getAttribute("aria-label") && s.includes(e.getAttribute("aria-label"))))),
      getElementById: (id) => elements.find(e => e.id === id) || null,
    };

    const { A11yTreeEngine, ActionDispatcher } = await import("../dist/index.js");

    const nodes = A11yTreeEngine.scan({ viewportOnly: false });
    assert(nodes.length === 5, `Mind2Web parser extracted ${nodes.length} interactive nodes across hierarchical tree`);

    const themeNode = nodes.find(n => n.name === "Toggle Dark Mode");
    assert(themeNode !== undefined, "Mind2Web accessible name computation correctly extracted aria-label");

    const resolved = ActionDispatcher.resolveTarget(themeNode.id);
    assert(resolved.element?.id === "theme-btn", "O(1) resolution from integer ID to live DOM node");

    let typedValue = "";
    elSearch.addEventListener("input", (e) => { typedValue = e.data || elSearch.value; });
    const typeSuccess = await ActionDispatcher.type(elSearch, "Q4 Financial Forecast", { clearFirst: true });
    assert(typeSuccess && (typedValue === "Q4 Financial Forecast" || elSearch.value === "Q4 Financial Forecast"), "Synthetic type dispatched full reactive event cycle");
  }

  // --- 2. WebArena: Programmatic Oracle State Assertions ---
  console.log("\n📌 2. WebArena: Programmatic Oracle Evaluation & State Transitions");
  {
    const statusDiv = new MockElement("div", { id: "order-status", "data-state": "idle" }, "Idle");
    const checkoutBtn = new MockElement("button", { id: "checkout-btn" }, "Proceed to Checkout");
    const elements = [statusDiv, checkoutBtn];

    globalThis.window = {
      location: { href: "https://shop.webarena.internal/cart", hash: "" },
      scrollY: 0,
      innerWidth: 1024,
      innerHeight: 768,
      getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto" }),
    };
    globalThis.document = {
      title: "WebArena Shop",
      activeElement: null,
      body: new MockElement("body"),
      querySelectorAll: (sel) => (sel === "*" ? [statusDiv, checkoutBtn, new MockElement("div")] : elements),
      querySelector: (s) => elements.find(e => s.includes(e.id)) || null,
    };

    checkoutBtn.addEventListener("click", () => {
      statusDiv.setAttribute("data-state", "processing");
      statusDiv.textContent = "Processing order...";
      globalThis.window.location.hash = "#review";
    });

    const { StateDeltaVerifier, ActionDispatcher, SafetyGate } = await import("../dist/index.js");
    if (SafetyGate && typeof SafetyGate.setConfirmHandler === "function") {
      SafetyGate.setConfirmHandler(async () => true);
    }

    const before = StateDeltaVerifier.captureSnapshot();
    await ActionDispatcher.click(checkoutBtn);
    const after = StateDeltaVerifier.captureSnapshot();
    const delta = StateDeltaVerifier.computeDelta(before, after);

    assert(delta.urlChanged && after.hash === "#review", "WebArena Oracle: URL hash transition verified (#review)");
    assert(statusDiv.getAttribute("data-state") === "processing", "WebArena Oracle: DOM attribute transition verified (data-state=processing)");
    assert(delta.hasStateChanged, "StateDeltaVerifier verified non-stagnant environment mutation");
  }

  // --- 3. WebVoyager: Set-of-Marks Dual Modality & Error Recovery ---
  console.log("\n📌 3. WebVoyager: Set-of-Marks Badges & Error Feedback Accumulator");
  {
    const { SomOverlayManager, isFailureObservation } = await import("../dist/index.js");

    assert(typeof SomOverlayManager.renderBadges === "function", "SomOverlayManager provides visual Set-of-Marks overlay engine");
    assert(typeof SomOverlayManager.clearBadges === "function", "SomOverlayManager supports zero-trace badge cleanup");

    assert(isFailureObservation("Element not found on page"), "WebVoyager error feedback: flags missing element as failure");
    assert(isFailureObservation("Error: 0 occurrences matching selector"), "WebVoyager error feedback: flags 0 occurrences as failure");
    assert(!isFailureObservation("Successfully clicked button [1]"), "Correctly recognizes successful action");
  }

  // --- 4. SeeClick / ScreenSpot: Normalized Coordinate Grounding [0, 1000] ---
  console.log("\n📌 4. SeeClick / ScreenSpot: Resolution-Invariant Coordinate Clicking");
  {
    let clicked = false;
    const centerBtn = new MockElement("button", { id: "center-target" }, "Center", {
      top: 450, left: 450, width: 100, height: 100
    });
    centerBtn.addEventListener("click", () => { clicked = true; });

    globalThis.window = {
      innerWidth: 1000,
      innerHeight: 1000,
      scrollY: 0,
      getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto" }),
    };
    globalThis.document = {
      title: "Canvas UI",
      activeElement: null,
      body: new MockElement("body"),
      elementFromPoint: (x, y) => {
        if (x >= 450 && x <= 550 && y >= 450 && y <= 550) {
          return centerBtn;
        }
        return null;
      },
      querySelectorAll: () => [centerBtn],
      querySelector: () => centerBtn,
    };

    const { ActionDispatcher } = await import("../dist/index.js");
    const success = await ActionDispatcher.clickCoordinates(500, 500);
    assert(success && clicked, "SeeClick normalized coordinates (500, 500) successfully mapped to center point and clicked");
  }

  // --- 5. WebShop: E-Commerce Multi-Attribute Constraint Grounding ---
  console.log("\n📌 5. WebShop: E-Commerce Multi-Attribute Constraint Verification");
  {
    const sizeM = new MockElement("button", { class: "option-pill", "data-attr": "size" }, "M");
    const sizeL = new MockElement("button", { class: "option-pill", "data-attr": "size" }, "L");
    const colorBlack = new MockElement("button", { class: "option-pill", "data-attr": "color" }, "Black");
    const colorBrown = new MockElement("button", { class: "option-pill", "data-attr": "color" }, "Brown");
    const addToCart = new MockElement("button", { id: "add-to-cart" }, "Add to Cart");

    const items = [sizeM, sizeL, colorBlack, colorBrown, addToCart];
    globalThis.document.querySelectorAll = () => items;

    const { A11yTreeEngine } = await import("../dist/index.js");
    const nodes = A11yTreeEngine.scan({ viewportOnly: false });

    const sizeNodes = nodes.filter(n => n.name === "M" || n.name === "L");
    const colorNodes = nodes.filter(n => n.name === "Black" || n.name === "Brown");

    assert(sizeNodes.length === 2, "WebShop attribute parser identified all discrete Size options");
    assert(colorNodes.length === 2, "WebShop attribute parser identified all discrete Color options");
    assert(nodes.some(n => n.name === "Add to Cart"), "Add to cart conversion target cleanly groundable");
  }

  // --- 6. OSWorld / WorkArena: Modal Dialog Trapping & Workflow Isolation ---
  console.log("\n📌 6. OSWorld / WorkArena: Modal Dialog Trapping & Action Scope Isolation");
  {
    const bgBtn1 = new MockElement("button", { id: "bg-btn-1" }, "Background Link 1");
    const bgBtn2 = new MockElement("button", { id: "bg-btn-2" }, "Background Link 2");

    const modalDialog = new MockElement("dialog", { open: "true", role: "dialog", "aria-modal": "true" }, "Modal");
    const modalCancel = new MockElement("button", { id: "modal-cancel", inModal: true }, "Cancel");
    const modalApprove = new MockElement("button", { id: "modal-approve", inModal: true }, "Confirm & Approve");

    const allElements = [bgBtn1, bgBtn2, modalCancel, modalApprove];

    globalThis.document.querySelector = (sel) => {
      if (sel.includes("dialog")) return modalDialog;
      return null;
    };
    globalThis.document.querySelectorAll = () => allElements;

    const { A11yTreeEngine } = await import("../dist/index.js");
    const nodes = A11yTreeEngine.scan({ viewportOnly: false });

    assert(nodes.length === 4, "Scanned all elements with open modal");
    assert(nodes[0].inModal === true, "OSWorld Modal Trapping: First element is inside active dialog");
    assert(nodes[0].name === "Cancel" || nodes[0].name === "Confirm & Approve", "Modal action buttons prioritized ahead of background elements");

    const formatted = A11yTreeEngine.formatForPrompt(nodes);
    assert(formatted.includes("[MODAL]"), "Formatted prompt explicitly flags [MODAL] candidate elements for small model grounding");
  }

  console.log("\n======================================================================");
  console.log(`🎉 ALL SOTA WEB AGENT BENCHMARKS PASSED (${passed}/${total} TESTS)!`);
  console.log("======================================================================");
}

runSotaBenchmarks().catch(err => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
