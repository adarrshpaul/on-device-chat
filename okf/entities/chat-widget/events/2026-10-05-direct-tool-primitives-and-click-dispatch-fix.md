---
event_id: 2026-10-05-direct-tool-primitives-and-click-dispatch-fix
entity: chat-widget
timestamp: 2026-10-05T03:28:00+05:30
author: Antigravity
status: completed
---

# Event: Direct Browser Tool Primitives Declaration and Seamless Click Dispatch

## Root Cause Analysis
Users and models encountered:
`• click: Unknown tool "click". Available primitives: read, write, sandbox, browse, search`
The root cause was architectural asymmetry:
1. Systems and LLMs (trained on standard browser tools, Playwright, computer-use) naturally emit direct action tools such as `{"tool": "click", "args": {"selector": "..."}}` or `{"click": {"selector": "..."}}`.
2. The agent harness previously grouped browser actions inside a nested wrapper (`{"tool": "browse", "args": {"action": "click"}}`), but failed to declare `click`, `type`, `scroll`, `navigate`, and `inspect` as canonical first-class primitives in the tools schema or in the harness execution switch.
3. In `probabilisticHarness.ts`, `canonicalTools` was restricted to `["browse", "search", "read", "write", "sandbox", "ask"]`, rejecting any direct `click` tool with score 0.0.

## Architectural Resolution
1. **Declared Canonical Schemas (`types.ts`)**:
   - Created and exported `DEFAULT_BROWSER_TOOLS` with complete JSON schemas for `click`, `type`, `scroll`, `navigate`, `inspect`, `browse`, `search`, `sandbox`, `read`, `write`, `ask`.
   - Initialized `EscalationManager` and `AgentHarness` with `DEFAULT_BROWSER_TOOLS` so Gemini Nano, WebLLM, and all tiers receive full schemas.
2. **First-Class Dispatch in `agentHarness.ts`**:
   - Added direct cases for `click`, `type`, `scroll`, `navigate`, `inspect`, `snapshot`, `hover`, `extract`, `see`, `overview`, `teleport` to `executeTool()`.
   - Seamlessly routes direct `click` to `primitiveBrowse({ action: "click", ...args })`.
3. **Probabilistic Harness Validation & Normalization (`probabilisticHarness.ts`)**:
   - Expanded `canonicalTools` with `directActionMap`.
   - Normalizes direct tools into unified verification pipeline (DOM grounding, selector check, widget isolation).
4. **Multi-Format Decision Parsing (`harnessDecisionParser.ts`)**:
   - Added Case D (direct action property) and Case E (shorthand root keys like `{"click": {"selector": ...}}`).
5. **System Prompt Alignment (`harnessPrompt.ts`)**:
   - Updated system prompt instructions to explicitly list `click`, `type`, `scroll`, `navigate`, `inspect` alongside `browse`.
