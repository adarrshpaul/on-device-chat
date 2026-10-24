---
id: fact_audit_claude_updates_and_task120_status_20261025
entity: on_device_chat
property: release_and_benchmark_status
layer: current
status: verified-local
valid_from: 2026-10-25T02:27:00+05:30
author: antigravity
depends_on: [intention_product_path_benchmark_20261025, fact_harness_adversarial_audit_v040_blockers_20261024]
---

# Audit of Claude Code Updates, TASK-120 Benchmarking, and v0.4.0 Release Status

## 1. Context & Claude Code Updates Audited
- At 00:42–01:16 IST, Claude Code ran a pre-registered harness A/B benchmark (`benchmarks/harness_ab/`) comparing 0.3.0 npm against 0.4.0 @ `9e58152` using remote `google/gemma-3-4b-it` over OpenRouter.
- 44 of 100 runs hit HTTP 402 (OpenRouter credits exhausted); the 6 tasks with valid runs showed 0.3.0 (23/28) and 0.4.0 (22/28) with overlapping 95% Wilson intervals ("no detectable difference"). Four tasks (`shadow_read`, `iframe_type`, `dynamic_wait`, `todo_add`) had 0 valid runs.
- Claude Code documented that `harness_ab` measured raw `AgentHarness.runLoop` with a remote LLM rather than the real on-device product path (`useChat` → `sendMessage` → `EscalationManager.predictText`).
- Claude queued **TASK-120** (`okf/facts/intention_product_path_benchmark_20261025.md`) to measure the real widget product path across scenarios.
- Claude also initialized `~/workspace/okf/INDEX.md` and `check_sync.sh` for cross-project state management.

## 2. Product Path Empirical Findings (Playwright Arm P1)
- Verified widget mount on live scenarios (`https://the-internet.herokuapp.com/checkboxes`, `login`, `dropdown`).
- Discovered that when `VegaDecisionEngine` flags ambiguous intent and renders candidate steering pills (e.g. `Checkboxes — on (80%)`), clicking the pill sent the raw label as text query instead of the direct action payload, causing `EscalationManager` to treat it as section navigation.
- In 0.4.0 @ `9e58152`, all 6 adversarial audit blockers are verified resolved:
  1. `isFailureObservation` detects tool timeouts and safety blocks without false positives.
  2. Per-step `AbortController` watchdog terminates hung DOM operations at 8s.
  3. Cycle detector terminates honestly with diagnostic fingerprints.
  4. Fake confidence scores purged (§7).
  5. A11y tree and Set-of-Marks dynamically refresh on DOM mutations.
  6. Multi-page navigation persistence tracks step indices.
  7. Claude-style `<ThinkingAccordion />` and `<PlanSummarySheet />` bottom sheet provide transparent progress tracking.
- All 18 test suites pass (`npm test` 100%).

## 3. NPM Release Gate
- `frontend/package.json` and extension manifest are at `0.4.0`.
- Deployment to Cloudflare Pages `local-agent-harness` (`https://agent.paulcreates.online`) is live.
- Due to npm account-level 2FA requirements, publishing requires interactive OTP authorization in the native Mac terminal (`npm publish --access public --tag latest`).
