# State: Robust Hardware Trackpad Physics, In-Flow Chevrons & Zero-Overlap Workflows Bar

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** historic
- **Version:** `0.1.9`
- **Status:** Superceded
- **Valid_from:** 2026-10-10T06:16:00Z
- **Valid_to:** 2026-10-10T06:56:00Z

## Summary
The Quick Workflows thumb bar features 100% native 120fps hardware-accelerated momentum trackpad scrolling, pointer-capture drag scrolling, and zero-overlap in-flow flex navigation chevrons. All brittle JavaScript root wheel hijacking (`e.preventDefault()`) was removed in favor of native CSS scroll boundary containment (`overscroll-behavior: contain !important; touch-action: pan-x !important;`), preserving macOS/Windows trackpad inertia, subpixel rubber-banding, and velocity decay. A dedicated Workflows Bar wheel listener translates vertical mouse wheel ticks into smooth horizontal translation while preserving native hardware compositor execution for horizontal trackpad gestures. Chevrons reside in dedicated, non-overlapping flex slots (`shrink-0 w-5 h-5`) and dynamically disable with `opacity-20 pointer-events-none` when at boundary limits.

## Active Invariants & Rules
1. `Zero In-Widget Wheel Hijacking`: Root window cards and scrollable lists rely strictly on native `overscroll-behavior: contain !important;` and `e.stopPropagation()` with `{ passive: true }`. Never call `e.preventDefault()` on trackpad scroll gestures.
2. `Dedicated Horizontal Translation`: Vertical mouse wheels (`e.deltaY !== 0, deltaX === 0`) over the workflows bar translate smoothly to `scrollLeft += e.deltaY`. Horizontal trackpad swipes (`|deltaX| > 0`) over the scroll track execute natively on the browser GPU compositor thread.
3. `Pointer Capture Drag Architecture`: Mouse, stylus, and touch drag uses `setPointerCapture(e.pointerId)` on `workflowsScrollRef`, ensuring drags do not drop when the cursor moves outside the bar. A 80ms post-drag movement guard prevents accidental click dispatch on workflow action buttons.
4. `In-Flow Zero Overlap Chevrons`: Navigation chevrons (`<` and `>`) occupy dedicated flex items in the normal layout flow (`[Workflows:] [‹] [Track] [›] [Add]`). Absolute floating overlays are strictly prohibited.
5. `Continuous Trackpad Integrity`: CSS `scroll-behavior: smooth` is prohibited on continuous gesture tracks to prevent 60Hz/120Hz micro-tick animation restart stutter. Programmatic smooth scrolling is reserved exclusively for explicit chevron button clicks.
