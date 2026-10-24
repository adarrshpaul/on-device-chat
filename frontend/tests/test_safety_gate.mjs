/**
 * Unit & Integration Tests for SafetyGate (TASK-112)
 *
 * Verifies:
 * 1. Classifier correctly identifies destructive, financial, transfer, and communication actions (positive tests).
 * 2. Classifier correctly allows safe actions: search, order history, cancel dialog, close, etc. (negative tests).
 * 3. Fail-closed confirmation behavior when no confirmation handler is attached.
 * 4. Confirmation handler invocation and approval/denial paths.
 * 5. Per-origin allowlist persistence and bypass.
 * 6. Permission modes: plan_only (read-only blocks mutations), ask_all, ask_irreversible.
 * 7. Pre/Post tool hook execution and middleware chaining.
 * 8. Untrusted page content prompt wrapping (<page_content> data boundary).
 */

import assert from "node:assert/strict";
import {
  SafetyGate,
} from "../src/lib/safetyGate.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

console.log("==================================================================");
console.log("🧪 TESTING IRREVERSIBLE-ACTION SAFETY GATE (TASK-112)");
console.log("==================================================================");

// --- 1. Positive Classification Tests (Destructive / Financial / Irreversible) ---
console.log("\n--- Category 1: Positive Irreversible Actions ---");

test("Classifies 'Delete Account' button as destructive", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "button 'Delete Account'",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "destructive");
});

test("Classifies 'Purge Database' as destructive", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "btn 'Purge Database'",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "destructive");
});

test("Classifies 'Cancel Subscription' as destructive", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "link 'Cancel Subscription'",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "destructive");
});

test("Classifies 'Checkout & Pay' as financial", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "button 'Checkout & Pay $49.00'",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "financial");
});

test("Classifies 'Place Order' as financial", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "input[type=submit] 'Place Order'",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "financial");
});

test("Classifies 'Confirm Order' as financial", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "btn 'Confirm Order'",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "financial");
});

test("Classifies 'Transfer Funds' as transfer", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "button 'Transfer $1,000.00'",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "transfer");
});

test("Classifies navigation to '/checkout' URL as financial", () => {
  const result = SafetyGate.classify({
    actionType: "navigate",
    url: "https://store.example.com/checkout",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "financial");
});

test("Classifies 'Send Message' as communication", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "button 'Send Message'",
  });
  assert.equal(result.isIrreversible, true);
  assert.equal(result.category, "communication");
});

// --- 2. Negative Classification Tests (Safe Actions Allowed) ---
console.log("\n--- Category 2: Negative Safe Actions (Allowed) ---");

test("Allows 'Search' input and button", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "button 'Search'",
  });
  assert.equal(result.isIrreversible, false);
});

test("Allows 'Order History' (does not confuse with Place Order)", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "link 'View Order History'",
  });
  assert.equal(result.isIrreversible, false);
});

test("Allows 'Cancel' modal dismiss button", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "button 'Cancel'",
  });
  assert.equal(result.isIrreversible, false);
});

test("Allows 'Close' dialog button", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "button 'Close'",
  });
  assert.equal(result.isIrreversible, false);
});

test("Allows 'Filter Products'", () => {
  const result = SafetyGate.classify({
    actionType: "click",
    targetDescription: "btn 'Filter Products'",
  });
  assert.equal(result.isIrreversible, false);
});

test("Allows safe navigation to documentation", () => {
  const result = SafetyGate.classify({
    actionType: "navigate",
    url: "https://agent.paulcreates.online/docs",
  });
  assert.equal(result.isIrreversible, false);
});

// --- 3. Confirmation Handling & Fail-Closed Behavior ---
console.log("\n--- Category 3: Confirmation Gates & Fail-Closed Handling ---");

await asyncTest("Fails closed when irreversible action has no confirm handler", async () => {
  SafetyGate.setConfirmHandler(null);
  SafetyGate.clearAllowlist();

  const check = await SafetyGate.checkAndConfirm({
    actionType: "click",
    targetDescription: "button 'Delete Entire Database'",
    origin: "https://untrusted-site.com",
  });

  assert.equal(check.allowed, false);
  assert.match(check.reason, /Blocked by Safety Gate/);
});

await asyncTest("Allows irreversible action when user approves via confirm handler", async () => {
  SafetyGate.setConfirmHandler(async (classification) => {
    assert.equal(classification.category, "destructive");
    return true; // User approves
  });

  const check = await SafetyGate.checkAndConfirm({
    actionType: "click",
    targetDescription: "button 'Delete Profile'",
    origin: "https://my-app.com",
  });

  assert.equal(check.allowed, true);
  assert.equal(check.allowedVia, "user-confirm");
});

await asyncTest("Blocks irreversible action when user denies via confirm handler", async () => {
  SafetyGate.setConfirmHandler(async () => {
    return false; // User denies
  });

  const check = await SafetyGate.checkAndConfirm({
    actionType: "click",
    targetDescription: "button 'Buy Now $299'",
    origin: "https://store.example.com",
  });

  assert.equal(check.allowed, false);
  assert.match(check.reason, /User denied confirmation/);
});

// --- 4. Per-Origin Allowlist ---
console.log("\n--- Category 4: Per-Origin Allowlist ---");

