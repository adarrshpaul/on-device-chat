---
fact_id: 2026-10-05-browser-tool-primitives-unification
entity: chat-widget
valid_from: 2026-10-05T03:28:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Universal Browser Tool Primitives Unification

## Summary
The on-device agent harness supports both direct tool calls (`click`, `type`, `scroll`, `navigate`, `inspect`) and unified wrapper calls (`browse`) as first-class declared primitives.

## Invariant Guarantees
1. `executeTool("click", { selector })` directly executes DOM click and highlights the target without throwing "Unknown tool".
2. `DEFAULT_BROWSER_TOOLS` exports standard function schemas for all browser primitives, ensuring function-calling models (Gemini Nano, Gemma 4, WebLLM) receive explicit tool signatures.
3. `parseHarnessDecision()` accepts standard JSON tool calls, OpenAI function calling schemas, DSL notation (`CLICK(...)`), root action keys (`{"click": {...}}`), and nested browse actions.
4. `ProbabilisticHarnessEngine` treats direct action tools as canonical, validating target selectors and DOM grounding without schema penalty.
