---
type: event
timestamp: 2026-10-03T04:05:00Z
entity: chat-widget
---

# Event: Implemented Fault-Tolerant Selector Resolution and Widget DOM Isolation

- **Root Cause Analysis of `querySelector` Failure**:
  - Model attempted to query `#button.text-[10px].Run Batch Judge` because:
    1. The agent's `snapshot` previously queried all interactive elements on the page without excluding the chat widget itself, exposing the widget's internal button (`Run Batch Judge`).
    2. The snapshot emitted unescaped Tailwind utility classes (`.text-[10px]`) containing brackets, leading the LLM to hallucinate invalid CSS selectors that crashed `document.querySelector` with a `DOMException`.
- **Architectural Solution**:
  - Created `frontend/src/lib/domUtils.ts`:
    - `isWidgetElement`: identifies and isolates all elements belonging to `#gemma4-widget-root`, `.g4-widget-container`, and `#g4-agent-spotlight`.
    - `getCleanElementSelector`: generates valid, copy-pasteable CSS selectors (IDs, names, clean classes), stripping bracketed utility classes.
    - `smartQuerySelector` & `smartQuerySelectorAll`: resilient DOM lookup engine that catches syntax errors, strips invalid Tailwind brackets, and falls back to semantic text/attribute matching without ever throwing fatal `DOMException` errors.
  - Excluded widget elements from `snapshot`, `pageActionInferer`, and selector lookups.
  - Added `data-g4-widget="true"` to `ChatWidget` root.
- **Verification**:
  - Full TypeScript and Vite build passed with code 0.
