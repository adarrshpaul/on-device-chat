---
event_id: 2026-10-05-theme-toggle-and-site-tour-engine
entity: chat-widget
timestamp: 2026-10-05T04:12:00+05:30
author: Antigravity
status: completed
---

# Event: Theme Toggle Resolution, Interactive Site Tour, and Scroll Optimization

## Root Cause Analysis
1. **Selector Hallucination on Icon-Only Buttons**:
   When prompted with *"click toggle thme"*, Gemini Nano hallucinated selector `'button.toggle-theme'` because the model had no list of interactive elements in its initial prompt.
   The actual DOM element was `<button class="btn btn-ghost btn-circle..." aria-label="Toggle Theme">` containing an SVG with no inner text.
   `smartQuerySelector` previously inspected only `textContent`, `value`, and `placeholder`, failing to inspect `aria-label`, `title`, or token overlap.
2. **Missing Real Navigation in "Site Tour"**:
   "Site tour" requests previously returned a static text overview paragraph without scrolling the page or spotlighting sections.
3. **Scroll Jitter / Stiffness**:
   Wheel handling in `ChatWidget.tsx` looped `window.getComputedStyle(target)` on every event tick, creating severe layout thrashing and failing to scroll when the cursor hovered over non-scrollable header/input regions.

## Architectural Resolution
1. **Resilient Accessible Element Resolution (`domUtils.ts`)**:
   - Upgraded `getCleanElementSelector`: Emits `button[aria-label='...']` or `[title='...']` when present.
   - Upgraded `smartQuerySelector`: Added 5-stage resolution pipeline: native CSS, direct ID, sanitization, case-insensitive attribute queries (`aria-label`, `title`), and multi-attribute token overlap.
2. **Initial Loop Grounding (`agentHarness.ts`)**:
   - Injected up to 16 visible interactive candidate elements into the initial user prompt on Step 0 so models have full visibility into real on-screen controls.
3. **Autonomous Guided Site Tour Engine (`siteTour.ts`)**:
   - Automatically detects key landmarks (Hero, Projects, Skills, Interactive Labs, Contact).
   - Smoothly scrolls the host page to the focused landmark (`scrollY` update) and triggers the glowing spotlight ring.
   - Generates interactive tour guides with section details and teleport triggers.
4. **Fluid High-Performance Scroll Interception (`ChatWidget.tsx`)**:
   - Replaced `getComputedStyle` with instant class and property ancestor lookup (`findScrollContainer`), falling back to the active messages container when hovering over headers/inputs.
5. **E2E Playwright Verification (`test_harness_navigation_and_theme.mjs`)**:
   - `"click toggle thme"`: Found `button[aria-label='Toggle Theme']`, spotlighted, clicked, toggled theme from `light` to `dark` (PASSED).
   - `"site tour"`: Navigated host page, smooth-scrolled to `scrollY: 8023`, activated spotlight ring, returned interactive tour guide (PASSED).
