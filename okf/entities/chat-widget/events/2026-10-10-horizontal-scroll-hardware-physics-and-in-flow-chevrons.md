# Event: Workflows Bar Zero-Overlap Layout & 120fps Hardware Trackpad Scrolling

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Type:** bug_fix
- **Trigger:** User reported horizontal scrolling still felt problematic, and chevrons directly overlapped button text.

## Context & Root Causes
1. **Absolute Floating Chevron Collision:** Chevrons were positioned `absolute left-[88px]` and `absolute right-1`, directly covering and obscuring the first and last workflow button text labels.
2. **`scroll-smooth` Conflicting with Trackpad Wheel Ticks:** CSS `scroll-smooth` on the horizontal scroll container caused continuous 60Hz/120Hz trackpad wheel ticks to continuously restart easing animations, creating terrible stutter, lag, and jitter.
3. **Double Dispatch & Wheel Cancellation:** `cardRef`'s `handleWheel` unconditionally called `e.preventDefault()`, killing native browser momentum and subpixel rubber-banding, while an additional inline React `onWheel` doubled scroll dispatch.

## Implementation Details
1. **In-Flow Dedicated Chevron Slots:**
   - Moved `<` and `>` chevrons into their own dedicated inline flex slots (`shrink-0 w-4 h-5`).
   - Completely eliminated absolute floating overlays: chevrons physically cannot collide or overlap button text on any viewport size.
   - Chevrons automatically disable (`opacity-20 pointer-events-none`) when at bounds.
2. **Instant 120fps Hardware Momentum Scrolling:**
   - Removed `scroll-smooth` from container CSS classes. Smooth scrolling is reserved strictly for programmatic chevron button clicks (`scrollBy({ behavior: "smooth" })`).
   - Explicitly configured `scroll-behavior: auto !important` and `touch-action: pan-x pan-y !important`.
3. **Preserved Native Trackpad Compositor:**
   - In `handleWheel`: when horizontal trackpad gestures occur (`|deltaX| > |deltaY|`), `e.stopPropagation()` halts host window bleed, but `e.preventDefault()` is NOT called, permitting Apple hardware momentum, velocity decay, and subpixel inertia.
   - Vertical mouse wheel movements over the horizontal bar are smoothly translated via `scrollLeft += deltaY`.
