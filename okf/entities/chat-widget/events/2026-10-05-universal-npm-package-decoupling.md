---
type: event
entity: chat-widget
occurred_at: 2026-10-05T08:10:00+05:30
trigger: user-audit-request
outcome: decoupled-and-verified
from_state: ../states/2026-10-05-hermetic-scroll-and-direct-primitives.md
to_state: ../states/2026-10-05-universal-npm-package-decoupling.md
---

# Event: Universal NPM Package & CDN Distribution Decoupling

## Trigger
Thorough audit conducted before publishing `on-device-chat` to npm and jsDelivr / unpkg CDN, ensuring complete elimination of site-specific hardcoded logic, selectors, and placeholders.

## Changes
1. `domUtils.ts`: Stripped out `button.btn-circle`, `data-row-id="music"`, `(click)="synth"`, and SVG path matches. Implemented universal accessible shortcuts for themes, menus, search, e-commerce carts, and dismiss buttons.
2. `escalationManager.ts`: Replaced `button.btn-circle` with framework-agnostic accessible theme selectors in both the theme action handler and capabilities detection. Fixed ESLint regex escapes in math calculations.
3. `NavigationHub.tsx`: Replaced specific cue examples in the search input placeholder with universal topics (`pricing`, `features`, `docs`).
4. `engramNavigator.ts`: Replaced specific example comments with universal terms.
5. `main.tsx`: Replaced local relative asset stylesheet fallback with jsDelivr CDN URL.
6. `test_universal_widget.mjs`: Added full Playwright test suite against synthetic SaaS host site (`Acme Cloud`), verifying zero hardcoded term leakage, dynamic section discovery, theme toggling, and universal placeholders.
