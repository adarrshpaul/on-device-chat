---
type: event
entity: chat-widget
timestamp: 2026-10-03T07:55:00Z
learned_at: 2026-10-03T07:55:00Z
source: user-collaboration
trust: verified
---

# Event: Visual Perception Grounding & Conversational Inquiries Fix

## Root Cause Analysis from User Trace
In the user's trace (`can you see ??` and `what do you see ??`):
1. **Action Inference Failure**: When the model emitted `{ "selector": "h1", "prompt": "What is the main heading?" }`, the action property was omitted. The harness defaulted to `snapshot` rather than `see`, returning raw text dumps of interactive selectors.
2. **Conversational Boilerplate Leakage**: When asked `can you see ??`, Gemini Nano outputted prompt preamble ("I am ready to receive your request..."). The parser treated this as `{ final: ... }`, surfacing the boilerplate to the user.
3. **Loop Output Pollution**: Repetitive calls to `#btn-add-watch` terminated via the cycle detector, returning the last observation summary (raw `[selector: "h1"] ...` strings) instead of a natural language visual answer.

## Fixes Implemented
1. **Auto-Route to Vision in `primitiveBrowse`**: If `action` is absent but `prompt` or `question` is provided, automatically routes to `see`. Supported visual aliases: `see`, `look`, `visual`, `ocr`.
2. **Visual Scene Grounding (`VisionService.describeVisualScene`)**: Synthesizes the active viewport hierarchy (page title, headings, catalog items, prices, primary buttons) and queries Gemini Nano with a visual scene grounding prompt to describe what is seen in natural human language without dumping raw CSS selectors.
3. **Visual Query Interceptor**: In `parseHarnessDecision`, if the user asks a visual inquiry (`can you see`, `what do you see`, `describe the page`) and the model emits conversational preamble, intercepts and executes `browse.see`.
4. **Final Selector Purge**: Cleans up any residual `[selector: ...]` text from final messages or cycle detector returns, replacing it with a clean visual scene description.
