---
type: state
valid_from: 2026-10-03T04:02:00Z
valid_to: 2026-10-03T04:05:00Z
learned_at: 2026-10-03T04:02:00Z
layer: history
trust: machine-confirmed
---

# State: Visual In-Page Element Inspection & Agent Spotlight

1. **Native In-Page Element Inspection (`browse` -> `inspect`)**:
   - Rather than guessing textual layout or relying solely on global string searches, the agent executes targeted inspection:
     - Extracts tag, ID, classes, bounding rect dimensions, visibility flag, input value, placeholder, and ARIA roles.
     - Automatically smooth-scrolls the target element into the center of the viewport (`scrollIntoView`).
2. **Visual Agent Spotlight**:
   - Emulates Chrome DevTools Inspect Element directly inside the browser viewport:
     - Renders an ephemeral, high-visibility glowing target boundary (`g4-agent-spotlight`) around inspected, clicked, or typed elements.
     - Displays an interactive HUD badge indicating `<tag#id.class> [width × height]`.
   - Triggers `(window as any).inspect?.(el)` when Chrome DevTools console utilities are open.
3. **Dual Operating Architecture**:
   - In-page Client Widget: Runs native DOM queries, visual overlays, and synthetic interaction events directly inside the web page.
   - Out-of-browser Automation (Playwright MCP): Uses Chrome DevTools Protocol (`DOM.setInspectMode`, `Page.evaluate`) over CDP websocket when run as an external runner.
