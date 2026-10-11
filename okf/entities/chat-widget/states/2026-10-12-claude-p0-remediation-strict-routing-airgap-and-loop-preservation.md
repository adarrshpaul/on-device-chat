---
id: state_claude_p0_remediation_strict_routing_airgap_and_loop_preservation
layer: current
valid_from: 2026-10-12T02:25:00Z
valid_to: null
entity: chat-widget
---

# State: Claude P0 Remediation, Strict Intent Routing, Air-Gap Enforcement & Agent Loop Preservation

## Active State Properties
- **Strict Intent Routing Gates:**
  - `isThemeToggleIntent`: Removed loose `\b(light|day|switch)\b` regexes. Added explicit guard preventing OT switch commands (e.g., `switch port 1`, `change vlan`, `toggle setting`) from accidentally flipping UI themes. Requires explicit `theme|appearance|dark mode|light mode`.
  - `isScrollIntent`: Prevented false-positive viewport scrolls on status and telemetry queries (e.g., `top 5 ports by errors`, `down interfaces`). Requires explicit `scroll` or `page` command phrasing.
  - `isDownloadIntent`: Strictly decoupled from OT switch parameter commits. Queries like `save configuration` or `get port 3 status` are completely barred from auto-clicking physical buttons. Restricts candidate element queries strictly to elements with verified `download` or explicit export attributes/labels.
- **Air-Gap Network Leak Seal:**
  - Added strict check in `backgroundDownloader.ts` for `EO_AIRGAP === true`, `eo_airgap_mode === "true"`, and explicit `eo_ondevice_model_permission === "granted"`. Zero unauthorized background network requests to Hugging Face or CDNs.
- **Multi-Step Agent Loop Uncrippling:**
  - Removed premature `{ final: lastObservation }` short-circuit on lines 1373/1388 of `escalationManager.ts`. Tier 2 (SmolLM2) and Tier 3 (Gemma 4) now receive accumulated step observations and continue multi-step tool execution.
- **"Teach 1 → Batch N" Parameterizer Collapse Fix:**
  - Updated `MacroParameterizer.parameterizeSteps` in `batchEngine.ts` to preserve relative control selectors (`{{entity_selector}} select[name='...']`, `input[name='...']`) and global action targets (e.g., `btn_set_values`, `apply`) instead of blindly replacing all non-templated targets with `{{entity_selector}}`.
- **Navigation State Machine Preservation & URL Scheme Allowlist:**
  - Implemented `isSafeNavigationUrl` allowlist permitting only `http:`, `https:`, and relative routes (`/`, `./`, `../`, `#`). Blocks `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`.
  - Fixed `NavPersistenceManager.saveTask` across navigation links and the `navigate` tool to preserve accumulated `stepIndex`, `trajectory`, and `workingMemory`, preventing infinite page-reload loops.
- **Prompt Injection & XSS Sanitization:**
  - Added `sanitizeMarkdownHtml` to `MessageBubble.tsx` to strip dangerous script tags, event handlers (`onload`, `onerror`), and malicious URL protocols.
  - Restricted prose action links (`action:...`) to an explicit whitelist of safe inspection commands (`ALLOWED_PROSE_ACTIONS`).
- **OT Frame Tree Extension Support:**
  - Added `"all_frames": true` to `manifest.json` `content_scripts` to ensure full DOM accessibility across legacy OT multi-frame `<frameset>` architectures.
- **Honest Telemetry & Zero Fraud Compliance:**
  - Replaced fabricated latency numbers and synthetic confidence scores in `DecisionTrace` fast paths with truthful labels (`Rule: theme-toggle`, `Rule: viewport-scroll`, `Rule: file-download`).
- **Full Verification:**
  - All 10 automated test suites pass 100% (Giskard, Grounding, Vega, Universal Harness, SOTA Benchmarks, Workflow Predictor, Model Matrix, Chrome Extension Sync [59 tests], Cross-App UI Consistency, Industrial OT WBM [12 tests]).
