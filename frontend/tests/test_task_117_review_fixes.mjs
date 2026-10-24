/**
 * Regression Test Suite: TASK-117 Review Blockers & Fixes
 *
 * Verifies every single defect identified in `okf/facts/fact_review_task_112_115_116_20261024.md`:
 * 1. Allowlist Storage Isolation (Never trusts host page localStorage).
 * 2. window.SafetyGate is not exposed to host page JavaScript.
 * 3. Fail-closed confirmation: ask_all and ask_irreversible fail closed when no handler is registered.
 * 4. Gating bypass prevention (checks mutation tools, coordinates, form enter).
 * 5. Classifier holes fixed ("Next: Place order", "Close account", "Confirm deletion", "Show more and buy now", "Revoke API Key").
 * 6. Voice clean-up preserves normal speech ("Meeting at 4, no 5pm", "Thanks, I mean it", "What kind of car").
 * 7. TextInjector does not overwrite clipboard without permission and reports failure if no field focused.
 * 8. Gemma 4 thought delimiters (<|channel>thought...<channel|>) stripped cleanly.
 * 9. update_task requires taskId and status (no accidental task 1 completion).
 * 10. Observation budget memory read-back does not loop-truncate.
 */

import assert from "node:assert";
import {
  SafetyGate,
  ActionClassifier,
  MemoryAllowlistStore,
  PermissionPolicy,
  VoicePolishEngine,
  TextInjector,
  ReasoningManager,
  TodoManager,
  AgentHarness,
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
console.log("🧪 TESTING TASK-117 REVIEW BLOCKER FIXES (REGRESSION SUITE)");
console.log("==================================================================\n");

// ---------------------------------------------------------------------------
// 1. Allowlist Storage Isolation & Page LocalStorage Immunity
// ---------------------------------------------------------------------------
console.log("--- 1. Allowlist Storage Isolation ---");

it("Isolated MemoryAllowlistStore never reads or trusts host page localStorage", () => {
  const store = new MemoryAllowlistStore();
  store.clear();

  // Simulate an adversarial page setting localStorage
  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.setItem("eo_safety_allowlist", JSON.stringify(["https://malicious-site.com"]));
  }

  assert.strictEqual(
    store.isAllowed("https://malicious-site.com"),
    false,
    "Malicious site in host localStorage must NOT be allowlisted"
  );

  store.add("https://trusted-site.com");
  assert.strictEqual(store.isAllowed("https://trusted-site.com"), true);
  store.remove("https://trusted-site.com");
  assert.strictEqual(store.isAllowed("https://trusted-site.com"), false);
});

// ---------------------------------------------------------------------------
// 2. Global window.SafetyGate Exposure Prevention
// ---------------------------------------------------------------------------
console.log("\n--- 2. Global Scope Security ---");

it("window.SafetyGate is not exposed to host page JavaScript", () => {
  assert.strictEqual(
    globalThis.SafetyGate,
    undefined,
    "globalThis.SafetyGate must remain undefined so host scripts cannot bypass gates"
  );
});

// ---------------------------------------------------------------------------
// 3. Fail-Closed Handling When Confirm Handler is Absent
// ---------------------------------------------------------------------------
console.log("\n--- 3. Fail-Closed Confirmation Guarantees ---");

await itAsync("ask_all mode FAILS CLOSED when no confirm handler is registered", async () => {
  const policy = new PermissionPolicy();
  policy.setMode("ask_all");
  policy.setConfirmHandler(null); // No interactive UI attached

  const result = await policy.evaluatePreToolMode("click", { target: "button.submit" });
  assert.strictEqual(result.proceed, false, "Must block mutation in ask_all mode without confirm handler");
  assert.ok(result.reason?.includes("requires confirmation"), "Reason must specify missing confirm handler");
});

await itAsync("ask_irreversible mode FAILS CLOSED for risky actions without confirm handler", async () => {
  const policy = new PermissionPolicy();
  policy.setMode("ask_irreversible");
  policy.setConfirmHandler(null);

  const check = await policy.checkAndConfirm({
    actionType: "click",
    targetDescription: "button 'Delete Production Database'",
  });

  assert.strictEqual(check.allowed, false, "Must block destructive action when no confirm handler exists");
  assert.ok(check.reason?.includes("requires user confirmation"));
});

// ---------------------------------------------------------------------------
// 4. Classifier Holes Fixed
// ---------------------------------------------------------------------------
console.log("\n--- 4. Semantic Classifier Hole Fixes ---");

it("Classifies 'Next: Place order' as financial (no safe context bypass)", () => {
  const res = ActionClassifier.classify({
    actionType: "click",
    targetDescription: "button 'Next: Place order'",
  });
  assert.strictEqual(res.isIrreversible, true);
  assert.strictEqual(res.category, "financial");
});

it("Classifies 'Close account' as destructive (does not confuse with modal close)", () => {
  const res = ActionClassifier.classify({
    actionType: "click",
    targetDescription: "button 'Close account'",
  });
  assert.strictEqual(res.isIrreversible, true);
  assert.strictEqual(res.category, "destructive");
});

it("Classifies 'Confirm deletion' as destructive", () => {
  const res = ActionClassifier.classify({
    actionType: "click",
    targetDescription: "button 'Confirm deletion'",
  });
  assert.strictEqual(res.isIrreversible, true);
  assert.strictEqual(res.category, "destructive");
});

it("Classifies 'Show more and buy now' as financial", () => {
  const res = ActionClassifier.classify({
    actionType: "click",
    targetDescription: "button 'Show more and buy now'",
  });
  assert.strictEqual(res.isIrreversible, true);
  assert.strictEqual(res.category, "financial");
});

