---
id: fact_task_116_harness_held_todo_and_reasoning_history_20261024
entity: agent_harness
property: todo_list_and_reasoning_history
layer: fact
status: verified
valid_from: 2026-10-24
author: antigravity
trust: machine-confirmed (test_task_116_todo_and_reasoning.mjs 13/13 passing, npm test 13/13 passing)
depends_on: [intention_best_harness_techniques_voice_20261024, fact_task_112_safety_gate_and_permission_modes_20261024]
---

# TASK-116: Harness-Held Todo List, Plan Approval Gate, DeepSeek Reasoning-History Rule & Observation Budget

Implemented in `gemma4-chat-agent` (`on-device-chat`), committed to branch `feat/task-116-todo-and-reasoning` (commit `2002de2`).

## Verification & Architecture
1. **TodoManager (`todoManager.ts`)**:
   - Harness owns plan state, lifecycle transitions, and reactive synchronization.
   - Small models only emit status transitions via `update_task` without rewriting entire plans.
   - Prompt addition is bounded to a single line (`Plan: [1] ... (done) | [2] ... (active)`).
   - In-chat approval bar allows users to review and approve multi-step plans before mutations occur.

2. **Reasoning-History Rule (`reasoningManager.ts`)**:
   - Verified against DeepSeek official API documentation:
     - Multi-turn tool execution loop preserves intermediate `reasoning_content` and `<think>` blocks.
     - Multi-turn dialogue history across user turns strips historical thinking content from prior assistant messages.

3. **Per-Turn Observation Truncation Budget (`agentHarness.ts`)**:
   - Bounded to `1200` characters per turn. Heavy outputs are offloaded into `mem://` and can be inspected via `read(target="mem://...")`.

4. **Integration**:
   - `ChatWidget.tsx` renders real-time plan checklist cards.
   - 13/13 test suites pass 100% green.
