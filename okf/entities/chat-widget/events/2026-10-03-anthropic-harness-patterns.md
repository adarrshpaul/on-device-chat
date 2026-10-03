---
type: event
timestamp: 2026-10-03T05:13:00Z
entity: chat-widget
---

# Event: Anthropic Long-Running Harness Design Integration

Integrated two core patterns from Anthropic's "Harness design for long-running application development":

1. **Sprint Contract (Done-Condition Protocol) in System Prompt (`agentHarness.ts`)**:
   - Explicitly instructs the model to identify the observable "Done" condition (e.g., cart count incremented, route navigated, element visible) before acting.
   - Mandates that as soon as that condition is met, the agent stops immediately and emits `final` rather than taking extra unrequested steps.

2. **Evaluator Hard-Threshold Principle & Anti-Leniency (`expertJudge.ts`)**:
   - Enforces Anthropic's finding: If either `taskCompletion` or `safetyDiscipline` fails, the overall verdict is strictly `FAIL` and the score is capped at 40 max.
   - Updated the offline rubric engine to detect explicit failure signals (`maximum step limit`, `unable to complete`, `could not find`, `failed`, `error`), ensuring failing runs are never marked `PASS`.

## Verification
- Rebuilt frontend with `npm run build` (exit code 0).
- Live dev server active at `http://localhost:5173/`.
