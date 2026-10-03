---
entity: chat-widget
event: visual-query-and-webllm-function-calling-fix
date: 2026-10-03T13:50:00+05:30
author: Antigravity
---

# Visual Query Regex, Placeholder Rejection & WebLLM Function Calling Fix

## Root Cause Analysis for Trace Failures
1. **Visual Inquiry Regex Miss**:
   - Query: `"Describe what is visible on this page in detail."`
   - Previous regex required `describe (the|this) (page|screen)`, missing `describe what is visible...`.
   - Result: MiniLM evaluated it against tools without matching `browse`, and SmolLM2 received it without visual prompting.
2. **MiniLM Primitive Definition**:
   - `browse` description previously only mentioned `Inspect elements, snapshot the webpage DOM, click buttons...`.
   - Updated description to explicitly include `View, see, look at, describe what is visible on this page or screen`.
   - Added automatic `{ action: "see", prompt: query }` argument extraction in `extractArgsFromQuery` when visual words are present.
3. **Placeholder Ellipsis Tool Leakage in SmolLM2**:
   - Small models (SmolLM2-135M) literally generated the template placeholder `{"tool": "..."}`.
   - Hardened `harnessDecisionParser.ts` to strictly reject tools named `...`, `<tool_name>`, or starting with `<`.
   - If user goal was a visual inquiry, automatically falls back to `browse(action="see")`.
4. **WebLLM Function Calling Exception on Gemma**:
   - Error: `[Gemma 4 Error]: gemma-2-2b-it-q4f16_1-MLC is not supported for ChatCompletionRequest.tools`.
   - WebLLM's internal validator only permits the `tools` array for Hermes models.
   - Fixed `engine.ts` to format tool schemas directly into system/user prompts for non-Hermes models and parse structured JSON responses back into `message.tool_calls`.

## Verification
- Extended `tests/giskard_stress_test.mjs` to 26 adversarial tests: **26/26 PASSED (100%)**.
- Full multi-target production build (`npm run build`) succeeded with 0 errors.
