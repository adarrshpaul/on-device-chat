# Event: NPM Package Release v0.2.0 & Chrome Extension Parity Sync

- **Date:** 2026-10-11T08:37:44Z
- **Entity:** `chat-widget`
- **Type:** release
- **Version:** `0.2.0`
- **Scope:** npm package `on-device-chat` and Chrome Developer Extension (`extension/`)
- **Maintainer:** `adarrsh_dev <adarrshdeveloper@gmail.com>`

## Context & Motivation
Following extensive testing across diverse real-world web applications (Amazon, GitHub, Hacker News, Wikipedia, SauceDemo, Books to Scrape), critical UX refinements (zero header element collision, expanded universal entity discovery, multi-level sibling traversal) and full Manifest V3 Chrome Extension packaging with 100% bit-for-bit bundle parity, the user approved releasing version `0.2.0` to the public npm registry.

## Actions & Verification
1. **Full Pre-Publish Verification Pipeline**:
   - 26/26 Giskard conversation safety and grounding benchmarks passed.
   - 20/20 SOTA web agent benchmarks passed (Mind2Web, WebArena, SeeClick, WebShop, OSWorld).
   - 4/4 Workflow specialty matrix scenarios passed.
   - 58/58 Chrome Developer Extension sync & wrapper tests passed.
   - ESLint: 0 errors, 0 warnings across all production and test modules.
2. **Distribution Artifacts Built**:
   - ESM library: `dist/index.js`
   - CommonJS library: `dist/index.cjs`
   - TypeScript definitions: `dist/index.d.ts`
   - Standalone single-file script: `dist/on-device-chat.min.js` (543.22 kB)
   - Chrome Extension standalone script: `extension/on-device-chat.min.js` (530.93 KB | SHA-256 parity verified)
   - Consumer extension archive: `dist/on-device-browser-agent-v0.2.0.zip` (185.89 KB)
3. **Registry Publication Handshake**:
   - User authenticated via npm interactive CLI browser handshake.
   - Successfully accepted and staged by npm registry (`+ on-device-chat@0.2.0`).
   - Replicated globally to `{ latest: '0.2.0' }` at `2026-10-11T08:37:43.991Z`.
