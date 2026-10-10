# Event: Multi-Model Ensemble Consensus & Autonomous Website Workflows

- **Timestamp:** 2026-10-10T03:55:00Z
- **Entity:** `chat-widget`
- **Type:** Architectural Feature Implementation
- **Version:** `0.1.9`

## Trigger
User requested:
1. "use the most models to create this decision think like jev [keve]" -> Multi-model ensemble non-autoregressive consensus combining all on-device models.
2. "user should always have output to things if a button which on clicks does something" -> Every interactive choice/action button executes live on the DOM and renders verified output telemetry with state deltas.
3. "ability create workflows in a website to do a certain action again and again" -> Website workflow builder, storage, and runner to execute multi-step macros deterministically with 0 tokens.

## Changes Made
1. Created `src/lib/ensembleDecision.ts`: Multi-Model Ensemble Decision (MMED) engine pooling Laya System 1, MiniLM-L6-v2 Router, and System 2 (Gemini Nano / SmolLM2) into a calibrated consensus probability matrix, agreement ratio, and Noul DOM verification gate.
2. Created `src/lib/workflowStore.ts`: Persistent IndexedDB and LocalStorage engine for user-defined and starter website automations (`gemma4_web_workflows`).
3. Created `src/lib/workflowRunner.ts`: Deterministic action execution engine supporting `click`, `scroll`, `teleport`, `type`, `verify`, and `wait`, generating real-time step output and isolated button telemetry.
4. Created `src/components/ActionOutputCard.tsx`: Visual feedback card showing target, status, DOM delta, and duration.
5. Created `src/components/WorkflowStudio.tsx`: Full-featured visual workflow studio with step builder, AI auto-prompt generation, and execution progress.
6. Updated `src/components/DecisionCard.tsx`: Added multi-model ensemble consensus card, direct 1-click `[Run]` buttons, and `[+ Workflow]` bookmarking.
7. Updated `src/components/ChatHeader.tsx`: Added `"workflows"` tab to header and overflow popover menu.
8. Updated `src/components/ChatWidget.tsx`: Added Quick Workflows horizontal thumb bar above composer and wired action callbacks.
9. Added test suite `tests/test_ensemble_and_workflows.mjs` (7/7 tests passed).
10. Built and deployed live to Cloudflare Pages (`https://paulcreates.online` / `https://cce0dd36.cloudfare-portfolio-app-41v.pages.dev`).
