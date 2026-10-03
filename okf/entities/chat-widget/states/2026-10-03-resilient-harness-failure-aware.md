---
type: state
valid_from: 2026-10-03T05:01:00Z
valid_to: 2026-10-03T07:15:00Z
learned_at: 2026-10-03T05:01:00Z
layer: history
trust: machine-confirmed
---

# State: Resilient Agent Harness with Failure-Aware Loop Control

1. **Admit-Failure System Prompt**: The harness system prompt explicitly instructs the model to never hallucinate items, stay on the user's original request, and immediately emit `{ "final": ... }` when searches yield 0 results instead of inventing alternative products.
2. **Failure Accumulator (3-Strike Rule)**: Tracks `consecutiveFailures` against pattern-matched failure observations (`not found`, `0 results`, `error:`, `syntax error`, `failed:`, `does not appear`). If 3+ consecutive tool calls fail, the loop force-terminates with an honest user-facing explanation. Resets on any success.
3. **Failed Call Signature Set**: A `Set<string>` records every `tool:args` signature that produced a failure. Before executing any tool, the harness checks this set and skips duplicate failed calls instantly, telling the model to try a different approach.
4. **Search Returns Actionable Selectors**: `primitiveSearch` now returns `selector="<clean-css-selector>"` alongside text matches via `getCleanElementSelector()`, so the model can target elements precisely without guessing generic selectors.
5. **Enriched Observation Feedback**: When `consecutiveFailures > 0`, tool result messages include a `⚠️ Warning` explicitly nudging the model to admit failure rather than drift to unrelated approaches.
6. **Max-Step Trace Logging**: When the step cap is hit, the trace is now logged to the Expert Judge dataset for later audit, rather than being silently discarded.
