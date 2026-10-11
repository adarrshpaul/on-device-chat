# OKF Fact: Chrome Developer Extension (Manifest V3) Wrapper & Automated Sync Pipeline

- **Date**: 2026-10-11T12:55:00Z
- **Author**: Antigravity Pair Programming Agent
- **Entity**: `browser-extension`
- **Layer**: `current`
- **Status**: `verified`

## 1. Problem Definition & Architectural Mandate
- **Universal Testing Need**: Rather than embedding `<script>` tags across individual web properties (e.g. `paulcreates.online`, `tshirt-experiment`), users and consumers need a universal browser extension to run the autonomous agent across *any* website.
- **Strict Parity Mandate**:
  - The npm library (`on-device-chat`) and the Chrome extension must share the exact same underlying logic; the extension is strictly a thin wrapper around the compiled bundle.
  - No drift: the npm package and extension must remain in 100% lockstep regarding bundle code, styles, versions, and metadata.
  - Zero-cloud / Zero-CDN: The extension must package all CSS and JS assets locally from `chrome-extension://` resources.

## 2. Implemented Components
1. **Chrome Extension (Manifest V3)**:
   - Location: `/Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/extension/`
   - `manifest.json`: Manifest V3 specification with `activeTab`, `storage`, `scripting`, `contextMenus`, `<all_urls>` host permissions, and commands (`Alt+Shift+A` to toggle, `Alt+Shift+R` to record macro).
   - `background.js`: Service worker handling context menu dispatch (`Ask On-Device AI Agent`, `⚡ Teach 1 → Batch N Macro`) and global keyboard command relay to active tabs.
   - `content/content.js`: Lightweight wrapper injecting local `content/style.css`, initializing `window.OnDeviceChat`, and handling runtime messages (`GET_PAGE_STATUS`, `TOGGLE_WIDGET`, `START_MACRO_RECORDING`, `ASK_AGENT`).
   - `popup.html`, `popup.css`, `popup.js`: Dark-mode popover UI displaying active tab domain, title, detected DOM entity count, quick action buttons, and auto-mount preference toggles synced with `chrome.storage.sync`.
   - `icons/`: Zero-dependency generated PNG assets (`icon16.png`, `icon48.png`, `icon128.png`, `icon.svg`).

2. **Automated Synchronization Pipeline (`frontend/scripts/sync-extension.mjs`)**:
   - Reads `frontend/package.json` metadata (version, description, homepage).
   - Synchronizes `extension/manifest.json` version and description in lockstep.
   - Copies `dist/on-device-chat.min.js` -> `extension/content/on-device-chat.min.js` and `dist/style.css` -> `extension/content/style.css`.
   - Computes SHA-256 hashes of both bundles and asserts 100% byte-for-byte fidelity.
   - Automatically generates missing icon PNG assets if absent.
   - Automatically packages `frontend/dist/on-device-browser-agent-v<version>.zip` ready for Chrome Web Store upload and consumer download.

3. **NPM Build Integration (`frontend/package.json`)**:
   - `npm run build`: Chains Vite compilation, TypeScript generation, and `sync-extension.mjs` automatically so every build preserves total synchronization.
   - `npm run sync:extension`: Dedicated manual trigger for syncing.
   - `npm run test:extension`: Automated test suite for extension validation.

## 3. Empirical Verification Suite (`frontend/tests/test_chrome_extension_sync_and_wrapper.mjs`)
- Tested 8 core verification suites:
  1. Sync pipeline execution (succeeded with 0 exit code).
  2. Manifest V3 schema and permission compliance (`activeTab`, `storage`, `scripting`, `contextMenus`, `<all_urls>`).
  3. Content script dependencies and sequence configuration.
  4. Bit-for-bit checksum parity between `dist/` and `extension/content/` (SHA-256 match).
  5. Icon PNG binary integrity verification (PNG magic number `89 50 4e 47 0d 0a 1a 0a` across 16px, 48px, 128px).
  6. Content script and background script message routing contract.
  7. Action popup UI structure and event binding definitions.
  8. Distribution package integrity (`dist/on-device-browser-agent-v0.1.9.zip` > 185 KB).
- **Result**: 58 / 58 automated tests passed (0 failures).
