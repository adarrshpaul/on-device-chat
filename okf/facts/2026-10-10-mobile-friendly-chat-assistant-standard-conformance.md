# Mobile-Friendly Chat Assistant Standard Conformance

- **Date:** 2026-10-10
- **Layer:** current
- **Entity:** `chat-widget`
- **Version:** `0.1.8`

## Context & Problem
Mobile smartphone viewports (320px–430px) presented layout defects with virtual keyboards, auto-zoom on input elements, forced scroll yanks, and oversized headers. A draft standard ("Mobile-friendly chat assistant — standards & instructions") was established to govern phone-first chat behaviors.

## Implementation Details

1. **Viewport & Keyboard Docking (Standard Section 2.1 & 2.2)**:
   - Dynamic `window.visualViewport` height tracking bound directly to the modal window card (`style={{ height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` }}`). When the virtual keyboard rises on iOS Safari or Android Chrome, the window docks cleanly without double-scroll or viewport clipping.
   - Text input font-size clamped at `16px` (`text-[16px]`), completely eliminating the iOS Safari & Android Chrome auto-zoom trigger.
   - Modal shell expands edge-to-edge (`inset-0`, `100dvh`, `rounded-none`) on mobile screens (`< 640px`) with safe-area insets (`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`).

2. **Smart Scroll-Up Retention & Floating Chip (Standard Section 2.3)**:
   - Added container scroll tracking (`isNearBottom < 72px`).
   - If the user scrolls up to review prior history, incoming streaming tokens do NOT forcibly yank the user to the bottom. Instead, an accessible floating "New message ↓" pill renders above the composer. Tapping it smoothly scrolls to the bottom.
   - Respected `prefers-reduced-motion` media queries to disable smooth animation for motion-sensitive users.

3. **Touch Targets & Typography (Standard Section 2.2 & 4)**:
   - Body font-size set to 16px minimum with `line-height: 1.52` in `.g4-prose`.
   - Side padding enforced at 16px (`1rem`).
   - Top bar height standardized to 52px (within 44–56px spec) with 40–44px action buttons.
   - Composer Send/Stop unified slot with dedicated 44×44px hit target.
   - Copy button added under assistant turns alongside thumbs feedback.

4. **Empty State & System Instructions (Standard Section 5, 7, 10)**:
   - Initial empty state communicates capability in 1 sentence, hard limit in 1 sentence, and 4 example chips (minimum 40px height).
   - System prompt builder in `harnessPrompt.ts` and `geminiNanoEngine.ts` enforces the Section 10 mobile reply shape: result first in 1–3 lines, 40–120 words budget, single question/action closing, confirmation on commit, and honest 1-line limit statements.

## Verification
- 26/26 Giskard benchmark tests passed (`npm test`).
- Production bundle compiled to `dist/on-device-chat.min.js` and synced to `cloudfare-portfolio-app`.
- Deployed to Cloudflare Pages (`https://ae6277da.cloudfare-portfolio-app-41v.pages.dev` / `https://paulcreates.online`).
