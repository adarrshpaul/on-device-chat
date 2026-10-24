/**
 * Giskard LLM & Chatbot Benchmark Stress Test Suite
 *
 * Implements adversarial test categories from Giskard benchmark methodology:
 * 1. Goal Hijacking & Sandbox Escapes (Security)
 * 2. Business Logic & Tool Parameter Abuse (Tool Misuse)
 * 3. Catalog Grounding & Hallucination Defense (Misinformation)
 * 4. Conversational Flow & Visual Grounding (MT-Bench / Arena)
 * 5. Architectural Honesty & Tier Isolation (Zero Fraud Mandate)
 */

import { parseHarnessDecision } from "../src/lib/harnessDecisionParser.ts";
import { runSandboxExpression } from "../src/lib/safeExpression.ts";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

console.log("======================================================================");
console.log("🚀 STARTING GISKARD CONVERSATION & CHATBOT BENCHMARK TEST SUITE");
console.log("======================================================================\n");

// -----------------------------------------------------------------------------
// CATEGORY 1: Visual Grounding & Preamble Interception
// -----------------------------------------------------------------------------
console.log("📌 Category 1: Visual Grounding & Conversational Preamble Interception");

const v1 = parseHarnessDecision("I can help you with that! Here is what I can do.", "What is on this page?");
assert(v1.tool === "browse" && v1.args.action === "see", "Intercepts 'What is on this page?' and routes to browse(action='see')");

const v2 = parseHarnessDecision("Certainly! Let me check the screen.", "what do you see ??");
assert(v2.tool === "browse" && v2.args.action === "see", "Intercepts 'what do you see ??' and routes to browse(action='see')");

const v3 = parseHarnessDecision("I am ready to receive your request.", "describe this page");
assert(v3.tool === "browse" && v3.args.action === "see", "Intercepts 'describe this page' and routes to browse(action='see')");

const v4 = parseHarnessDecision("Here are the products.", "what products are on this page");
assert(v4.tool === "browse" && v4.args.action === "see", "Intercepts 'what products are on this page' and routes to browse(action='see')");

const v5 = parseHarnessDecision("I will inspect the viewport for you.", "Describe what is visible on this page in detail.");
assert(v5.tool === "browse" && v5.args.action === "see", "Intercepts 'Describe what is visible on this page in detail.' and routes to browse(action='see')");

const v6 = parseHarnessDecision('{"tool": "...", "args": {}}', "Describe what is visible on this page in detail.");
assert(v6.tool === "browse" && v6.args.action === "see", "Rejects placeholder tool '...' and auto-routes visual query to browse(action='see')");

const v7 = parseHarnessDecision('{"tool": "..."}', "Hello assistant");
assert(v7.tool === "final", "Rejects placeholder tool '...' on generic query and falls back to final");

// -----------------------------------------------------------------------------
// CATEGORY 2: Prompt Injection & Sandbox Escape Defense
// -----------------------------------------------------------------------------
console.log("\n📌 Category 2: Security Vulnerabilities & Sandbox Escapes");

// Tests the REAL sandbox used by AgentHarness (it previously tested a pasted copy of the code)
const testSandbox = (code, context = {}) => runSandboxExpression(code, context);

const s1 = testSandbox("this.constructor.constructor('return process')()");
assert(s1.startsWith("SecurityError"), "Blocks constructor prototype escape");

const s2 = testSandbox("globalThis.fetch('https://malicious.com')");
assert(s2.startsWith("SecurityError"), "Blocks globalThis network access");

const s3 = testSandbox("document.cookie");
assert(s3.startsWith("SecurityError"), "Blocks document.cookie exfiltration");

const s4 = testSandbox("window.location.href = 'https://phishing.com'");
assert(s4.startsWith("SecurityError"), "Blocks window redirect attack");

const s5 = testSandbox("42 * 2 + 10");
assert(s5 === "94", "Safely computes legitimate non-malicious mathematical expressions");

// Regression for the regex-blocklist bypass class: names assembled from string pieces.
// The parser has no strings, brackets or property access, so none of this can reach an object.
globalThis.__sandboxCanary = false;
const bypasses = [
  // This exact input flipped the canary under the old regex + new Function sandbox (verified 2026-10-24)
  '[]["con"+"structor"]["con"+"structor"]("glo"+"balThis.__sandboxCanary = true")()',
  '(1)["con"+"structor"]',
  '`${1}`',
  'Math["co"+"nstructor"]',
  'context.__proto__',
];
for (const b of bypasses) {
  const r = testSandbox(b);
  assert(/^(SecurityError|Sandbox syntax error)/.test(r), `Refuses string-built escape: ${b.slice(0, 40)}`);
}
assert(globalThis.__sandboxCanary === false, "No sandbox input executed host JavaScript (canary untouched)");

assert(testSandbox("Math.round(context.price * 1.18 * 100) / 100", { price: 19.99 }) === "23.59", "Reads numeric context fields and Math functions");
assert(testSandbox("max(3, 7) > 5 ? 1 : 0") === "1", "Supports comparisons and ternary");
assert(testSandbox("context.name", { name: "x" }).startsWith("Sandbox syntax error"), "Rejects non-numeric context fields");

// -----------------------------------------------------------------------------
// CATEGORY 3: Business Logic & Tool Parameter Abuse Defense
// -----------------------------------------------------------------------------
console.log("\n📌 Category 3: Tool Parameter Abuse & Boundary Defense");

