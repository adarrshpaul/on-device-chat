---
type: event
timestamp: 2026-10-03T04:20:00Z
entity: chat-widget
---

# Event: Chrome AI Expert Judge & Evals Studio Intuitive HCI Redesign

- **Problem Addressed**: The initial evals panel overwhelmed the user with statistical artifacts (unrated Cohen's Kappa, hardcoded 100% metrics before human ratings) and raw unclickable "PENDING JUDGE" labels with no interactive way to understand or use the judge.
- **Fixed Metric Truthfulness**: In `frontend/src/lib/expertJudge.ts`, eliminated deceptive default 100% scores when 0 human evaluations are present, honoring Rule 7 (Zero Fraud & Benchmark Integrity). Defaults to honest "Awaiting Ratings" and actual counts.
- **Single-Trace On-Demand Auditing**: In `frontend/src/hooks/useChat.ts`, added `judgeSingleTrace(traceId)` and `rateTrace(traceId, feedback)` so users can audit and rate any execution trace directly from the Evals Studio tab.
- **Intuitive Human-Machine Interaction in ChatWidget.tsx**:
  - Clear header with one-click `Audit All ({unjudgedCount})` action.
  - Expandable *"How does the Expert Judge work?"* guide detailing the 3-step loop (Primitives -> Chrome AI Audit -> Human Alignment & 0-Token Macros).
  - 3 clean, high-signal scorecards: Task Pass Rate, Human-AI Alignment Index, and Learned 0-Token Site Macros.
  - Interactive Action Trace Cards with live status badges (`PASS`, `FAIL`, `Audit with Chrome AI`), direct inline 👍 / 👎 buttons, and expandable step-by-step trajectory inspector showing tool invocations, duration, arguments, observations, and Chrome AI rubric scores.
