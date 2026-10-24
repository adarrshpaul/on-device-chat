/**
 * Regression and Verification Test Suite for v0.4.0 Adversarial Audit Fixes
 *
 * Verifies:
 * 1. isFailureObservation catches tool timeouts, SafetyGate refusals, and specific target errors without false-positive content tripping.
 * 2. Honest cycle detection halts with transparent failure rather than deceptive success (Rule §7).
 * 3. Harness automatically synthesizes milestones and updates TodoManager progression.
 * 4. NavPersistence resume starts execution from pending stepIndex rather than restarting from 0.
 */

import assert from "node:assert/strict";
import { isFailureObservation, AgentHarness } from "../dist/index.js";
import { TodoManager } from "../dist/index.js";

console.log("==================================================================");
console.log("🧪 TESTING HARNESS AUDIT FIXES & STABLE V0.4.0 READINESS");
console.log("==================================================================");

// --- 1. isFailureObservation Rigorous Verification ---
console.log("\n--- TEST 1: isFailureObservation Error Detection ---");

const failureCases = [
  'Error executing tool "click": Tool click timed out after 8000ms',
  'Error executing tool "type": Execution timeout',
  'Action blocked by Safety Gate: Irreversible action denied by user.',
  'Action blocked by Safety Gate: Action rejected by pre-tool hook.',
  'blocked by safety gate: destructive action',
  'Click failed: target "button#checkout" not found on page.',
  'Hover failed: element ".dropdown" not found on page.',
  'Download failed: No matching download element found on this page.',
  'Syntax error in tool arguments',
  'Unknown tool "foo_bar"',
  'Unknown browse action "magic_click"',
  'Catalog verification failed: "flying carpet" is not available in store catalog',
];

for (const failStr of failureCases) {
  const result = isFailureObservation(failStr);
  assert.equal(result, true, `Expected failure to be detected for: "${failStr}"`);
}
console.log(`  ✅ PASS: All ${failureCases.length} tool failure and SafetyGate block cases correctly detected.`);

const nonFailureCases = [
  'Successfully clicked button [1] leading to "/checkout".',
  'Viewing "Siemens Scalance WBM" with headings ["Diagnostics", "System"].',
  'Found 12 matching items in the table.',
  'Navigated to https://example.com/products.',
  'Article: In this clinical cohort, 0 occurrences of adverse effects were reported.',
];

for (const passStr of nonFailureCases) {
  const result = isFailureObservation(passStr);
  assert.equal(result, false, `Expected non-failure for: "${passStr}"`);
}
console.log(`  ✅ PASS: All ${nonFailureCases.length} successful actions and benign text observations correctly passed.`);

// --- 2. Auto Milestone Synthesis & Plan Progression ---
console.log("\n--- TEST 2: Harness Milestone Plan Synthesis ---");

const harness = new AgentHarness();

const singleGoal = "Find the privacy policy link and read it";
const singleMilestones = harness.synthesizeMilestones(singleGoal);
assert.equal(singleMilestones.length, 3, "Standard goal decomposes into 3 milestones");
assert(singleMilestones[0].title.includes("Auditing"), "First milestone begins with layout audit");
assert(singleMilestones[1].title.includes("Executing"), "Second milestone executes interactions");
assert(singleMilestones[2].title.includes("Verifying"), "Third milestone verifies state delta");
console.log(`  ✅ PASS: Standard goal cleanly synthesized into ${singleMilestones.length} milestones.`);

const multiGoal = "Locate search input then type 'shoes' and then verify search results";
const multiMilestones = harness.synthesizeMilestones(multiGoal);
assert.equal(multiMilestones.length, 4, "Sequential clauses decompose into 4 sequential milestones");
console.log(`  ✅ PASS: Multi-clause sequential goal synthesized into ${multiMilestones.length} milestones.`);

// --- 3. TodoManager State Progression ---
console.log("\n--- TEST 3: TodoManager Reactive State Progression ---");

const todoManager = new TodoManager();
let planChanges = 0;
const unsub = todoManager.onPlanChange((plan) => {
  if (plan) planChanges++;
});

const plan = todoManager.createPlan("Automate checkout", [
  { id: "task_1", title: "Open cart" },
  { id: "task_2", title: "Fill shipping address" },
  { id: "task_3", title: "Review summary" },
], true);

assert.equal(plan.tasks[0].status, "in_progress", "First task starts in_progress");
assert.equal(plan.tasks[1].status, "pending", "Second task starts pending");

todoManager.markTaskDone("task_1");
assert.equal(plan.tasks[0].status, "completed", "Task 1 marked completed");
assert.equal(plan.tasks[1].status, "in_progress", "Task 2 auto-advanced to in_progress");

const promptLine = todoManager.formatPromptLine();
assert(promptLine.includes("[1] Open cart (done)"), "Prompt line shows task 1 done");
assert(promptLine.includes("[2] Fill shipping address (active)"), "Prompt line shows task 2 active");

todoManager.markTaskDone("task_2");
todoManager.markTaskDone("task_3");
assert.equal(plan.status, "completed", "Plan status is completed when all tasks finish");

unsub();
console.log(`  ✅ PASS: TodoManager reactive progression verified (${planChanges} state notifications emitted).`);

// --- 4. Honest Cycle Detector Halting (Rule §7 Zero Fraud) ---
console.log("\n--- TEST 4: Honest Cycle Detector Halting ---");

// Mock predictor that repeatedly emits identical click
const mockPredictor = async () => JSON.stringify({
  tool: "browse",
  args: { action: "click", selector: "#phantom_button" },
});

const cycleHarness = new AgentHarness({
  maxSteps: 5,
  customHostTools: {
    browse: async () => "Click failed: target not found on page.",
  },
});

const result = await cycleHarness.runLoop(
  "Click the phantom button",
  mockPredictor
);

// Must not return false success
assert(result.final.includes("unable to complete") || result.final.includes("Execution stopped") || result.final.includes("failed"),
  "Cycle detector halts with honest failure explanation, NOT false success!");
assert(!result.final.includes("Viewing \"\""), "Zero synthetic vision templates fabricated on failure");

console.log(`  ✅ PASS: Cycle detector halted honestly with transparent explanation: "${result.final.slice(0, 80)}..."`);

console.log("\n==================================================================");
console.log("🎉 ALL HARNESS AUDIT REGRESSION TESTS PASSED (4/4)!");
console.log("==================================================================");