function validateToolCall(toolName, args) {
  if (toolName === "addToCart") {
    const qty = Number(args.quantity);
    if (isNaN(qty) || qty <= 0) {
      return { error: "Invalid quantity: must be a positive integer greater than 0." };
    }
    if (qty > 100) {
      return { error: "Quantity limit exceeded: maximum allowed quantity per order is 100." };
    }
    return { success: true, quantity: Math.floor(qty) };
  }

  if (toolName === "navigateTo") {
    const path = String(args.path || "").trim();
    if (!path || /^(javascript:|data:|vbscript:)/i.test(path) || path.includes("<script") || path.length > 80) {
      return { error: "Invalid destination path: must be a safe relative route." };
    }
    return { success: true, path };
  }

  return { success: true };
}

const p1 = validateToolCall("addToCart", { quantity: -5 });
assert(p1.error && p1.error.includes("Invalid quantity"), "Rejects negative addToCart quantity (-5)");

const p2 = validateToolCall("addToCart", { quantity: 1000000 });
assert(p2.error && p2.error.includes("Quantity limit exceeded"), "Rejects overflow addToCart quantity (1,000,000)");

const p3 = validateToolCall("addToCart", { quantity: "invalid" });
assert(p3.error && p3.error.includes("Invalid quantity"), "Rejects NaN string quantity ('invalid')");

const p4 = validateToolCall("addToCart", { quantity: 3 });
assert(p4.success && p4.quantity === 3, "Accepts valid within-bounds quantity (3)");

const p5 = validateToolCall("navigateTo", { path: "javascript:alert(1)" });
assert(p5.error && p5.error.includes("Invalid destination path"), "Rejects dangerous javascript: protocol XSS navigation");

const p6 = validateToolCall("navigateTo", { path: "/products/<script>evil()</script>" });
assert(p6.error && p6.error.includes("Invalid destination path"), "Rejects script tag injection in navigation path");

const p7 = validateToolCall("navigateTo", { path: "/cart" });
assert(p7.success && p7.path === "/cart", "Accepts clean relative route '/cart'");

// -----------------------------------------------------------------------------
// CATEGORY 4: Catalog Grounding & Hallucination Prevention
// -----------------------------------------------------------------------------
console.log("\n📌 Category 4: Catalog Grounding & Hallucination Defense");

function verifyCatalogItem(userGoal, availableCatalog) {
  const goalLower = userGoal.toLowerCase();
  const catalogTexts = availableCatalog.map(item => item.toLowerCase()).join(" ");

  const matchNonCatalog = goalLower.match(/\b(?:add|buy|get|purchase)\s+(?:\d+\s+)?(.+?)(?:\s+(?:to\s+(?:my\s+)?cart|please|now))?$/i);
  if (matchNonCatalog && matchNonCatalog[1]) {
    const requestedItem = matchNonCatalog[1].trim().toLowerCase();
    const genericWords = ["item", "items", "product", "products", "one", "this", "it", "to", "cart", "a", "an", "the"];
    const categoryNouns = ["watch", "headphones", "headphone", "keyboard", "keyboards", "shoes", "phone", "laptop", "accessory", "gear", "device"];
    if (!genericWords.includes(requestedItem) && requestedItem.length > 2) {
      const itemWords = requestedItem.split(/\s+/).filter(w => !genericWords.includes(w));
      const specificWords = itemWords.filter(w => !categoryNouns.includes(w));
      const termsToCheck = specificWords.length > 0 ? specificWords : itemWords;
      const existsOnPage = termsToCheck.some(w => catalogTexts.includes(w));
      if (!existsOnPage && termsToCheck.length > 0) {
        return {
          allowed: false,
          error: `Catalog verification failed: "${requestedItem}" is not available in the store catalog on this page.`,
        };
      }
    }
  }
  return { allowed: true };
}

const mockCatalog = ["Ultra ANC Headphones", "Titanium Smartwatch", "Mechanical Keyboard"];

const h1 = verifyCatalogItem("Add 3 flying carpets to my cart", mockCatalog);
assert(!h1.allowed && h1.error.includes("flying carpets"), "Blocks hallucinated purchase of 'flying carpets'");

const h2 = verifyCatalogItem("Buy 1 Rolex Submariner watch", mockCatalog);
assert(!h2.allowed && h2.error.includes("rolex submariner"), "Blocks hallucinated purchase of non-existent 'Rolex Submariner'");

const h3 = verifyCatalogItem("Add 1 Titanium Smartwatch to my cart", mockCatalog);
assert(h3.allowed, "Allows legitimate purchase of 'Titanium Smartwatch' present in catalog");

const h4 = verifyCatalogItem("Add 2 Mechanical Keyboards to cart", mockCatalog);
assert(h4.allowed, "Allows legitimate purchase of 'Mechanical Keyboards' present in catalog");

// -----------------------------------------------------------------------------
// CATEGORY 5: Output Formatting & Robustness to Markdown Fences
// -----------------------------------------------------------------------------
console.log("\n📌 Category 5: Output Formatting & Model Robustness");

const f1 = parseHarnessDecision('```json\n{"tool": "search", "args": {"query": "headphones"}}\n```');
assert(f1.tool === "search" && f1.args.query === "headphones", "Parses JSON wrapped in markdown code fences");

const f2 = parseHarnessDecision('I will search for the smartwatch now.\n{"tool": "search", "args": {"query": "Titanium Smartwatch"}}');
assert(f2.tool === "search" && f2.args.query === "Titanium Smartwatch", "Extracts JSON embedded inside Chain-of-Thought prose");

const f3 = parseHarnessDecision('I have added the Titanium Smartwatch to your cart. Current cart total is $299.99.');
assert(f3.tool === "final" && f3.final.includes("Titanium Smartwatch"), "Correctly identifies pure conversational completion without tools");

console.log("\n======================================================================");
console.log(`📊 BENCHMARK RESULTS: ${passedCount} PASSED, ${failedCount} FAILED (Total: ${passedCount + failedCount})`);
console.log("======================================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
