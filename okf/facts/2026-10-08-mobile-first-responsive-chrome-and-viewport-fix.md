---
fact_id: 2026-10-08-mobile-first-responsive-chrome-and-viewport-fix
entity: chat-widget
valid_from: 2026-10-08T09:30:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Mobile-First Responsive Chrome and Viewport Overhaul

## 1. Problem Statement & Root Cause
On mobile viewports (e.g. 360px–412px Android and iOS devices), the desktop-first fixed layout (`w-[440px]`, `bottom-6 right-6`, `h-[650px]`) suffered critical UX defects:
1. **Header Multi-Line Wrap & Letter Clipping**: `AI Copilot` lacked `whitespace-nowrap`, wrapping words onto two lines and pushing the top line under browser URL bars.
2. **Horizontal Overflow & Composer Clipping**: Right send button and composer border clipped outside the screen due to fixed margins.
3. **Mobile Auto-Zoom Annoyance**: Form inputs with `font-size: 13px` triggered automatic 25–50% viewport zoom on iOS Safari and Android Chrome, disorienting users.
4. **Frozen Touch Scrolling**: Overly aggressive `e.preventDefault()` on `touchmove` suppressed native inertial momentum scrolling on mobile.

## 2. Invariant Fixes
1. **Edge-to-Edge Responsive Container**:
   - Mobile (`< 640px`): `fixed inset-0 z-[999999] w-full h-[100dvh] max-h-[100dvh] rounded-none`.
   - Desktop (`>= 640px`): Retains elegant floating obsidian card (`w-[440px] h-[650px] rounded-[8px] bottom-6 right-6`).
2. **Safe Area & Auto-Zoom Immunity**:
   - Header top padding: `pt-[max(0.625rem,env(safe-area-inset-top))]`.
   - Composer bottom padding: `pb-[max(0.625rem,env(safe-area-inset-bottom))]`.
   - Input font size: `text-[16px] sm:text-[13px]`, completely preventing mobile browser auto-zoom.
3. **Single-Line Flex Header**:
   - `flex-nowrap`, `whitespace-nowrap shrink-0` on `AI Copilot` title.
   - Truncated model selector pill (`max-w-[85px] sm:max-w-[130px]`).
   - Touch-optimized 28px/32px touch targets for close (`✕`) and overflow (`•••`) actions.
4. **Native Inertial Touch Momentum**:
   - Touch move events inside scrollable containers are handled by the browser engine with native momentum and bounce.
   - Non-scrollable chrome interactions prevent unwanted host rubber-banding.
