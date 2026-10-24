---
id: intention_harness_browser_automation_superpowers_20261024
entity: agent_harness
layer: intention
status: items-1-3-implemented-uncommitted
valid_from: 2026-10-24
author: claude-code
trust: machine-confirmed (gaps from code read 2026-10-24)
depends_on: [intention_on_device_chat_improvement_plan_20261024]
---

# Harness upgrades for browser automation (frontend/src/lib/agentHarness.ts + extension/)

## Gaps found in code
- **G1 Untrusted input.** `actionDispatcher.ts` synthesises Pointer/Mouse/Keyboard events (`isTrusted=false`). Sites that check trust, file inputs, drag-drop, hover menus and canvas apps ignore them.
- **G2 No shadow DOM or iframe reach.** `a11yTree.ts` and `domUtils.ts` have 0 `shadowRoot` references. Web-component apps (YouTube, Salesforce Lightning, GitHub parts) are partly invisible.
- **G3 Single page only.** A run lives in the page; navigation kills it. There is no multi-tab orchestration, although the extension has `<all_urls>` and could do it.
- **G4 Fixed sleeps, not real waits.** There is no network-idle or DOM-settle signal.
- **G5 Brittle locators.** One CSS selector per step, with no fallbacks and no self-healing.
- **G6 SECURITY: the `sandbox`/`eval` tool is escapable.** It uses a regex blocklist plus `new Function` in the page's realm. String-built property names get past `\b...\b` patterns. Page text is untrusted, so a prompt injection could reach arbitrary JS in the user's logged-in page.
- **G7 No irreversible-action gate.** Purchase, send, delete or submit-payment actions are not forced through a user confirmation.

## Proposed upgrades (in order)
1. **Fix G6 first.**
   - Move code execution into a QuickJS-WASM or Worker realm with no DOM, network or storage, and pass data in and out as JSON only.
   - Add a Giskard test using a string-concatenation escape, which must fail.
2. **Trusted actions (extension tier).**
   - Add the optional `debugger` permission, requested at runtime.
   - Use CDP `Input.dispatchMouseEvent`, `Input.insertText`, `Input.dispatchDragEvent` and `DOM.setFileInputFiles` for trusted clicks, typing, drag and uploads.
   - Chrome shows the "debugging this browser" banner, so say so in the UI. The npm/widget tier keeps synthetic events and labels them as such.
3. **Perception reach.** Pierce open shadow roots and same-origin iframes in the a11y tree and `smartQuerySelector`. Cross-origin frames are handled through the extension content script (`all_frames` is already set) with frame-scoped messaging.
4. **Durable multi-page runs.**
   - The background service worker owns the run state in `chrome.storage.session`, and the content script resumes the step after navigation.
   - Add `openTab`, `switchTab` and `closeTab` tools.
   - Step budget and loop guard (TASK-108).
5. **Real waits.** Wait for the DOM to settle (MutationObserver quiet period) and the network to go idle (CDP `Network.*` in the extension, PerformanceObserver resource timing in the widget) instead of sleeping.
6. **Self-healing locators.** Record role+name, text, test-id, CSS and relative anchor for each element. On replay, try them in order and log which one matched. Export recorded macros as a Playwright script, which also gives debuggable output.
7. **Safety gate (G7).** Classify actions as irreversible by role/name/URL (checkout, pay, send, delete) and force a confirm card. Keep a per-site allowlist. Treat page text as data in the prompt, wrapped and labelled.
8. **Extraction.** Turn a table/list/pagination into CSV or JSON using the existing `batchEngine`.

**Measurement:** every upgrade lands with a before/after on the real eval set from the improvement plan (Mind2Web split + 30 real-site tasks). No new claims on npm without numbers (§7).

## Implemented 2026-10-24 (claude-code, uncommitted, not published)
1. **G6 fixed.**
   - `src/lib/safeExpression.ts` is an arithmetic-only parser: numbers, operators, ternary, whitelisted Math, numeric/boolean `context` fields.
   - `primitiveSandbox` uses it, with no `new Function`.
   - The old sandbox WAS escapable: a string-built payload flipped a canary, verified. The new one refuses it.
   - `giskard_stress_test.mjs` now imports the real module (it used to test a pasted copy) and includes that payload as a regression: 35/35.
2. **Trusted input.**
   - `ActionDispatcher.setTrustedInputBridge()` and `lastInputMode`; harness observations say `[trusted input]` or `[synthetic input]`.
   - Extension: optional `debugger` permission (popup toggle, requested on user click), background CDP `Input.*` handler, top frame only, detaches after 15 s idle, content-script bridge.
   - Falls back to synthetic (and says so) when the element is covered or zero-size, the bridge fails, or typing doesn't land.
3. **Perception reach.**
   - `collectSearchRoots` / `deepQuerySelectorAll` / `topLevelRect` in domUtils cover open shadow roots and same-origin iframes.
   - The a11y scan and `smartQuerySelector` use them.
   - Dispatcher checks are realm-safe (iframe elements fail `instanceof HTMLElement`).

**Verification:**
- `tsc` clean; all 11 npm test suites pass.
- Playwright fixture: 13/13 (shadow + iframe scan, top-level iframe bounds, synthetic vs trusted isTrusted, shadow typing, covered-element fallback). The pre-change bundle fails the iframe scan.
- Real unpacked-extension E2E (test copy with debugger pre-granted): 3/3, `isTrusted === true` via chrome.debugger.

**Not done:**
- Closed shadow roots and cross-origin iframes (unreachable from page script);
- drag-and-drop and file upload;
- trusted input inside iframes when the dispatcher itself runs in a child frame;
- items 4–8.
- **Risk:** trusted input makes prompt-injected actions more effective, so item 7 (irreversible-action gate) should come next.
- `tests/test_tool_primitives.mjs` already failed at HEAD (ERR_MODULE_NOT_FOUND ./recipeStore). Not fixed.

### Follow-up fixes (same day, after review)
- **Model-facing descriptions:**
  - the sandbox tool descriptions (harnessPrompt, layaEngine, types, escalationManager) now state the arithmetic grammar instead of "JS expression";
  - `probabilisticHarness` pre-scores sandbox calls with a dry run of the real parser.
- **Second eval removed:** `escalationManager` math shortcut `Function(expr)` replaced with `evaluateSafeExpression`. It was already digit/operator-filtered, so not exploitable, but the project no longer needs eval.
- **Widget exclusion:** `isWidgetElement` now walks shadow hosts, because the widget renders in its own shadow root. A browser check mounts the widget and asserts the deep scan sees none of its controls.
- **Trusted typing:** clearing a contenteditable uses the element's own document selection. When clearing, it requires an exact match, otherwise it falls back to synthetic.
- **Permission grant:** the background mirrors the debugger permission into storage (`permissions.onAdded` / `onRemoved`). Content scripts follow `storage.onChanged`. The real popup prompt flow still requires a human click and is not automated.
- **Test doubles:** the deep traversal degrades to the root document on DOMs without `createTreeWalker` (mock DOMs), and element checks accept same-realm `instanceof` OR nodeType/tagName.
- **Scan cost:** 18,005-node page, median `scan()` 6.0 ms before → 7.7 ms after.
- **Final verification:** 11/11 suites, tsc clean, Playwright 15/15, extension E2E 3/3, `npm run build` synced the extension.
