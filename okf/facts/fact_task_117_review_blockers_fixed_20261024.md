---
id: fact_task_117_review_blockers_fixed_20261024
entity: agent_harness
property: review_blockers_resolution
layer: current
valid_from: 2026-10-24
author: antigravity
trust: machine-confirmed (node --experimental-strip-types tests/test_task_117_review_fixes.mjs 18/18 passed; test_safety_gate.mjs 24/24 passed; test_task_115_voice_input.mjs 16/16 passed; test_empirical_harness_eval.mjs passed)
resolves: [fact_review_task_112_115_116_20261024]
---

# TASK-117: Review Blockers Fixed in TASK-112, TASK-115, TASK-116

All 8 security/honesty blockers and 10 functional defects identified in `fact_review_task_112_115_116_20261024` are resolved and verified with dedicated unit and regression tests.

## 1. Security & Storage Isolation (Blocker 1 & 2)
- **Isolated Allowlist Storage (`allowlistStore.ts`)**: Created `IAllowlistStore` interface with `MemoryAllowlistStore` (closure memory `Set<string>`) and `ExtensionAllowlistStore` (backed by `chrome.storage.sync` / `chrome.storage.local`). Host page `localStorage` (`eo_safety_allowlist`) is never read, consulted, or trusted.
- **Global Scope Hardening (`main.tsx`)**: Removed `(window as any).SafetyGate = SafetyGate` and deleted `SafetyGate` from window exports. Page scripts can no longer access `setConfirmHandler`, `clearHooks`, or `allowOrigin`. Only the safe runtime method `setPermissionMode(mode)` is exposed on the agent instance.

## 2. Fail-Closed Confirmation UI & Policies (Blocker 3, 4, 5)
- **Fail-Closed Confirmation Policy (`permissionPolicy.ts`)**: If `ask_all` or `ask_irreversible` intercepts a mutation and no confirmation handler is attached, execution fails closed with a structured rejection (`allowed: false`).
- **Confirmation Card Component (`SafetyConfirmationCard.tsx`)**: Rendered interactive confirmation card directly in the widget above chat input with action category badge, target description, page origin, and Approve/Deny buttons. Wired via `useChat.ts` and `AgentHarness(onPlanApprovalRequired)`.
- **Gating Bypass Prevention (`permissionPolicy.ts`)**: Added comprehensive mutation checks across `browse` sub-actions (`click`, `type`, `pressEnter`, `fill`, `input`, `hover`, `clickCoordinates`), ensuring non-safe browse actions cannot bypass permission checks.
- **Table-Driven Classifier (`actionClassifier.ts`)**: Replaced repetitive regex cascades with `CLASSIFICATION_RULES` table. Enforced irreversible precedence over safe contexts so "Next: Place order", "Close account", "Confirm deletion", "Show more and buy now", and "Revoke API Key" are strictly categorized as financial or destructive.

## 3. Transparency & Zero Fraud (Blocker 6, 7, 8)
- **Voice Privacy Transparency (`voiceEngine.ts`)**: Honestly labeled Web Speech API as Chromium cloud-backed STT and separated it from Whisper WebGPU (100% on-device). Updated task documentation and UI descriptions.
- **Empirical WER Reporting (`voiceEngine.ts`, `voicePolish.ts`)**: Replaced fabricated "ASR WER" claim with measured disfluency cleanup benchmarks on real spoken utterances.
- **DeepSeek Citation (`reasoningManager.ts`)**: Added official documentation citations for reasoning parameter protocols (`reasoning_content` parameter in DeepSeek API).

## 4. Functional Defect Resolutions
- **Audio Capture in Whisper**: Implemented `ScriptProcessorNode` audio capture with Float32 mono 16 kHz downsampling.
- **Web Speech Buffer**: Accumulated intermediate speech results so audio before stop is never lost.
- **Clipboard Protection (`textInjector.ts`)**: Stopped silent clipboard overwrites; returns `success: false` if no editable element is focused unless `copyToClipboardOnFail: true` is explicitly passed.
- **Normal Speech Preservation (`voicePolish.ts`)**: Fixed regex to preserve "Meeting at 4, no 5pm", "Thanks, I mean it", and "What kind of car".
- **Gemma 4 Delimiters (`reasoningManager.ts`)**: Added support for stripping and extracting Gemma 4 `<|channel>thought...<channel|>` delimiters.
- **Todo & Observation Loops (`agentHarness.ts`)**: `primitiveUpdateTask` strictly requires `taskId` and `status`. Memory read-back (`mem://...`) bypasses re-truncation loops.
