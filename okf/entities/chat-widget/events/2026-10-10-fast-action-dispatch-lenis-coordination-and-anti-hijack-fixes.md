# Event: Fast Action Dispatch, Lenis Coordination & Anti-Hijacking Fixes

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Type:** Architectural Fix / Performance Optimization
- **Trigger:** User reported inability of website to perform actions and chat responsiveness regression.

## Root Cause Analysis
1. **Lenis Smooth Scroll Hijacking**: Host website (`paulcreates.online`) runs Lenis smooth scrolling inside GSAP's ticker. Native `scrollIntoView` and `window.scrollTo` calls dispatched by the agent were canceled or overridden by Lenis's frame interpolation loop because `window.lenis` was not exposed.
2. **DOM Selector Mismatch in Starter Workflows**: Starter workflow definitions referenced non-existent IDs (e.g. `#about` instead of `#home`, domain strings instead of element selectors).
3. **Workflow Intent Chat Hijacking**: In `workflowStore.findMatchingWorkflow`, substring matching on short tags like `"ai"` or `"ui"` caused regular conversational queries (containing words like "again", "explain", "detail", "fluid") to match `wf_ai_engram_deepdive` and divert the user into executing a workflow rather than answering or performing actions.
4. **Browse Target Verification Asymmetry**: `ProbabilisticHarnessEngine.verifyDecision` failed candidate verification when arguments passed numeric IDs or `target` instead of `selector`, preventing test-time short-circuiting.

## Applied Architectural Solutions
1. **Lenis Host Coordination (`smoothScrollTo`)**:
   - `ScrollService` in `cloudfare-portfolio-app` explicitly registers `(window as any).lenis = this.lenis`.
   - `domUtils.ts` introduces unified `smoothScrollTo(target, offset)` which delegates to `lenis.scrollTo(target)` if present or falls back to native smooth scrolling.
   - Wired into `spotlightElement`, `ActionDispatcher.click`, `ActionDispatcher.type`, and `WorkflowRunner`.
2. **DOM-Accurate Starter Workflows**:
   - Updated all starter workflows in `workflowStore.ts` to match real DOM elements (`#home`, `#journey`, `#skills`, `#projects`, `#insights`, `#contact`).
3. **Strict Anti-Hijack Workflow Matching**:
   - Upgraded `findMatchingWorkflow` to require explicit command prefixes (`run workflow`, `start workflow`) or whole-phrase boundary matches (`\b${triggerPhrase}\b`) of length >= 4.
4. **Sub-15ms Motor Action Fast-Path**:
   - Implemented zero-token instant execution handlers in `escalationManager.predictText` for directional scrolling (`scroll down`, `scroll up`, `scroll to top`, `scroll to bottom`) and landmark navigation (`go to projects`, `show skills`, `journey`, `contact`, `hire me`).
5. **Verified Build & Deployment**:
   - Built and synced `on-device-chat` 0.1.9 bundles into `cloudfare-portfolio-app`.
   - Built Angular 19 host app with zero errors.
   - Deployed live to Cloudflare Pages via `npx wrangler pages deploy dist/cloudflare`.
