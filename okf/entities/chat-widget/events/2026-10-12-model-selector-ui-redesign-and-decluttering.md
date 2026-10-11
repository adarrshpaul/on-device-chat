---
id: event_model_selector_ui_redesign_and_decluttering
entity: chat-widget
timestamp: 2026-10-12T02:30:00Z
author: claude-p-consultation
type: ui-enhancement
---

# Event: Model Selector UI Redesign & Header De-cluttering via Claude Code Consultation

## Context & Motivation
In narrow viewport widths (e.g. 380px panel width), the right-side control cluster (Dock, Ghost, Workflows, REC, Overflow, Minimize, Close) occupied ~265px while the left brand occupied ~126px. The model selection pill was compressed by flexbox into an unrecognizable, crushed circle `[ v ]` with 0 visible text and no model icon.

## Claude Consultation (`claude -p`)
Consulted Claude Code via headless stdin pipeline (`claude -p`) on HCI hierarchy and header budget:
1. Recommended moving secondary window-docking (`ArrowLeftRight`) and background opacity (`Eye`/`EyeOff`) controls into the `•••` overflow menu.
2. Recommended dedicated `TIER_BADGES` configuration with distinct Lucide icons and concise labels:
   - Reflex (`Zap`, Cyan)
   - Nano (`Sparkles`, Blue)
   - MiniLM (`ScanSearch`, Emerald)
   - SmolLM (`Brain`, Purple)
   - Gemma 4 (`Gem`, Rose)
3. Recommended moving the cognitive engine escalation toggle into the dropdown header, replaced by an ambient violet beacon dot on the pill when available.
4. Preserved `shrink-0` on the model selector pill to guarantee it is never compressed.

## Changes Implemented
1. `frontend/src/components/tierBadges.ts`: Created with tier metadata, Lucide icons, short names, badge styles, and `stripLeadingEmoji` helper.
2. `frontend/src/components/ChatHeader.tsx`:
   - Moved Dock and Ghost controls to the `•••` menu with active indicator badges (`ON`/`OFF`).
   - Redesigned active model pill with dedicated `TIER_BADGES` Lucide icon, short tier label, rotating chevron, and accessible ARIA attributes.
   - Preserved `shrink-0` to eliminate pill truncation or crushing.
3. Verification:
   - Full build (`npm run build`) completed with 0 errors.
   - All 10 test suites passed cleanly (59 extension tests, 12 industrial OT tests, cross-app consistency tests).
   - Captured visual evidence in Playwright headless Chrome showing crisp, uncompressed pill and full dropdown.
