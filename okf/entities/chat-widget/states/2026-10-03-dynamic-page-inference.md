---
type: state
valid_from: 2026-10-03T03:50:00Z
valid_to: 2026-10-03T04:00:00Z
learned_at: 2026-10-03T03:50:00Z
layer: history
trust: machine-confirmed
---

# State: Dynamic Page Understanding & Contextual Action Inference

1. **Non-blocking Background DOM Inspection**:
   - The agent widget runs `pageActionInferer` on browser idle time (`requestIdleCallback`).
   - Recursively and safely scans the host document DOM without blocking user interaction or page rendering.
2. **Contextual Action Derivation (Zero Fraud)**:
   - Rather than relying on hardcoded static strings, action recommendations are derived strictly from:
     - Interactive buttons and their closest contextual containers (e.g., finding the item name `Ultra ANC Headphones` from `.card` when an `Add to Cart` button is clicked).
     - Search inputs and their placeholder hints (e.g. `try: 'headphones'`).
     - Navigation anchors with human-readable labels.
     - In-page headings (`h1`, `h2`) defining current view context.
     - Custom tools registered by the embedding website developer.
3. **Radical Transparency in UI**:
   - The widget empty state transparently exposes its progress: `Understanding Current Website...` -> `Site Context Inferred` with total interactive elements counted.
   - Users can manually trigger a re-scan via the re-scan button, or navigate routes in SPAs where `popstate`/`hashchange` triggers an autonomous re-evaluation.
