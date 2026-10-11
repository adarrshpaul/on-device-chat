---
id: fact_game_canvas_alignment_and_hud_zero_occlusion
layer: current
valid_from: 2026-10-11T17:35:00Z
valid_to: null
confidence: 1.0
provenance: "Empirical Playwright browser test on basketball.paulcreates.online in tests/test_game_canvas_and_hud_docking.mjs"
---

# Fact: Game Canvas Alignment & HUD Zero-Occlusion Architecture

## Architectural Decisions & Standards

### 1. Strict Isolation from Host Canvas & Layout Engines
- Embedded widgets must NEVER include Tailwind Preflight (`@import "tailwindcss"`) or global resets (`*, ::before, ::after { margin: 0 }`).
- Game frameworks such as Phaser calculate canvas alignment dynamically at runtime (e.g. `margin-left: (window.innerWidth - canvasWidth) / 2`). Any global margin/padding reset strips this inline style and shunts the canvas leftward.
- All resets must be strictly scoped under `.g4-widget-container` with explicit `border: 0 solid transparent !important` to prevent browser button borders.

### 2. Canvas-Aware Auto-Docking
- Default bottom-right docking (`sm:bottom-6 sm:right-6`) causes immediate occlusion when host websites center portrait canvases (e.g. 409px canvas centered in a 1280px window spans `x: 652.875` to `x: 1062.125`, colliding with a 440px right-docked widget from `x: 816` to `1256`).
- The agent harness actively inspects host `<canvas>` elements on mount. When the canvas occupies the right or center region, the widget automatically anchors to the left (`sm:bottom-6 sm:left-6`), guaranteeing **0px canvas overlap**.
- Users can toggle dock sides with a single click using the `ArrowLeftRight` button in the header.

### 3. Multi-Mode Adaptive Footprint
- **Full Chat Mode:** Standard 440px x 650px panel on desktop, docked on left or right.
- **Picture-in-Picture Mini HUD Mode:** Compact 52px floating bar with copilot activity beacon, active workflow status, and expand/dock controls. Keeps 99% of the viewport completely open for gameplay.
- **Ghost Mode:** 35% translucent obsidian glass (`opacity-35 hover:opacity-100 transition-opacity`), allowing players to view the game action directly through the chat interface.
- **Mobile Drawer Mode:** In viewports < 640px, the widget anchors as a `h-[50dvh]` bottom sheet instead of `inset-0 w-full h-[100dvh]`, leaving the top 405px free for the basketball hoop, score counter, and game canvas.
