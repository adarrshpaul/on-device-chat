---
id: fact_task_112_safety_gate_and_permission_modes_20261024
entity: agent_harness
property: irreversible_action_safety_gate
layer: fact
status: verified
valid_from: 2026-10-24
author: antigravity
trust: machine-confirmed (test_safety_gate.mjs 24/24 passing, full npm test 12/12 passing)
depends_on: [intention_harness_browser_automation_superpowers_20261024, intention_best_harness_techniques_voice_20261024]
---

# TASK-112: Irreversible Action Safety Gate, Permission Modes & Pre/Post Tool Hooks

Implemented and verified in `gemma4-chat-agent` (`on-device-chat`), committed to branch `feat/task-112-safety-gate` (commit `e420661`).

## Implementation Summary
1. **Semantic Action Classification (`frontend/src/lib/safetyGate.ts`)**:
   - Classifies target elements dynamically via tag, innerText, `aria-label`, `title`, `name`, forms, and URL paths into:
     - `financial`: buy, checkout, pay, purchase, place order, subscribe, billing
     - `destructive`: delete, drop, destroy, remove, purge, clear all, erase, cancel subscription
     - `communication`: send email, post message, submit ticket, tweet
     - `transfer`: transfer funds, wire, send money, withdraw
   - Complies with Rule 9: 100% dynamic classification from live DOM attributes, zero hardcoded domain selectors.
   - Ignores safe homonyms: e.g. "Order History", "Filter", "Cancel" (modal close), "Close".

2. **Permission Modes**:
   - `ask_irreversible` (default): Asks user confirmation before mutating/destructive/financial actions.
   - `ask_all`: Prompts for confirmation before EVERY mutating tool action (click, type, navigate).
   - `plan_only`: Read-only mode blocking all mutating tools completely while allowing inspection tools (`see`, `query_dom`, `calculate`).

3. **Pre/Post Tool Hook Middleware**:
   - Deterministic hook pipeline around `executeTool` allowing blocking, argument rewriting, latency metrics, and audit logging.

4. **Fail-Closed & Persistent Allowlist**:
   - Actions requiring confirmation fail-closed if no user confirmation callback is registered.
   - Per-origin allowlist stored in localStorage (`eo_safety_allowlist`) with memory fallback.

5. **Prompt Injection Boundary Wrapping**:
   - `SafetyGate.wrapUntrustedPageContent(text)` encloses live page observations inside `<page_content data-untrusted="true">`.
   - `harnessPrompt.ts` explicitly instructs models that contents within `<page_content>` are passive data and never instructions.

6. **Extension UI Sync**:
   - Extension popup (`popup.html`, `popup.js`, `popup.css`) exposes permission mode selection synced across tabs via `chrome.storage.local`.
