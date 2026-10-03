---
type: state
valid_from: 2026-10-03T04:00:00Z
valid_to: 2026-10-03T04:02:00Z
learned_at: 2026-10-03T04:00:00Z
layer: history
trust: machine-confirmed
---

# State: Resilient Primitive Execution & Model Output Normalization

1. **Model Format Decoupling**:
   - Small models (e.g. Gemini Nano) frequently deviate from rigid schema hierarchies. The host harness standardizes all tool outputs:
     - Unwraps root properties (`{ "tool": "search", "query": "..." }`) directly into `args`.
     - Ensures `args` is always a defined, non-null object.
2. **Defensive Primitive Execution**:
   - All 5 primitives (`read`, `write`, `sandbox`, `browse`, `search`, `ask`) accept default empty arguments `args = {}` and never throw unhandled `TypeError` exceptions on missing properties.
3. **Intent-Preserving Search & Host UI Sync**:
   - `search` primitive falls back to parsing quoted targets from the user's root goal when models omit explicit query arguments.
   - When executed, `search` actively syncs with visible search inputs (`#search-input`) on the host page, triggering real DOM `input` and `change` events.
