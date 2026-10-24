---
id: fact_task_114_harness_superpowers_20261024
entity: agent_harness
property: harness_superpowers_implementation
layer: current
valid_from: 2026-10-24
author: antigravity
trust: machine-confirmed (node tests/test_task_114_harness_superpowers.mjs 14/14 passed; npm test 17/17 suites passed)
resolves: [intention_harness_browser_automation_superpowers_20261024]
---

# TASK-114: Browser Automation Superpowers Implementation

Implementation of items 4, 5, 6, 8 from `intention_harness_browser_automation_superpowers_20261024.md`:

## 1. Real Waits (`WaitManager`)
- **Replaced Sleep Loops**: Replaced blind fixed timeouts (`setTimeout`) with physiological browser state signals.
- **DOM Settle Quiet Period**: `WaitManager.waitForDomSettle` uses a `MutationObserver` quiet period (default 200ms without mutations). Every DOM mutation resets the quiet period.
- **Network Idle**: `WaitManager.waitForNetworkIdle` uses CDP `Network.*` (extension tier) or `PerformanceObserver` resource timing with in-flight fetch tracking (standalone widget tier).
- **Harness Primitive**: Added `primitiveWait` in `AgentHarness`.

## 2. Self-Healing Locators & Playwright Export
- **5-Tier Self-Healing Hierarchy (`SelfHealingLocatorEngine`)**:
  1. `testId` (`data-testid`, `data-test`, `data-qa`, `data-cy`) [Confidence: 0.99]
  2. `roleAndName` (ARIA role + accessible name) [Confidence: 0.95]
  3. `text` (visible text content) [Confidence: 0.85]
  4. `css` (clean CSS selector) [Confidence: 0.75]
  5. `relativeAnchor` (nearest heading/landmark anchor) [Confidence: 0.65]
- **Healed Telemetry**: Replay automatically falls back if primary selector breaks (e.g. dynamic class hash change), logging `healed: true` and the matched strategy.
- **Playwright Test Export**: Added `MacroRecorder.exportAsPlaywright()` exporting recorded workflows into executable, modern `@playwright/test` scripts.

## 3. Durable Multi-Page & Multi-Tab Runs
- **Cross-Origin Session Persistence**: Enhanced `NavPersistenceManager` to persist active in-flight task state and trajectory into `chrome.storage.session` (extension tier) in addition to `sessionStorage` (widget tier). Survives cross-origin navigations.
- **Tab Management Primitives**: Added tools in `AgentHarness` and background service worker:
  - `openTab({ url })`: Opens new tab and focuses.
  - `switchTab({ tabId, urlPattern })`: Switches active tab by ID or URL pattern.
  - `closeTab({ tabId })`: Closes tab.
  - `listTabs()`: Returns list of all open tabs in current window with URLs and IDs.

## 4. Structured Data Extraction (`DataExtractor`)
- **Native Table & Div Grid Parsing**: `DataExtractor.extractTable` parses standard HTML `<table>` elements and modern `<div>` / flex / grid cards.
- **RFC 4180 CSV Serialization**: Handles escaped quotes, commas, and multiline text.
- **Harness Tool**: Exposed `extract` primitive in `AgentHarness` (`primitiveExtract`), compacting large table observations (>1200 chars) into `mem://` references.