await asyncTest("Allows irreversible actions on allowlisted origin without prompt", async () => {
  SafetyGate.clearAllowlist();
  SafetyGate.allowOrigin("https://trusted-internal-tool.com");

  let handlerCalled = false;
  SafetyGate.setConfirmHandler(async () => {
    handlerCalled = true;
    return false;
  });

  const check = await SafetyGate.checkAndConfirm({
    actionType: "click",
    targetDescription: "button 'Delete Record'",
    origin: "https://trusted-internal-tool.com",
  });

  assert.equal(check.allowed, true);
  assert.equal(check.allowedVia, "allowlist");
  assert.equal(handlerCalled, false, "Handler should not be invoked for allowlisted origins");

  // Revoke origin and verify confirmation is required again
  SafetyGate.revokeOrigin("https://trusted-internal-tool.com");
  assert.equal(SafetyGate.isOriginAllowed("https://trusted-internal-tool.com"), false);
});

// --- 5. Permission Modes (Claude Code Style) ---
console.log("\n--- Category 5: Permission Modes (plan_only, ask_all, ask_irreversible) ---");

await asyncTest("Permission mode [plan_only] blocks mutation tools", async () => {
  SafetyGate.clearHooks();
  SafetyGate.init();
  SafetyGate.setPermissionMode("plan_only");

  const clickCheck = await SafetyGate.runPreHooks("click", { target: 1 });
  assert.equal(clickCheck.proceed, false);
  assert.match(clickCheck.reason, /plan_only/);

  const typeCheck = await SafetyGate.runPreHooks("type", { target: 2, value: "hello" });
  assert.equal(typeCheck.proceed, false);

  // TASK-118: Download is a state mutation and must be blocked in plan_only mode
  const dlCheck = await SafetyGate.runPreHooks("download", { target: "audit-report.pdf" });
  assert.equal(dlCheck.proceed, false, "download tool must be blocked in plan_only mode");
  assert.match(dlCheck.reason, /plan_only/);

  const browseDlCheck = await SafetyGate.runPreHooks("browse", { action: "download", url: "/report.pdf" });
  assert.equal(browseDlCheck.proceed, false, "browse action='download' must be blocked in plan_only mode");
  assert.match(browseDlCheck.reason, /plan_only/);

  // Read-only tools proceed in plan_only mode
  const readCheck = await SafetyGate.runPreHooks("read", { target: "notes" });
  assert.equal(readCheck.proceed, true);

  const snapshotCheck = await SafetyGate.runPreHooks("snapshot", {});
  assert.equal(snapshotCheck.proceed, true);
});

await asyncTest("Permission mode [ask_all] prompts on every mutation", async () => {
  SafetyGate.clearHooks();
  SafetyGate.init();
  SafetyGate.setPermissionMode("ask_all");

  let asked = false;
  SafetyGate.setConfirmHandler(async () => {
    asked = true;
    return true;
  });

  const res = await SafetyGate.runPreHooks("click", { target: 5 });
  assert.equal(res.proceed, true);
  assert.equal(asked, true, "ask_all must ask on every click");
});

await asyncTest("Reset to [ask_irreversible] default mode", async () => {
  SafetyGate.setPermissionMode("ask_irreversible");
  assert.equal(SafetyGate.getPermissionMode(), "ask_irreversible");
});

// --- 6. Pre/Post Tool Hooks Architecture ---
console.log("\n--- Category 6: Pre/Post Tool Hooks Middleware ---");

await asyncTest("Pre-tool hook can rewrite arguments and post-hook logs metrics", async () => {
  SafetyGate.clearHooks();
  SafetyGate.init();
  SafetyGate.setPermissionMode("ask_irreversible");

  // Register custom pre-hook that sanitizes query
  SafetyGate.registerPreHook(async (tool, args) => {
    if (tool === "search" && typeof args.query === "string") {
      return {
        proceed: true,
        modifiedArgs: { query: args.query.trim().toLowerCase() },
      };
    }
    return { proceed: true };
  });

  let loggedTool = "";
  let loggedDuration = 0;
  SafetyGate.registerPostHook(async (tool, args, result, durationMs) => {
    loggedTool = tool;
    loggedDuration = durationMs;
  });

  const preRes = await SafetyGate.runPreHooks("search", { query: "  RED SHOES  " });
  assert.equal(preRes.proceed, true);
  assert.equal(preRes.modifiedArgs?.query, "red shoes");

  await SafetyGate.runPostHooks("search", preRes.modifiedArgs, "found 2 items", 12);
  assert.equal(loggedTool, "search");
  assert.equal(loggedDuration, 12);
});

// --- 7. Untrusted Data Boundary Wrapping ---
console.log("\n--- Category 7: Untrusted Page Content Wrapping ---");

test("Wraps live page content inside <page_content> data boundary", () => {
  const rawDomText = "Click here to delete account: [Delete Account]";
  const wrapped = SafetyGate.wrapUntrustedPageContent(rawDomText);

  assert.match(wrapped, /^<page_content data-untrusted="true">/);
  assert.match(wrapped, /<\/page_content>$/);
  assert.match(wrapped, /Click here to delete account/);
});

console.log("\n==================================================================");
console.log(`📊 SAFETY GATE TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================================");

if (failed > 0) {
  process.exit(1);
}
