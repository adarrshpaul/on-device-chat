---
id: evt_zero_occlusion_hud_docking_preflight_purge
timestamp: 2026-10-11T17:35:00Z
entity: chat-widget
type: architectural_bugfix_and_layout_enhancement
---

# Event: Zero-Occlusion HUD, Side-Docking, and CSS Preflight Bleed Purge

## Root Cause Analysis
1. **Game Misalignment:** Importing `@import "tailwindcss";` in `src/index.css` pulled Tailwind Preflight reset `*, ::before, ::after { margin: 0; padding: 0 }`, which stripped Phaser's runtime-computed `margin-left: 435px` on the canvas element, causing the canvas to snap to the left margin.
2. **Screen Occlusion:**
   - On desktop, the widget was pinned to the bottom-right corner (`sm:bottom-6 sm:right-6`) with `w-[440px]`, directly overlapping the right half (246px) of the centered 409px canvas.
   - On mobile/narrow viewports (< 640px), the widget forced `fixed inset-0 w-full h-[100dvh]`, covering 100% of the screen and completely hiding the game.
   - The browser default `border-style: solid` without `border-width: 0` caused window control SVG buttons to render thick white square borders.

## Changes Applied
1. **CSS Preflight Purge:** Replaced `@import "tailwindcss";` with `@import "tailwindcss/theme.css";` and `@import "tailwindcss/utilities.css";`. Scoped all button and input element resets under `.g4-widget-container` with `border: 0 solid transparent !important`.
2. **Auto-Docking & Side Switching:** Added `dockPosition: "left" | "right"`. When a centered or right-leaning canvas is detected on desktop viewports, the widget automatically docks on the left, leaving 0px canvas overlap. Added a 1-click `ArrowLeftRight` dock toggle button in the header.
3. **Picture-in-Picture (PiP) Mini HUD:** Added `isCompactMode`. When minimized, the widget collapses into a 52px floating status bar at the bottom corner showing copilot state and quick expand controls.
4. **Ghost Mode Transparency:** Added `isGhostMode` toggle (`Eye`/`EyeOff`), applying `opacity-35 hover:opacity-100 transition-opacity` so users can see through the chat card during gameplay.
5. **Mobile Non-Occluding Bottom Sheet:** Replaced mobile `inset-0 h-[100dvh]` with a native `h-[50dvh]` bottom sheet, keeping the top 405px of the screen fully visible for the basketball hoop, score, and gameplay.
6. **Empirical Verification:** Passed 4/4 live browser scenarios on `https://basketball.paulcreates.online/`:
   - Host canvas margin (`margin-left: 435px`) 100% preserved.
   - Auto-docking on left verified with 0px overlap.
   - Mini HUD (52px) verified with 100% canvas visibility.
   - Ghost Mode transparency verified.
   - Mobile responsive bottom drawer (405px free space) verified.
