---
event_id: 2026-10-05-hermetic-scroll-isolation-and-wheel-trapping
entity: chat-widget
timestamp: 2026-10-05T03:32:00+05:30
author: Antigravity
status: completed
---

# Event: Hermetic Scroll Isolation and Native Wheel Trapping Fix

## Root Cause Analysis
Users reported that scrolling within the chat assistant caused the underlying website to scroll simultaneously:
*"when we scroll chat the website underneath scrolls fix this issue"*

The issue occurred because of two subtle browser behavior mechanisms:
1. **React 18 Passive Event Listener Limitation**:
   React's synthetic `onWheel` and `onTouchMove` props are registered as `{ passive: true }` by default under React 18 event delegation. Calling `e.preventDefault()` inside a React synthetic wheel handler throws a console warning (`"Unable to preventDefault inside passive event listener invocation"`) and fails to halt native event chaining to the root document.
2. **Single-Tick Momentum Delta Cascade**:
   When trackpad momentum or mouse-wheel ticks occur at container boundaries (e.g., reaching top or bottom of chat messages), modern browser engines (Blink/WebKit) cascade residual delta directly to the nearest parent scroll context (`document.documentElement` / `window.scrollY`).
3. **Scroll Target Mismatch**:
   Wheeling over non-scrollable header bars, title bars, or input fields in the widget had no local scroll container to absorb the delta, immediately venting the wheel event to the underlying page.

## Architectural Resolution
1. **Native Direct DOM Event Binding (`ChatWidget.tsx`)**:
   - Attached a direct ref (`cardRef`) to the outer `.g4-window-card` DOM element.
   - Registered native, non-passive event listeners:
     `el.addEventListener("wheel", handleWheel, { passive: false })`
     `el.addEventListener("touchmove", handleTouchMove, { passive: false })`
2. **Deterministic Wheel Trapping & Internal Dispatch**:
   - On every wheel event originating anywhere inside `.g4-window-card`:
     - Calls `e.preventDefault()` and `e.stopPropagation()`.
     - Inspects event path or active pointer location to find the closest internal scrollable container (`overflow-y: auto | scroll`).
     - If a scrollable container exists, updates its scroll position clamped safely within its bounds:
       `target.scrollTop = Math.max(0, Math.min(maxScroll, scrollTop + e.deltaY))`
     - If no scrollable container is under pointer (e.g. over header or action pills), the event is silently absorbed with 0 delta emitted to host.
3. **CSS Containment Hardening (`index.css`)**:
   - Added `overscroll-behavior: contain !important;`, `overscroll-behavior-y: contain !important;`, and `touch-action: pan-y;` to `.g4-window-card`, `.g4-messages-container`, and any scrollable container.
   - Added `touch-none` to drag handles and headers.
4. **Automated End-to-End Verification (`test_scroll_isolation.mjs`)**:
   - Validated in Playwright against `http://127.0.0.1:4300/`:
     - Header wheeling: Host `window.scrollY` remained `0px`.
     - Input bar wheeling: Host `window.scrollY` remained `0px`.
     - Boundary top/bottom momentum swipes: Host `window.scrollY` remained `0px`.
     - Internal messages scrolled smoothly from top to bottom.
