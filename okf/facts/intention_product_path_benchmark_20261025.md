---
id: intention_product_path_benchmark_20261025
entity: on_device_chat
property: product_path_task_benchmark
layer: intention
status: proposed (queued as TASK-120 for Antigravity)
valid_from: 2026-10-25
author: claude-code
depends_on: [benchmarks/harness_ab (core-loop A/B), PLAN.md.scope-note]
---

# Product-path benchmark: do USERS of 0.4.0 complete tasks more often than users of 0.3.0?

## Why
`benchmarks/harness_ab` calls `AgentHarness.runLoop` directly with a fixed remote LLM (gemma-3-4b-it).
That measures the core loop given a capable model.

The shipped product routes every model call through `EscalationManager.predictText()`:
- regex "system1" shortcuts: theme, scroll, download, site tour, navigation, form synthesis;
- a tier cascade: Gemini Nano → MiniLM router → Vega/Laya heuristics → (WebLLM/SmolLM2).

That path decides what users actually get, and it is untested. Do not claim "0.4.0 is better for users" until this test is done.

## Design (pre-register BEFORE the first run: freeze tasks.json + PLAN.md, record SHA-256)
1. **Versions:** `on-device-chat@0.3.0` (npm tarball) vs `v0.4.0` at commit `9e58152`, built in a clean git worktree. Record the bundle SHA-256.
2. **Entry point = the real product path.**
   - Mount the widget exactly as a site would (`EdgeOperator` init / auto-mount).
   - Send the goal through the same function the chat input uses (`useChat` → `sendMessage`). Do NOT call `runLoop` directly.
   - If the bundle has no test hook, add one in a separate test build. Keep it identical across versions, and document the diff.
3. **Model environments.** Run each as a separate arm and label it clearly; never mix arms:
   - Arm P1 "no-Nano browser" (Playwright Chromium): whatever the cascade picks without Gemini Nano (MiniLM router / Vega / Laya / WebLLM if it loads). Record per run which tier answered each step (`lastDecisionTrace`, `currentTier`).
   - Arm P2 "Chrome with Gemini Nano", if available on this Mac (Chrome with the built-in AI flags/model downloaded). Record the Chrome version and model availability. Skip the arm and say so if it is not available. Do not fake it.
4. **Tasks:** reuse `benchmarks/harness_ab/tasks.json` (same 10 tasks, checkers and sites) so the results are comparable with the core-loop test. Optionally add 3–5 tasks that hit the regex shortcuts (scroll, theme toggle, navigation by section name); report them separately.
5. **Runs:** fresh browser context per run (no IndexedDB/localStorage carry-over), alternating version order, 5 reps × tasks × versions per arm. Timeout 240 s.
6. **Safety gate:** do not auto-approve silently. Either avoid irreversible tasks, or register a logged auto-approve handler identically in both versions and report how many approvals happened.
7. **Scoring** (same as harness_ab):
   - success = page-state checker;
   - false completion = claimed done but the check fails;
   - infra failures excluded but reported.
   Also record the share of steps decided by each tier/shortcut.
8. **Report:** per arm and version, successes/valid with 95% Wilson intervals; per-task paired table; false completions; tier mix. Overlapping intervals → "no detectable difference".

## Honesty constraints
- Model downloads (MiniLM, WebLLM) may fail or be slow in headless mode. Log that as an infra failure with the reason; do not fall back to a remote LLM inside this test.
- No timing claims while other heavy jobs run on the machine.
- Raw per-run traces go into `benchmarks/product_path/runs/`. Only measured numbers go into RESULTS.md, OKF and the README.
- Do not publish 0.4.0 to npm `latest` or update paulcreates.online (still on 0.2.0) based on this test without the user's explicit go-ahead.

## Done when
`benchmarks/product_path/` contains the frozen PLAN.md + tasks + FROZEN.sha256, the runner, raw runs, an analysis script written before results, and RESULTS.md, plus an OKF fact with the numbers and an okf/log.md line.
