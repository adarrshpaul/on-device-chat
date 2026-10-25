---
id: fact_vega_realtime_guide_telemetry_bridge_20261025
title: Vega System One Real-Time UI Guide Telemetry Tracker & Zero-Token Edge Bridge Implementation
entity: vega_decision_engine
layer: current
valid_from: 2026-10-25T12:43:00+05:30
valid_to: null
author: antigravity
source: user_request_and_recipe_implementation
tags:
  - vega-decision-engine
  - telemetry-tracker
  - real-time-ui-guide
  - edge-bridge
  - zero-token-resolution
  - rule-7-honesty
---

# Vega System One Real-Time UI Guide Telemetry Tracker & Zero-Token Edge Bridge

## 1. Architectural Overview & Recipe Implementation
In response to production requirements for real-time UI guides (<100ms latency ceiling), we implemented the complete 3-step Vega System One architecture connecting browser clients to `nandakishorm/vega-08b-public-intents`:

```
┌─────────────────────────────────┐
│ Browser Client (Web App)        │
│ • TelemetryTracker (<0.001ms)   │
│ • Captures dwell, cursor [x, y] │
└───────────────┬─────────────────┘
                │ HTTP POST /api/vega/route (<50ms budget)
                ▼
┌─────────────────────────────────┐
│ Edge / Container (Python)       │
│ • scripts/vega_edge_service.py  │
│ • Model: vega-08b-public-intents│
│ • Zero generative token overhead│
└───────────────┬─────────────────┘
                │ Directives (SHOW_STEP, START_FLOW, WAIT)
                ▼
┌─────────────────────────────────┐
│ Ambient HUD (VegaGuideOverlay)  │
│ • Pulsating target highlight    │
│ • Floating directional tooltip  │
└─────────────────────────────────┘
```

## 2. Core Implemented Components

### A. Lightweight Web Client Tracker (`frontend/src/lib/telemetryTracker.ts`)
- **Passive Ingestion**: Uses passive event listeners on `mousemove`, `click`, `popstate`, and a 250ms interval dwell evaluator without blocking the 60fps main UI thread.
- **Micro-Interaction Classification**:
  - `hovering_without_clicking`: Dwell $\ge 1200\text{ms}$ over interactive element without action.
  - `idle_on_canvas`: Cursor resting on `<canvas>` without drawing or interaction for $>1000\text{ms}$.
  - `rapid_tab_switching`: $\ge 4$ route oscillations in a 5-second sliding window.
  - `form_validation_stuck`: Focus on `:invalid` form control.
  - `proceeding_normally`: Standard navigation path.
- **Benchmarked Performance**: Evaluated at **0.0003ms per snapshot** (1000 snapshots in 0.31ms), far outperforming the 0.2ms budget.

### B. Zero-Token Edge Decision Bridge (`frontend/src/lib/vegaEdgeBridge.ts`)
- Bridges client telemetry to the edge decision endpoint (`POST /api/vega/route`).
- Evaluates candidate label logits with micro-tuned F1 safety thresholds:
  - `confidence > 0.65` for contextual tooltip cues (`trigger_tooltip_click_chart` $\to$ `SHOW_STEP`).
  - `confidence > 0.85` for friction loop escalation (`escalate_to_interactive_walkthrough` $\to$ `START_FLOW`).
  - Otherwise stays silent (`WAIT`).
- **Rule §7 Honest Fallback Circuit**: If edge endpoint times out (>120ms) or is offline, transparently executes local client reflex rules with honest labeling (`model: "local-reflex-fallback"`).

### C. Production Python Edge Service (`scripts/vega_edge_service.py`)
- Python server providing zero-token intent classification:
  - Imports native `vegaml.load()` or `transformers.pipeline("zero-shot-classification", model="nandakishorm/vega-08b-public-intents")`.
  - Zero token generation overhead: Evaluates label logits to produce exact probability distributions in $<40\text{ms}$.
  - Includes a deterministic dry-run fallback for headless environments lacking GPU weights.

### D. Ambient Viewport HUD Overlay (`frontend/src/components/VegaGuideOverlay.tsx` & `index.css`)
- **Visual Target Highlighting**: Applies `.vega-highlight-target` to the target DOM/Canvas element with an obsidian neo-brutalist pulsating lime/cyan glow (`#D4FF00` $\leftrightarrow$ `#06B6D4`).
- **Floating Directional Tooltips**: Automatically computes screen clearance and anchors an arrow above or below the target coordinates `(x, y)`.
- **Guided Flow Escalation**: Dispatches a slide-up toast offering a 1-click guided walkthrough when users get stuck.

## 3. Verification & Empirical Evidence
- **Dedicated Test Suite**: `frontend/tests/test_vega_realtime_guide.mjs` passed 7/7 tests:
  1. Telemetry snapshot structure validation.
  2. Latency benchmark (0.0003ms/call).
  3. Tooltip threshold gate (confidence > 0.65 $\to$ `SHOW_STEP`).
  4. Escalation threshold gate (confidence > 0.85 $\to$ `START_FLOW`).
  5. Low confidence silence threshold (`WAIT`).
  6. Rule §7 honest fallback labeling (`local-reflex-fallback`).
  7. Python edge service CLI execution and formatting.
- **Full Test Suite**: All 19 frontend test suites passed with 0 failures (`npm test`).
- **Live Production Deployment**:
  - Cloudflare Pages project `local-agent-harness` deployed to `https://agent.paulcreates.online`.
  - Live Playwright verification simulated cursor dwell and verified active pulsating highlight on target button (`live_deployed_vega_telemetry_guide.png`).
