# State: SOTA Numeric Grounding & A11y Architecture

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** archived
- **Version:** `0.1.9`
- **Status:** Superseded
- **Valid_to:** 2026-10-10T03:05:00Z

## Summary
The on-device chat widget and agent harness features SOTA browser navigation powered by an In-DOM Accessibility Tree Engine (`A11yTreeEngine`), Set-of-Marks visual overlay system (`SomOverlayManager`), synthetic human-like action dispatcher (`ActionDispatcher`), and OODA state delta verifier (`StateDeltaVerifier`). Models interact with web pages using resilient integer element IDs `[1..N]` rather than fragile CSS selectors, drastically cutting token cost and eliminating hallucinated selector errors.

## Invariant Rules
1. Never feed raw unstructured HTML trees to on-device models; always parse via `A11yTreeEngine` for dense, clean accessibility node representation.
2. Models emit numeric targets (`target: 1`) for interactive element manipulation (`click`, `type`, `select`).
3. Form element typing must invoke native prototype property descriptor setters to trigger reactivity across React 19, Angular Signals, and Vue 3.
4. All tool actions must be verified via `StateDeltaVerifier` before declaring step completion.
