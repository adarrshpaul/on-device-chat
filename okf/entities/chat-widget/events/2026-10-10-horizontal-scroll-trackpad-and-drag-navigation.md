# Event: Workflows Strip Horizontal Scrolling via Trackpad, Wheel & Drag Navigation

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Type:** bug_fix
- **Trigger:** User reported workflows bar was not horizontally scrollable with trackpad.

## Context & Root Causes
1. **Wheel Event Hijacking in Scroll Isolation:** `ChatWidget.tsx` contained a global window `handleWheel` listener on `cardRef` intended to prevent scroll-bleed to the parent page. However, it unconditionally intercepted all wheel events (`e.preventDefault()`, `e.stopPropagation()`) and strictly routed them to vertical scroll containers (`.g4-messages-container`, `.overflow-y-auto`). Horizontal containers (`overflow-x-auto`) were completely ignored, preventing native trackpad horizontal wheel events (`deltaX`) and vertical flicks (`deltaY`) from panning the workflows bar.
2. **Restrictive CSS `touch-action`:** `.g4-window-card` was styled with `touch-action: pan-y;`, explicitly forbidding horizontal pan gestures from being recognized by browser gesture engines.
3. **Missing Trackpad Wheel & Drag Handling:** Standard horizontal strips in desktop browsers do not convert vertical wheel deltas (`deltaY`) into horizontal scroll (`scrollLeft`) unless an explicit wheel listener is attached, forcing trackpad users to execute awkward two-finger horizontal swipes.

## Implementation Details
1. **Bi-Directional Scroll Isolation Routing (`ChatWidget.tsx`):**
   - Added `findHorizontalContainer` to discover ancestor elements with `overflow-x-auto`, `overflow-x-scroll`, `.g4-workflows-scroll`, or `.no-scrollbar`.
   - Updated `handleWheel` to route horizontal gestures (`deltaX`) and hovering wheel gestures (`deltaY`) to the targeted horizontal container before falling back to vertical scroll.
   - Updated `handleTouchMove` to permit touch panning over horizontal scroll containers.
2. **Pinned Label & Overflow Chevrons:**
   - Decoupled `⚡ Workflows:` into a pinned label docked on the left so it remains permanently in view.
   - Added dynamic left (`<`) and right (`>`) scroll chevrons that activate when overflow is detected (`canScrollWfLeft`, `canScrollWfRight`).
3. **Trackpad Wheel Translation & Drag-to-Scroll:**
   - Attached `onWheel` directly to `workflowsScrollRef` to translate vertical wheel movement to `scrollLeft`.
   - Added mouse/pointer drag-to-scroll with `cursor-grab active:cursor-grabbing` and accidental click suppression when dragged.
4. **CSS Pan Freedom (`index.css`):**
   - Upgraded `.g4-window-card` to `touch-action: pan-x pan-y;` and `overscroll-behavior-x: contain;`.
   - Added cross-browser `.no-scrollbar` styling (`scrollbar-width: none; -ms-overflow-style: none;`) and `.g4-workflows-scroll` containment.
