---
id: state_zero_occlusion_hud_docking_preflight_purge
layer: historical
valid_from: 2026-10-11T17:35:00Z
valid_to: 2026-10-11T18:00:00Z
entity: chat-widget
---

# State: Zero-Occlusion HUD, Side-Docking, and CSS Preflight Purge

## Active State Properties
- **CSS Preflight:** Completely removed from `src/index.css`. Uses `@import "tailwindcss/theme.css";` and `@import "tailwindcss/utilities.css";`. Host page canvas styles (`margin-left: 435px`) are 100% untouched.
- **Docking Engine:** Supports dynamic left/right docking. Auto-detects centered/right canvas elements and docks to the left side on desktop screens.
- **Mini HUD (Picture-in-Picture):** Supports compact mode (`isCompactMode: boolean`), rendering a 52px floating bar.
- **Ghost Transparency:** Supports on-demand opacity toggle (`isGhostMode: boolean`), setting `opacity-35 hover:opacity-100 transition-opacity`.
- **Mobile Responsive Drawer:** Operates as a bottom sheet (`h-[50dvh]`), preserving the top half of mobile viewports for game play.
- **Dynamic Workflows:** Retains 100% dynamic discovery with zero hardcoded templates, dynamically generating `🎮 Play Game Autopilot` on canvas sites.
