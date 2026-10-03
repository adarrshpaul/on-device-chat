---
type: event
timestamp: 2026-10-03T04:00:00Z
entity: chat-widget
---

# Event: Fixed Search Tool Null Exception and Hardened Tool Argument Parsing

- **Root Cause Analysis**:
  - Small on-device LLMs (Chrome Gemini Nano / MiniLM / SmolLM2) occasionally emitted tool calls without an `args` wrapper (e.g. `{ "tool": "search", "query": "headphones" }` or bare `{ "tool": "search" }`).
  - In `AgentHarness.parseHarnessDecision`, `parsed` was returned directly when `parsed.tool` existed, resulting in `decision.args = undefined`.
  - `executeTool` subsequently called `primitiveSearch(undefined)`, where `args.query` threw `TypeError: Cannot read properties of undefined (reading 'query')`.
- **Resolution**:
  - Implemented `normalize` helper in `parseHarnessDecision` to safely map root-level properties into `args` and guarantee `args` is always a valid object.
  - Added default parameter values `args: Record<string, unknown> = {}` across all 5 primitives (`read`, `write`, `sandbox`, `browse`, `search`, `ask`) and `executeTool`.
  - Made `primitiveSearch` robust: reads `query`, `q`, `keyword`, `text`, or regex-extracts quoted substrings from `currentUserGoal`.
  - Enhanced `primitiveSearch` to automatically find and populate in-page search inputs (e.g. `#search-input`) and dispatch `input`/`change` events to synchronize host application state.
- **Verification**:
  - `npm run build` completed with zero TypeScript errors.
  - Dev server confirmed running and responsive.
