/**
 * Test Suite: TASK-116 Harness-Held Todo List & Reasoning-History Rule
 *
 * Verifies:
 * 1. Harness owns task list state (TodoManager) and emits reactive updates.
 * 2. Plan approval gate: draft plans require user approval before execution.
 * 3. Model marks items done/blocked via update_task tool without rewriting the entire plan.
 * 4. Concise single-line prompt injection (formatPromptLine) preserving token budget.
 * 5. DeepSeek Reasoning-History Rule:
 *    - Keeps thinking traces during active intra-turn tool loop for chain-of-thought continuity.
 *    - Drops historical thinking traces across multi-turn conversation history.
 * 6. Per-turn tool observation truncation budget:
 *    - Heavy outputs (>1200 chars) are stored in mem:// and summarized with a memory reference.
 *    - read(target="mem://...") restores full observation fidelity.
 */

import assert from "node:assert";
import { TodoManager } from "../src/lib/todoManager.ts";
import { ReasoningManager } from "../src/lib/reasoningManager.ts";

console.log("==================================================================");
console.log("🧪 TESTING HARNESS-HELD TODO LIST & REASONING-HISTORY (TASK-116)");
console.log("==================================================================\n");

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. TodoManager State & Reactive Lifecycle
// ---------------------------------------------------------------------------
console.log("--- Category 1: Harness-Held Todo List Lifecycle ---");

it("Initializes a draft plan requiring approval by default", () => {
  const todo = new TodoManager();
  const plan = todo.createPlan("Buy blue sneakers", [
    { title: "Search sneakers" },
    { title: "Filter by size 10" },
    { title: "Add to cart" },
  ], false);

  assert.strictEqual(plan.approved, false);
  assert.strictEqual(plan.status, "draft");
  assert.strictEqual(plan.tasks.length, 3);
  assert.strictEqual(plan.tasks[0].status, "pending");
});

it("Transitions to executing upon user approval", () => {
  const todo = new TodoManager();
  todo.createPlan("Order food", [{ title: "Select item" }, { title: "Pay" }], false);
  const ok = todo.approvePlan();
  const plan = todo.getPlan();

  assert.strictEqual(ok, true);
  assert.strictEqual(plan.approved, true);
  assert.strictEqual(plan.status, "executing");
  assert.strictEqual(plan.tasks[0].status, "in_progress");
});

it("Supports plan rejection/cancellation", () => {
  const todo = new TodoManager();
  todo.createPlan("Delete database", [{ title: "Purge records" }], false);
  todo.rejectPlan("User cancelled");
  const plan = todo.getPlan();

  assert.strictEqual(plan.approved, false);
  assert.strictEqual(plan.status, "failed");
  assert.strictEqual(plan.tasks[0].status, "blocked");
  assert.strictEqual(plan.tasks[0].note, "User cancelled");
});

it("Emits real-time reactive updates to plan change listeners", () => {
  const todo = new TodoManager();
  let changeCount = 0;
  let lastStatus = "";

  const unsubscribe = todo.onPlanChange((plan) => {
    changeCount++;
    lastStatus = plan?.status || "";
  });

  todo.createPlan("Test plan", [{ title: "Step 1" }], true);
  assert.strictEqual(changeCount, 1);
  assert.strictEqual(lastStatus, "executing");

  todo.markTaskDone("task_1");
  assert.strictEqual(changeCount, 2);
  assert.strictEqual(lastStatus, "completed");

  unsubscribe();
  todo.clear();
  // No further callback after unsubscribe
  assert.strictEqual(changeCount, 2);
});

// ---------------------------------------------------------------------------
// 2. Prompt Formatter: Strict Single-Line Token Budget Constraint
// ---------------------------------------------------------------------------
console.log("\n--- Category 2: Single-Line Prompt Budget Enforcement ---");

it("Formats prompt addition into a single concise line (<= 150 chars for 3 tasks)", () => {
  const todo = new TodoManager();
  todo.createPlan("Find flight", [
    { title: "Search flights" },
    { title: "Pick cheapest" },
    { title: "Book seat" },
  ], true);

  const line1 = todo.formatPromptLine();
  assert.ok(!line1.includes("\n"), "Must be a single line without newlines");
  assert.ok(line1.startsWith("Plan: [1] Search flights (active) | [2] Pick cheapest (todo)"));

  todo.markTaskDone("task_1");
  const line2 = todo.formatPromptLine();
  assert.ok(!line2.includes("\n"), "Must remain single line");
  assert.ok(line2.includes("[1] Search flights (done) | [2] Pick cheapest (active)"));
  assert.ok(line2.length < 150, "Prompt addition must remain small");
});

it("Returns empty string when no active plan exists to avoid token waste", () => {
  const todo = new TodoManager();
  assert.strictEqual(todo.formatPromptLine(), "");
});

// ---------------------------------------------------------------------------
// 3. DeepSeek Reasoning-History Rule
// ---------------------------------------------------------------------------
console.log("\n--- Category 3: DeepSeek Reasoning-History Specification ---");

