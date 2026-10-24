---
id: fact_v040_stable_adversarial_remediation_and_claude_ui_20261024
entity: on_device_chat
property: stable_v040_release_and_harness_excellence
layer: fact
status: verified
valid_from: 2026-10-24
valid_to: infinity
author: antigravity
trust: empirical unit tests (18/18 suites passed) + cloudflare pages deployment + live curl verification
---

# Fact: v0.4.0 Stable Adversarial Harness Remediation & Claude-Style Progress UI

## 1. Context & Motivation
Following an adversarial audit via Claude Code CLI (`fact_harness_adversarial_audit_v040_blockers_20261024.md`), 6 critical loop blockers were identified that prevented a stable `0.4.0` release. In addition, the user requested matching Claude mobile app's thinking accordion pill (`⏱️ Auditing the byte budget... >`) and expandable `Summary` modal with a connected vertical milestone progress rail.

## 2. Remediated Harness Blockers
1. **Loop Failure Observation (`agentHarness.ts:61`)**:
   - `isFailureObservation` now comprehensively detects `Error executing tool "x": ... timed out`, `Action blocked by Safety Gate: ...`, `click failed`, `hover failed`, `download failed`, `catalog verification failed`, and element not found errors.
   - Refined pattern matching to eliminate false-positive tripping on benign page text (e.g. medical articles with "0 occurrences of adverse effects").
2. **Watchdog Timeout Cancellation**:
   - Wired per-step `AbortController` linked with `this.activeAbortController`.
   - When the 8s watchdog timeout fires in `Promise.race`, `stepAbortController.abort()` immediately cancels active DOM operations and timers, preventing late asynchronous mutations after timeout or user stop.
3. **Architectural Honesty Mandate (Rule §7 Zero Fraud)**:
   - Cycle detector no longer fabricates false-positive successful `final` output after 2 zero-delta calls.
   - It now halts honestly with transparent failure explanation: `"Execution stopped: Action '${decision.tool}' produced zero state change across consecutive attempts. The target element or state transition is unavailable on this page."`
   - Purged all hardcoded synthetic confidence numbers (`0.94`, `0.72`, `0.98`) across `agentHarness.ts` and `escalationManager.ts`. Deterministic rules are marked as 100% exact matches without fake runner-up alternatives, while agent harness decisions report empirical step success ratios (`successfulSteps / totalSteps`).
4. **Dynamic Per-Step Re-Grounding**:
   - If `stateDelta.hasStateChanged` is true following tool execution, the harness calls `A11yTreeEngine.scan({ viewportOnly: true, maxItems: 36 })` and appends fresh numeric IDs directly into the observation for the next step, eliminating stale element references.
5. **Auto Milestone Plan Synthesis & Management**:
   - Implemented `synthesizeMilestones(userGoal)` to automatically decompose goals into verifiable progression milestones.
   - `TodoManager` tracks reactive milestone transitions (`in_progress` -> `completed` -> `blocked`) across ReAct turns.
6. **Safe Navigation Task Resumption**:
   - `NavPersistenceManager` resume now passes `pendingTask` into `runLoop(..., resumeSnapshot)`.
   - Resumed tasks begin from `pendingTask.stepIndex` with restored trajectory and working memory, preventing redundant earlier mutations.

## 3. Claude-Style Progress UI Implementation
1. **`<ThinkingAccordion />`**:
   - Rendered inline during `isLoading` in `ChatWidget` and above assistant responses in `MessageBubble`.
   - Features `Clock` stopwatch icon, live active milestone title, and `ChevronRight` trigger pill.
2. **`<PlanSummarySheet />`**:
   - Slide-up bottom sheet modal titled **"Summary"** with top grab handle and `✕` close button.
   - Connected vertical timeline rail with distinct milestone nodes:
     - `●` Completed (solid neutral/emerald)
     - `◉` Active (pulsing sky-blue with soft glow)
     - `○` Pending (hollow outline)
     - `⚠️` Blocked (warning rose)
   - Real-time empirical telemetry footer: "0 Cloud Egress • 100% On-Device", "61% prompt tokens saved", total duration in milliseconds.

## 4. Verification & Releases
- **Test Suite**: All 18 test suites passing (35/35 Giskard stress tests, 10/10 SafetyGate tests, 4/4 audit regression tests).
- **Version Bump**: Promoted `on-device-chat` and extension to stable `0.4.0`.
- **Cloudflare Pages**: Deployed `frontend/docs` to `local-agent-harness` via `npx wrangler pages deploy`.
- **Domain Verification**:
  - `https://agent.paulcreates.online` -> `<title>EdgeOperator — On-Device AI Agent & Workflow Operator</title>`
  - `https://automation.paulcreates.online` -> `<title>Process Automation Hub — Sovereign Industrial AI & Deterministic Edge Digital Twins</title>`
