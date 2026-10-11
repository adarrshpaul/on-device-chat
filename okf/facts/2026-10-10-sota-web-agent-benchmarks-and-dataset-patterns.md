# SOTA Web Agent Benchmarks & Foundational Dataset Patterns

- **Status**: Validated
- **Date**: 2026-10-10
- **Scope**: On-Device Web Agent Harness (`on-device-chat` / `gemma4-chat-agent`)
- **Verification**: 20/20 Automated SOTA Tests Passing (`tests/test_web_agent_sota_benchmarks.mjs`), Live Cloudflare Deployments

## Architectural Syntheses from Foundational Web Agent Datasets

### 1. Mind2Web (OSU NLP Group) - Canonical DOM Grounding & Event Propagation
- **Core Insight**: Raw DOM serialization causes severe context window bloat and catastrophic failure in small local LLMs.
- **Implementation**:
  - `A11yTreeEngine.scan()` extracts interactive nodes in visual reading order, filtering hidden, disabled, and widget-internal elements.
  - Computes W3C accessible name resolution (aria-label, aria-labelledby, placeholder, title, text).
  - Assigns clean 1-based monotonic integer IDs `[1..N]` for token-compact prompt serialization (<400 tokens per full viewport).
  - `ActionDispatcher.type()` bypasses framework getter/setter wrappers (React 19 / Angular Signals / Vue 3) by accessing the underlying native prototype property descriptor (`HTMLInputElement.prototype` / `HTMLTextAreaElement.prototype`).

### 2. WebArena & VisualWebArena (CMU) - Programmatic Oracle Evaluation & State Transitions
- **Core Insight**: Relying on the LLM itself to judge task success creates self-delusion loops. Benchmarks require deterministic, programmatic environment state verification.
- **Implementation**:
  - `StateDeltaVerifier.captureSnapshot()` captures URL, pathname, hash, DOM focus, active modal count, and body element counts.
  - `StateDeltaVerifier.computeDelta(before, after)` computes observable environment deltas.
  - Replaced naive string signature cycle detection with actual state progression checks: actions that produce legitimate mutations are never prematurely aborted.

### 3. WebVoyager (Tsinghua) - Set-of-Marks (SoM) Dual Modality & Error Recovery
- **Core Insight**: Combining visual bounding boxes/badges with text DOM grounding enables robust multi-modal perception. When actions fail, the agent must accumulate structured error feedback.
- **Implementation**:
  - `SomOverlayManager` injects high-contrast numerical markers directly onto target bounding boxes for visual inspection with zero DOM trace residue on clear.
  - `isFailureObservation()` supervisory feedback loop detects missing targets, zero occurrences, syntax errors, and DOM exceptions, feeding exact failure patterns back into the context accumulator.

### 4. SeeClick / ScreenSpot (NJU) - Resolution-Invariant Coordinate Grounding [0, 1000]
- **Core Insight**: Pixel-space coordinates break across viewports, zoom levels, and device aspect ratios. Normalized `[0, 1000]` coordinates provide resolution-invariant grounding.
- **Implementation**:
  - `ActionDispatcher.clickCoordinates(normX, normY)` projects normalized percentages into client viewport coordinates (`clientX = Math.round((normX / 1000) * vpWidth)`).
  - Dispatches visual centroid click events (`pointerdown -> mousedown -> focus -> pointerup -> mouseup -> click`) to ensure canvas, SVG, and custom interactive targets receive native user-interaction sequences.

### 5. WebShop (Princeton) - E-Commerce Multi-Attribute Constraint Grounding
- **Core Insight**: Real-world e-commerce requires decomposing complex user queries into discrete attributes (e.g., size, color, quantity) and validating options against live catalog DOM.
- **Implementation**:
  - Dynamic catalog validation in `agentHarness.ts` inspects live option pills (`[data-attr]`, `.option-pill`) and rejects hallucinated items or invalid variants before executing purchase actions.

### 6. OSWorld / WorkArena (ServiceNow) - Modal Dialog Trapping & Enterprise Workflow Isolation
- **Core Insight**: In complex enterprise SaaS interfaces, modals, drawers, and nested iframes cause background element drift, where agents click inaccessible background buttons instead of the active dialog.
- **Implementation**:
  - `A11yTreeEngine.scan()` dynamically queries open dialogs (`dialog[open]`, `[role="dialog"]`, `[aria-modal="true"]`, `.modal-open`).
  - Active modal elements are flagged with `inModal: true` and prioritized ahead of background elements in the reading order.
  - Formatted prompt serializes candidate targets inside active dialogs with explicit `[MODAL]` prefix, preventing out-of-focus background misclicks.

## Test & Deployment Verification
- **Automated SOTA Suite**: `npm run test:sota` executed and verified 20/20 assertions across all 6 benchmark domains.
- **CI Pipeline**: Integrated into `npm test` (`giskard`, `numeric grounding`, `vega engine`, `universal harness`, `sota benchmarks`).
- **Production Deployments**:
  - Portfolio App: `https://9697c322.cloudfare-portfolio-app-41v.pages.dev` (`paulcreates.online`)
  - Local Agent Harness: `https://aca1ce37.local-agent-harness.pages.dev` (`agent.paulcreates.online`)
