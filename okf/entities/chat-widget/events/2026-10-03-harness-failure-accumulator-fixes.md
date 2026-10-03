---
type: event
timestamp: 2026-10-03T05:01:00Z
entity: chat-widget
---

# Event: 4 Systemic Harness Fixes — Failure Accumulator, Intent Grounding, Selector Quality, Repeat Prevention

Triggered by user-provided trace critique of `"add to cart fadfdas"` (90s, 10 steps, 7 failures, hallucinated smartwatch intent).

## Fix 1: "Admit Failure" System Prompt (agentHarness.ts:390-415)
- Added CRITICAL RULES section to `getHarnessPrompt`:
  - "NEVER invent or hallucinate items that do not exist on the page."
  - "If a search yields 0 results, the item is NOT on this page."
  - "If you cannot find what the user asked for after 1-2 searches, immediately emit `{ "final": ... }`."
  - "Stay strictly on the user's original request. Do NOT substitute different products."
  - "If a tool call fails, do NOT retry the same call."

## Fix 2: Failure Accumulator (agentHarness.ts:570-680)
- Added `consecutiveFailures` counter and `FAILURE_PATTERNS` matcher (`not found`, `0 results`, `error:`, `syntax error`, `failed:`, `does not appear`).
- If 3+ consecutive tool calls produce failure observations, the loop force-terminates with an honest user-facing message.
- On any successful observation, the counter resets to 0.
- When `consecutiveFailures > 0`, the observation feedback includes a `⚠️ Warning` nudging the model to admit failure.

## Fix 3: Failed Call Signature Set (agentHarness.ts:630-660)
- Added `failedCallSignatures: Set<string>` tracking every `tool:args` signature that returned a failure.
- Before executing any tool, the harness checks if that exact signature already failed. If so, it skips execution entirely and tells the model: "This exact call already failed earlier. Try a different approach or admit failure."
- This prevents the `div[class='product-card']` repeated failure pattern.

## Fix 4: Search Returns Actionable CSS Selectors (agentHarness.ts:270-295)
- Updated `primitiveSearch` to return `selector="<clean-css-selector>"` alongside each match using `getCleanElementSelector()`.
- Model can now use the returned selector directly in subsequent `browse.click` or `browse.inspect` calls instead of guessing generic selectors like `h3`.
- Zero-result message now explicitly states: "The term does not appear anywhere on this page."

## Expected Behavioral Change
- `"add to cart fadfdas"` should now terminate in 1-3 steps (~10-15s) instead of 10 steps (90s).
- The agent will search for "fadfdas", get 0 results, and immediately respond: "I could not find 'fadfdas' on this page."
