---
id: fact_openui_and_d3_nano_implementation_and_verification
subject: edgeoperator-openui-and-d3-nano-integration
predicate: typed-component-stream-and-decision-scorer-shipped
valid_from: 2026-10-12T04:40:00Z
valid_to: null
confidence: 1.0
source: test-ui-spec-and-d3-nano-suite-and-npm-test
---

# Fact: OpenUI Typed Component Stream & D3-Nano Scorer Shipped

Successfully integrated and verified Candidate 1 (OpenUI / DIL Typed Component Stream) and Candidate 2 (`vllm-sr/d3-nano` Decision Scorer Architecture):

### 1. Candidate 1 Shipped: OpenUI Typed Component Stream
- **`UISpec` Schema (`types.ts`)**:
  - `confirm`: Action confirmation card bound to live `ElementRef` with repeat count support.
  - `batchPreview`: Data table for 'Teach 1 → Batch N' with individual row checkboxes, select/deselect toggles, and live execution.
  - `paramForm`: Dynamic configuration form with typed inputs (`int`, `enum`, `text`, `boolean`) and parameter boundary validation.
  - `choices`: Interactive alternative options with calibrated decision score pills.
- **Rule 7 & 9 Verification Gate (`UISpecEngine.bindOrDrop`)**:
  - Filters out any spec referencing elements that do not physically exist in the active DOM (`smartQuerySelector` / `A11yTreeEngine`). Phantom or fabricated selectors are dropped.
- **Native 380px Renderer (`UISpecRenderer.tsx`)**:
  - Embedded inside `MessageBubble.tsx` to replace static markdown output with interactive widgets.
  - Executes live browser events via `ActionDispatcher` with real latency metrics measured via `performance.now()`.

### 2. Candidate 2 Shipped: D3-Nano Multimodal Decision Scorer
- **Architecture (`decisionScorer.ts`)**:
  - `VegaOnDeviceScorer`: Fast sub-1ms Hamiltonian dynamics and 64D projection on-device.
  - `D3NanoDecisionScorer`: Models `vllm-sr/d3-nano` System 1 single-forward-pass choice evaluator. Sanitizes candidate payloads (redacting passwords and private inputs). Supports local CoreML or remote vLLM endpoints with high-precision logit scoring.
  - `DecisionScorerRegistry`: Cascades candidate scoring. Fast on-device Vega evaluates first; when margin is tight (`margin < 0.15`), escalates to `d3-nano` to break the tie without token generation latency.
  - **Air-Gap Compliance**: Honors `window.EO_AIRGAP` by blocking unauthorized remote transmissions.

### 3. Verification & Parity
- All 11 automated test suites pass 100% green (`npm test`), including:
  - `test:uispec`: 5/5 real browser tests passed in Chromium.
  - `test:industrial`: 12/12 OT WBM tests passed.
  - `test:consistency`: 3/3 universal isolation tests passed.
  - `test:extension`: 59/59 bit-parity extension sync tests passed.
