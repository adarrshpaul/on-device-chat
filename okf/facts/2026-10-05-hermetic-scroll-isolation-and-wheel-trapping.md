---
fact_id: 2026-10-05-hermetic-scroll-isolation-and-wheel-trapping
entity: chat-widget
valid_from: 2026-10-05T03:32:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Hermetic Scroll Isolation and Native Wheel Trapping

## Summary
The on-device chat widget implements complete gesture and scroll isolation from the host application. Scrolling or swiping anywhere inside the widget card never bleeds or chains to `window.scrollY` or the underlying host page.

## Invariant Guarantees
1. **Zero Background Scroll Bleed**: Wheel events (`wheel`) and touch events (`touchmove`) originating anywhere within `.g4-window-card` are captured with `{ passive: false }` and strictly intercepted with `e.preventDefault()` and `e.stopPropagation()`.
2. **Deterministic Internal Delta Application**: The nearest scrollable ancestor within the widget (`.g4-messages-container`, history panels, or eval viewports) receives manually clamped scroll delta (`Math.max(0, Math.min(maxScroll, scrollTop + e.deltaY))`).
3. **Boundary Protection**: Even when the internal scrollable container reaches `scrollTop = 0` (top) or `scrollTop = maxScroll` (bottom), high-momentum wheel ticks are safely absorbed and zero surplus delta is emitted to the host window.
4. **CSS Containment Invariants**: `overscroll-behavior: contain !important;`, `overscroll-behavior-y: contain !important;`, and `touch-action: pan-y;` prevent native browser scroll-chaining heuristics across all engines (WebKit, Blink, Gecko).
