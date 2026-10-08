---
fact_id: 2026-10-05-portfolio-integration-and-v017-npm-prep
entity: chat-widget
valid_from: 2026-10-05T14:40:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Live Portfolio Integration (v0.1.7) & NPM Release Preparation

## Summary
The updated quiet-chrome on-device AI assistant widget was integrated into the live `cloudfare-portfolio-app` (`paulcreates.online`) running locally on port 4300 and prepared for `on-device-chat@0.1.7` NPM distribution.

## Key Verification & Status
1. **Portfolio Live Integration (`cloudfare-portfolio-app`)**:
   - Deployed fresh distribution files to `src/assets/on-device-chat/0.1.7/` (`on-device-chat.min.js` 374 kB, `style.css` 54.7 kB).
   - Updated `src/index.html` to load version `0.1.7`.
   - Verified HTTP 200 responses on `http://127.0.0.1:4300/assets/on-device-chat/0.1.7/on-device-chat.min.js` and `style.css`.
2. **End-to-End Live Execution (`test_harness_navigation_and_theme.mjs`)**:
   - `"click toggle thme"`: Dynamically targeted `button[aria-label='Toggle Theme']` on the live portfolio navbar, toggling document theme from `light` to `dark`.
   - `"site tour"`: Dynamically detected host page landmarks, smooth-scrolled viewport, and engaged spotlight highlight HUD.
   - `"What actions can you perform on this page?"`: Rendered calibrated DecisionCard with alternatives and full action breakdown.
3. **NPM Package Readiness (`on-device-chat@0.1.7`)**:
   - Clean tarball generated (`400.8 kB` compressed, `1.4 MB` unpacked, 55 files).
   - 26/26 Giskard benchmark evals passed; zero ESLint errors; TypeScript `.d.ts` types compiled.
   - Maintainer on npm registry: `adarrsh_dev`.
   - Local CLI publish blocked by expired token in `~/.npmrc`; requiring interactive `npm login` or CI tag push (`v0.1.7`).
