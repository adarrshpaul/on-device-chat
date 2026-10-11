# Event: NPM Package Release v0.1.9 (Hardware Trackpad Physics & Zero-Overlap Workflows)

- **Date:** 2026-10-10T06:24:00Z
- **Entity:** `chat-widget`
- **Type:** release
- **Version:** `0.1.9`
- **Scope:** npm package `on-device-chat`

## Context & Motivation
Following the comprehensive fixes to the horizontal scrolling engine (120fps hardware compositor inertia, dedicated workflows bar wheel event bus, pointer-capture drag scrolling, and zero-overlap in-flow flex navigation chevrons), the user requested releasing the updated package to the public npm registry.

## Actions Taken
1. Executed full verification test suite:
   - 26/26 Giskard conversation and chatbot benchmark tests passed.
   - 6/6 Numeric grounding and A11y tree end-to-end tests passed.
2. Fixed linter strictness violations:
   - Removed unused variable in `src/lib/domUtils.ts`.
   - Converted non-reassigned `let targetDesc` to `const targetDesc` in `src/lib/workflowRunner.ts`.
   - Verified 0 errors across ESLint.
3. Built production distribution bundles:
   - ESM (`dist/index.js`), CJS (`dist/index.cjs`), TypeScript typings (`dist/index.d.ts`).
   - Standalone browser bundles (`dist/on-device-chat.min.js`, `dist/gemma4-agent.min.js`).
   - CSS styles (`dist/style.css`).
4. Initiated `npm publish` with web authorization handshake opened in browser.
