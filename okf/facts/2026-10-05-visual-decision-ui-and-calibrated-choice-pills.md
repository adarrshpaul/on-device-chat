---
fact_id: 2026-10-05-visual-decision-ui-and-calibrated-choice-pills
entity: chat-widget
valid_from: 2026-10-05T13:12:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Visual Decision UI and Calibrated Choice Pills Implementation

## Summary
Integrated TypeSafe/Jev-style structured visual decision making into the local agent chat widget (`DecisionCard.tsx` in `MessageBubble.tsx`). Every routed decision now visually renders calibrated confidence gauges, probability distribution fill bars, and interactive "Pick" pill buttons allowing users to switch execution paths with one click.

## Key Invariants & Features
1. **Calibrated Confidence Meter**:
   - Color-graded confidence badge: Emerald (>85% High Calibration), Amber (65-84% Moderate Calibration), Rose (<65% Ambiguous Gating).
   - Real millisecond latency counter and engine identification (`System 1 Intent Router`, `Laya Calibrated Gate`, `Gemini Nano Native`).
2. **Probability Distribution Fill Bars**:
   - Visual percentage bars representing the calibrated softmax distribution over shortlisted candidates (DOM elements, action tools, navigation targets).
   - Winning candidate highlighted with glowing accent border and `✓ Selected` status.
3. **Interactive Alternative "Pick" Pills**:
   - Evaluated non-winning alternatives render a `Pick ➔` pill button.
   - Clicking `Pick` dispatches the alternative intent through the agent harness immediately, triggering DOM motor actions and spawning a new decision card.
4. **End-to-End Multi-Site Verification**:
   - Verified 100% pass across Portfolio App, 3D Garment Studio, PlayenCash Basketball, and third-party sites via Playwright.
