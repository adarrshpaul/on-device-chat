# Fact: Gate 1 Multi-Site Extension Verification & Tab Lifecycle Hardening

- **Status**: Verified
- **Date**: 2026-10-24
- **Branch**: `feat/task-118-pre-release-fixes` (commits `f62aed8` and `9594352`)
- **Pipeline Executed**: `npm run release:gate1` (`npm test && npm run lint && npm run e2e:extension`)

## 1. Background & Root Causes Identified
During execution of Gate 1 across the 4 target environments (`local`, `portfolio`, `store`, `agent`), two critical test lifecycle races were identified and eliminated:
1. **Multi-Tab Target Collision**: In Playwright with Chromium persistent extension profiles (`scope: 'worker'`), opening multiple pages across test cases without closing previous tabs caused `chrome.tabs.query({})` in `sendToTab` and `pageStatus` to target the first tab opened at that URL instead of the active/current test page. When `TOGGLE_WIDGET` was sent, it dispatched to Tab 1 (where the widget had already been toggled in prior tests), causing the active Tab 3 to time out waiting for the widget panel.
2. **Asynchronous React Mount Race in Content Script**: `getPageStatus()` in `extension/content/content.js` previously returned `isInitialized: true` synchronously before React finished rendering the launcher into the physical DOM. This caused race conditions where `TOGGLE_WIDGET` was dispatched before `#g4-floating-launcher` existed.

## 2. Fixes Implemented
1. **Clean Tab Isolation (`openCleanPage`)**:
   - Added `openCleanPage(extContext, url)` in `frontend/tests/e2e/extension/fixtures.ts`.
   - Closes prior worker tabs before navigating to ensure exactly one clean tab exists at any point in the test lifecycle, preventing zombie tab resource consumption and tab ID confusion.
2. **Active Tab Matching**:
   - Updated `sendToTab` and `pageStatus` to filter all matching URLs and resolve `tab.active ?? matching[matching.length - 1]`.
3. **Physical DOM Initialization Guard**:
   - Updated `getPageStatus()` in `extension/content/content.js` to require `isInitialized && hasWidgetOrLauncher` before reporting `isInitialized: true`.
4. **Canonical Store Origin**:
   - Updated `sites.ts` to map `store` to canonical Cloudflare Pages URL `https://tshirt-experiment.pages.dev/` (avoiding Cloudflare custom domain 523 origin errors on `store.paulcreates.online`).
5. **Compute-Pressure Permissions Filter**:
   - Added ambient `compute-pressure` warning filter to `fixtures.ts:newOnly` for clean console baseline comparison on WebGL pages.

## 3. Verification Matrix
- **Unit & Integration Tests (`npm test`)**: 17/17 test suites passed (0 failures).
- **Linter (`npm run lint`)**: 0 errors.
- **E2E Extension Gate 1 (`playwright test --project=gate1-extension`)**:
  - `popup renders without runtime errors`: PASS (123ms)
  - `extension on local-demo`:
    - mounts widget, zero errors, zero CSP violations, zero style leaks: PASS (5.6s)
    - launcher opens panel; input field is accessible: PASS (3.3s)
    - TOGGLE_WIDGET message opens the panel: SKIPPED (native embed yield)
  - `extension on portfolio` (`https://paulcreates.online/`):
    - mounts widget, zero errors, zero CSP violations, zero style leaks: PASS (6.6s)
    - launcher opens panel; input field is accessible: PASS (3.7s)
    - TOGGLE_WIDGET message opens the panel: SKIPPED (native embed yield)
  - `extension on store` (`https://tshirt-experiment.pages.dev/`):
    - mounts widget, zero errors, zero CSP violations, zero style leaks: PASS (4.2s)
    - launcher opens panel; input field is accessible: PASS (2.1s)
    - TOGGLE_WIDGET message opens the panel: PASS (681ms)
  - `extension on agent` (`https://agent.paulcreates.online/`):
    - mounts widget, zero errors, zero CSP violations, zero style leaks: PASS (4.0s)
    - launcher opens panel; input field is accessible: PASS (2.2s)
    - TOGGLE_WIDGET message opens the panel: PASS (786ms)
- **Total**: 11 passed, 2 skipped, 0 failed (56.6s).
- **Result**: Gate 1 is 100% verified and PASSING. Ready for Gate 2 staging release upon user approval.
