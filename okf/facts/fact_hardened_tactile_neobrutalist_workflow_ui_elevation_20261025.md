---
fact_id: fact_hardened_tactile_neobrutalist_workflow_ui_elevation_20261025
entity: on-device-chat
layer: current
valid_from: 2026-10-25T03:00:00+05:30
valid_to: infinity
confidence: verified_reproducible
sources:
  - commit 19d301d
  - Cloudflare Pages deployment a045c518
  - Playwright visual audits refined_widget_neobrutalist_v3.png, refined_widget_active_send_v3.png, refined_workflow_studio_v2.png
---

# Fact: Hardened Tactile Neo-Brutalist UI Elevation & Defect Resolution

## 1. Problem Diagnosed & Fixed
- **Root Cause of Invisible Workflows**: In `index.css:91-109`, a legacy CSS reset (`:is(...) button { border: 0 !important; background-color: transparent; padding: 0; box-shadow: none; }`) stripped backgrounds, borders, padding, and drop shadows from all buttons inside the widget. Normal utility classes were overridden, causing Quick Routine carousel buttons and hero run buttons to render as bare, transparent, unpadded text against obsidian backgrounds.
- **Root Cause of Scrolled Hero Deck**: On initial mount with `messages.length === 0`, an automated `useEffect` was invoking `scrollToBottom(true)`, which scrolled past the headline *"What do you want to automate today?"* down into secondary chips.
- **Root Cause of Visual Clutter**: An oversized one-time permission banner swallowed 200px of vertical viewport before the user could see the automated workflow deck.

## 2. Implementations
1. **Hardened Button Isolation Architecture**:
   - Refined the reset to target only unstyled buttons (`button:not([class*="border"]):not([class*="neo-"])`, etc.) while safeguarding host CMS immunity.
   - Built a dedicated tactile neo-brutalist component system (`.neo-pill-lime`, `.neo-pill-white`, `.neo-pill-purple`, `.neo-pill-pink`, `.neo-card-lime`, `.neo-btn-run`, `.neo-btn-send-active`, `.neo-dot-grid`) with explicit high-contrast color blocking, 2px solid black borders, and hard drop shadows (`shadow-[2px_2px_0px_0px_#000]`).
2. **Apple-Grade Touch Surfaces**:
   - Empty state hero presents compact ~68px tactile cards with circular Zap badges, "Verified" indicators, step counts, and circular Play buttons.
   - Initial scroll position pinned to `scrollTop = 0` when messages are empty.
   - Compact 32px non-intrusive permission callout.
   - Workflow Studio upgraded with physical dot-grid canvas background and high-visibility neon lime Run buttons.
   - Composer input border elevated to Electric Lime with neon active send button.

## 3. Verification & Live Deployment
- `npm test`: 18/18 test suites passed 100% (Giskard, Safety Gate, Adversarial CSS Isolation, Amazon, Basketball auto-docking, Task 117, Audit regressions).
- Deployed to Cloudflare Pages `local-agent-harness` (`https://agent.paulcreates.online`, deployment `a045c518`).
- Pushed commit `19d301d` to GitHub `origin/main`.