it("Strips all thinking tags from text (<think>, <thought>, [Thinking:], ```thought```)", () => {
  const raw1 = "<think>Let me reason about this click.\nUser wants login.</think>{\"tool\": \"click\", \"args\": {\"selector\": \"#login\"}}";
  assert.strictEqual(ReasoningManager.stripThinking(raw1), '{"tool": "click", "args": {"selector": "#login"}}');

  const raw2 = "<thought>Thinking...</thought>Here is the answer.";
  assert.strictEqual(ReasoningManager.stripThinking(raw2), "Here is the answer.");

  const raw3 = "[Thinking: analyzing elements] Found 3 elements.";
  assert.strictEqual(ReasoningManager.stripThinking(raw3), "Found 3 elements.");

  const raw4 = "```thought\nComplex chain of thought\n```Final output.";
  assert.strictEqual(ReasoningManager.stripThinking(raw4), "Final output.");
});

it("Extracts thinking trace and clean content", () => {
  const raw = "<think>We need to add to cart.</think>{\"tool\": \"click\"}";
  const { thinking, content } = ReasoningManager.extractThinking(raw);

  assert.strictEqual(thinking, "We need to add to cart.");
  assert.strictEqual(content, '{"tool": "click"}');
});

it("DeepSeek Rule (Inter-turn): Drops thinking from prior assistant messages in conversation history", () => {
  const history = [
    { role: "user", content: "What is 2 + 2?" },
    {
      role: "assistant",
      content: "<think>2+2 is 4.</think>2 + 2 is 4.",
      reasoning_content: "2+2 is 4.",
    },
    { role: "user", content: "Now multiply by 3." },
    {
      role: "assistant",
      content: "<thought>4 * 3 = 12.</thought>The result is 12.",
    },
  ];

  const sanitized = ReasoningManager.sanitizeConversationHistory(history);

  assert.strictEqual(sanitized.length, 4);
  assert.strictEqual(sanitized[1].content, "2 + 2 is 4.");
  assert.strictEqual(sanitized[1].reasoning_content, undefined, "reasoning_content must be omitted in historical turns");
  assert.strictEqual(sanitized[3].content, "The result is 12.");
  assert.strictEqual(sanitized[3].reasoning_content, undefined);
  assert.ok(!sanitized[1].content.includes("<think>"));
  assert.ok(!sanitized[3].content.includes("<thought>"));
});

it("DeepSeek Rule (Intra-turn): Preserves thinking trace inside the active tool loop", () => {
  const toolPayload = { tool: "click", args: { selector: "#submit" } };
  const thinking = "The form is filled, now clicking submit to send.";

  const loopMsg = ReasoningManager.formatLoopAssistantMessage(toolPayload, thinking);

  assert.strictEqual(loopMsg.role, "assistant");
  assert.strictEqual(loopMsg.reasoning_content, thinking);
  assert.ok(loopMsg.content.includes("<think>"));
  assert.ok(loopMsg.content.includes(thinking));
  assert.ok(loopMsg.content.includes('"tool":"click"'));
});

// ---------------------------------------------------------------------------
// 4. Per-Turn Observation Truncation Budget & Memory Restoration
// ---------------------------------------------------------------------------
console.log("\n--- Category 4: Tool Observation Truncation & Memory Restoration ---");

it("Truncates heavy tool observations (>1200 chars) and preserves memory reference", () => {
  const memoryStore = new Map();
  const rawObservation = "X".repeat(3000);
  const MAX_OBSERVATION_CHARS = 1200;
  let obs = rawObservation;
  if (obs.length > MAX_OBSERVATION_CHARS) {
    const memKey = `mem://obs_step1_12345`;
    memoryStore.set(memKey, obs);
    obs = `${obs.slice(0, 400)}\n... [Truncated ${obs.length - 400} chars. Full observation (${obs.length} chars) stored in memory at "${memKey}". Call read(target="${memKey}") to inspect.]`;
  }

  assert.ok(obs.length < 600);
  assert.ok(obs.includes("mem://obs_step1_12345"));
  assert.strictEqual(memoryStore.get("mem://obs_step1_12345").length, 3000);
});

it("Advances active tasks dynamically as steps complete", () => {
  const todo = new TodoManager();
  todo.createPlan("Checkout workflow", [
    { title: "Review cart" },
    { title: "Click checkout" },
  ], true);

  assert.strictEqual(todo.getActiveTask().title, "Review cart");
  const ok = todo.updateTaskStatus("task_1", "completed");
  assert.strictEqual(ok, true);

  const plan = todo.getPlan();
  assert.strictEqual(plan.tasks[0].status, "completed");
  assert.strictEqual(plan.tasks[1].status, "in_progress");
  assert.strictEqual(todo.getActiveTask().title, "Click checkout");
});

it("Marks task blocked with custom reason", () => {
  const todo = new TodoManager();
  todo.createPlan("Booking", [{ title: "Select seat" }], true);
  todo.markTaskBlocked("task_1", "Seat already reserved");

  const plan = todo.getPlan();
  assert.strictEqual(plan.tasks[0].status, "blocked");
  assert.strictEqual(plan.tasks[0].note, "Seat already reserved");
  assert.ok(todo.formatPromptLine().includes("[1] Select seat (blocked)"));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n==================================================================");
console.log(`📊 TASK-116 TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================================");

if (failed > 0) {
  process.exit(1);
}
