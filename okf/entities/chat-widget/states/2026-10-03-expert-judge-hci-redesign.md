---
type: state
valid_from: 2026-10-03T04:20:00Z
valid_to: 2026-10-03T05:01:00Z
learned_at: 2026-10-03T04:20:00Z
layer: history
trust: machine-confirmed
---

# State: Intuitive Chrome AI Expert Judge & Evals Studio

1. **HCI Philosophy & Usability**:
   - The Evals Studio is designed for rapid inspection, transparency, and human-in-the-loop control without confusing statistical artifacts or unclickable elements.
   - Users can audit all unreviewed traces with a single click, audit individual traces on-demand, or inspect the step-by-step primitives executed by the agent.
2. **Quality & Alignment Metrics**:
   - **Audit Pass Rate**: Displays real pass/fail ratios and completion percentages.
   - **Human-AI Alignment Index**: Displays inter-rater reliability via Cohen's Kappa ($\kappa$) when human feedback is available, or honestly states *"Awaiting Ratings"* when unrated.
   - **Learned Site Macros**: Tracks active zero-token compiled macros.
3. **Interactive Trajectory Inspection**:
   - Every trace card displays the user goal, model tier, and verdict badge (`PASS`, `FAIL`, or `Audit with Chrome AI`).
   - Inline `👍` / `👎` buttons allow instant rating directly in the tab.
   - Expandable trajectory inspection displays individual step metrics: step index, tool name (e.g. `browse.click`), execution duration, parameters, and observation results, along with the Chrome AI Judge's detailed rubric scores and qualitative rationale.
4. **Fail-Safe Timeout & Resilient Auditing**:
   - Bounded async execution with `withTimeout`: 800ms availability check, 2500ms session creation, 3000ms prompt evaluation.
   - If Chrome built-in AI is not readily available or stalls, automatically falls back to offline rubric evaluation without locking the UI.
   - Incremental progress updates in batch audit loop guarantee `isJudging` always resets to false.