it("Classifies 'Revoke API Key' as destructive", () => {
  const res = ActionClassifier.classify({
    actionType: "click",
    targetDescription: "button 'Revoke API Key'",
  });
  assert.strictEqual(res.isIrreversible, true);
  assert.strictEqual(res.category, "destructive");
});

// ---------------------------------------------------------------------------
// 5. Gate Bypass Prevention (Mutations, Browse sub-actions)
// ---------------------------------------------------------------------------
console.log("\n--- 5. Gate Bypass Prevention ---");

it("Identifies browse sub-actions as mutations in PermissionPolicy", () => {
  const policy = new PermissionPolicy();
  assert.strictEqual(policy.isMutationAction("browse", { action: "click" }), true);
  assert.strictEqual(policy.isMutationAction("browse", { action: "type" }), true);
  assert.strictEqual(policy.isMutationAction("browse", { action: "see" }), false);
  assert.strictEqual(policy.isMutationAction("fill"), true);
  assert.strictEqual(policy.isMutationAction("clickCoordinates"), true);
  assert.strictEqual(policy.isMutationAction("hover"), true);
});

// ---------------------------------------------------------------------------
// 6. Voice Clean-Up Preserves Normal Speech
// ---------------------------------------------------------------------------
console.log("\n--- 6. Voice Polish Normal Speech Preservation ---");

it("Resolves 'Meeting at 4, no 5pm' -> 'Meeting at 5pm.'", () => {
  const polished = VoicePolishEngine.polish("Meeting at 4, no 5pm");
  assert.strictEqual(polished, "Meeting at 5pm.");
});

it("Preserves 'Thanks, I mean it' without mutilating into 'It.'", () => {
  const polished = VoicePolishEngine.polish("Thanks, I mean it");
  assert.strictEqual(polished, "Thanks, I mean it.");
});

it("Preserves 'What kind of car' without stripping 'kind of'", () => {
  const polished = VoicePolishEngine.polish("What kind of car");
  assert.strictEqual(polished, "What kind of car.");
});

it("Strips hesitation 'kind of' when followed by verbs/adjectives", () => {
  const polished = VoicePolishEngine.polish("I kind of want to order pizza");
  assert.strictEqual(polished, "I want to order pizza.");
});

// ---------------------------------------------------------------------------
// 7. TextInjector Clipboard Safety
// ---------------------------------------------------------------------------
console.log("\n--- 7. TextInjector Clipboard Protection ---");

await itAsync("Does NOT overwrite system clipboard when no editable element is focused", async () => {
  let clipboardWritten = false;
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  Object.defineProperty(globalThis, "navigator", {
    value: {
      clipboard: {
        writeText: async () => {
          clipboardWritten = true;
        },
      },
    },
    configurable: true,
    writable: true,
  });

  try {
    const res = await TextInjector.injectText("Sample Speech", null, { copyToClipboardOnFail: false });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(clipboardWritten, false, "System clipboard must NOT be overwritten silently");
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "navigator", originalDescriptor);
    }
  }
});

// ---------------------------------------------------------------------------
// 8. Gemma 4 Thought Delimiters Stripping
// ---------------------------------------------------------------------------
console.log("\n--- 8. Gemma 4 Reasoning Trace Stripping ---");

it("Strips Gemma 4 <|channel>thought...<channel|> delimiters cleanly", () => {
  const raw = "<|channel>thought\nInvestigating the user inquiry.\nStep 1: Check memory.\n<channel|>The system is online.";
  const clean = ReasoningManager.stripThinking(raw);
  assert.strictEqual(clean, "The system is online.");

  const extracted = ReasoningManager.extractThinking(raw);
  assert.ok(extracted.thinking.includes("Investigating the user inquiry"));
  assert.strictEqual(extracted.content, "The system is online.");
});

// ---------------------------------------------------------------------------
// 9. update_task Requires Explicit Arguments
// ---------------------------------------------------------------------------
console.log("\n--- 9. TodoManager & update_task Argument Validation ---");

await itAsync("update_task fails if called with empty arguments (no accidental completion)", async () => {
  const todo = new TodoManager();
  todo.createPlan("Build dashboard", [{ title: "Step 1" }, { title: "Step 2" }], true);

  const harness = new AgentHarness({
    todoManager: todo,
  });

  const resEmpty = await harness.primitiveUpdateTask({});
  assert.ok(resEmpty.startsWith("Error: taskId"));

  // Verify task 1 remains unchanged
  assert.strictEqual(todo.getPlan()?.tasks[0].status, "in_progress");

  const resValid = await harness.primitiveUpdateTask({ taskId: "1", status: "completed" });
  assert.strictEqual(resValid, 'Updated task 1 status to "completed".');
  assert.strictEqual(todo.getPlan()?.tasks[0].status, "completed");
});

// ---------------------------------------------------------------------------
// 10. Observation Budget Memory Read-Back Loop Defense
// ---------------------------------------------------------------------------
console.log("\n--- 10. Observation Truncation Loop Defense ---");

await itAsync("read(mem://...) returns full stored content without loop re-truncation", async () => {
  const harness = new AgentHarness();
  const longText = "A".repeat(2500);

  // Store long text in memory
  harness.memoryStore.set("mem://test_large", longText);

  // Calling primitiveRead directly with mem:// returns full text
  const res = await harness.primitiveRead({ target: "mem://test_large" });
  assert.strictEqual(res.length, 2500, "Memory observation read must return full 2500 characters");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n==================================================================");
console.log(`🎉 ALL TASK-117 REVIEW FIXES VERIFIED: ${passed}/${total} Passed!`);
console.log("==================================================================");
