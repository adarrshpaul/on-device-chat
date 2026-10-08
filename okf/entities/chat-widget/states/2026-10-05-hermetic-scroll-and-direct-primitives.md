---
type: state
valid_from: 2026-10-05T03:32:00+05:30
learned_at: 2026-10-05T03:32:00+05:30
layer: current
trust: machine-confirmed
---

# State: Hermetic Scroll Isolation, Direct Browser Tool Primitives, and Universal Navigation

1. **Hermetic Host Isolation**:
   - The chat widget employs native non-passive event interception (`addEventListener("wheel", ..., { passive: false })`) on `.g4-window-card`.
   - Wheel and touch gestures anywhere on the widget are fully intercepted and clamped to internal scrollable containers, completely preventing background scroll bleed to the host application.
   - Guarded by CSS containment: `overscroll-behavior-y: contain !important;` and `touch-action: pan-y;`.

2. **First-Class Canonical Browser Tool Primitives**:
   - `DEFAULT_BROWSER_TOOLS` exposes first-class JSON function schemas for direct tools (`click`, `type`, `scroll`, `navigate`, `inspect`, `browse`, `search`, `sandbox`, `read`, `write`, `ask`).
   - The harness decision parser accepts both structured function calls, direct property actions (`{"action": "click"}`), root object keys (`{"click": {"selector": ...}}`), and Astra DSL formats.
   - Probabilistic harness normalizes direct tools and validates DOM selectors without schema rejection penalties.

3. **Associative Engram Navigation & Autonomous Deep Site Overview**:
   - Dynamic page candidate mapping (`mapPageCandidates`) and Site Overview heuristics reconstruct page layouts across 3D canvases, SPAs, and deep web trees.
   - Macro generation captures successful action sequences into IndexedDB for instant 0-token replay.
