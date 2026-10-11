# State: Bi-Directional Trackpad, Wheel & Drag Horizontal Scroll Navigation

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** historic
- **Version:** `0.1.9`
- **Status:** Superceded
- **Valid_from:** 2026-10-10T05:28:00Z
- **Valid_to:** 2026-10-10T05:37:00Z

## Summary
The on-device chat widget's horizontal content strips (including the Quick Workflows thumb bar and Navigation category pills) feature full bi-directional scroll support across all trackpad, mouse, and touch hardware. Scroll isolation correctly routes both horizontal flick gestures (`deltaX`) and vertical wheel rotations (`deltaY`) directly to target horizontal containers without bubbling to the parent page or vertical chat list. A pinned label anchor, drag-to-scroll panning, and dynamic left/right overflow chevrons provide fluid, accessible interaction on all devices.

## Active Invariants & Rules
1. `Bi-Directional Scroll Isolation`: The global window card wheel interceptor checks for horizontal scroll containers (`findHorizontalContainer`) before falling back to vertical containers. When hovered over horizontal strips, both `deltaX` and `deltaY` are translated directly into `scrollLeft`.
2. `Pan Freedom`: `.g4-window-card` enforces `touch-action: pan-x pan-y` and `overscroll-behavior-x: contain` to preserve native trackpad gestures and touch panning across all axes.
3. `Pinned Label Anchors`: Identifying badges (such as `⚡ Workflows:`) are pinned outside the scroll track so they remain anchored and legible during horizontal scrolling.
4. `Multi-Input Ergonomics`: Users can pan horizontal strips via: (a) trackpad two-finger horizontal swipe, (b) mouse wheel / vertical trackpad flick, (c) pointer click-and-drag, and (d) dynamic left/right chevron buttons.
5. `Accidental Click Protection`: Drag-to-scroll tracks pointer travel distance (`> 4px`) to suppress accidental button activations upon drag release.
