# Fact: Chrome DevTools Console Utilities & Console API for Web Agent Harnesses

- **Layer:** Current
- **Entity:** `chat-widget` / `AgentHarness`
- **Source:** Chrome DevTools Official Documentation (`/docs/devtools/console/utilities`, `/docs/devtools/console/api`)

## 1. Console Utilities API (`developer.chrome.com/docs/devtools/console/utilities`)
Convenience functions available exclusively in the Chrome DevTools Console evaluation context:
- **`$(selector [, startNode])` & `$$(selector [, startNode])`**: Query single or all DOM elements. Returns standard DOM references or native arrays (`Array.from(querySelectorAll)`).
- **`$x(xpath [, startNode])`**: Evaluates XPath queries for complex node relationships not easily expressible in CSS selectors.
- **`$0` - `$4`**: Historical references to the last 5 inspected DOM elements or heap objects.
- **`$_`**: Most recently evaluated expression.
- **`inspect(object/function)`**: Opens and highlights the target element in the Elements panel or function in the Sources panel.
- **`getEventListeners(object)`**: Returns all active event listeners attached to a DOM element, enabling agent verification of clickable/interactive handlers.
- **`monitor(fn)` & `monitorEvents(el, ['click', 'input'])`**: Logs function calls with arguments and live DOM event streams to the console.
- **`copy(object)`**: Copies stringified data directly to the user's OS clipboard.
- **`queryObjects(Constructor)`**: Scans the JavaScript heap for all instances created by a specific constructor.

## 2. Console API (`developer.chrome.com/docs/devtools/console/api`)
Native logging and diagnostics API callable from web application code:
- **`console.groupCollapsed(title)` / `console.groupEnd()`**: Organizes multi-step agent trajectories into clean, collapsible hierarchical blocks.
- **`console.table(data [, columns])`**: Formats structured JSON tool calls, arguments, and observations into readable tabular views.
- **`console.time(label)` / `console.timeEnd(label)`**: Measures precise wall-clock latency per agent step or model inference turn.
- **`console.createTask(name)`**: Modern Chromium API that stitches asynchronous call stacks across Promise microtasks and macrotasks.
- **`console.dirxml(node)`**: Renders interactive DOM tree representations in the console.

## 3. Harness Architecture Alignment
- **Spotlight & Inspection:** Connects agent visual spotlighting directly to `inspect(el)` when DevTools is open.
- **Developer Observability:** Agent harness emits structured `console.groupCollapsed` and `console.table` traces for step-by-step telemetry directly in DevTools.
- **DevTools Global Hook:** Exposes `window.__G4_AGENT__` with helpers (`inspectLast()`, `getTraces()`, `evalJudge()`) for instant interactive console evaluation.
