---
entity: chat-widget
type: state
timestamp: 2026-10-10T20:34:00+05:30
layer: current
preceded_by: 2026-10-10-vega-physics-engine-primary-with-secondary-laya-fallback.md
tags: [harness, download, navigation-disambiguation, browser-actions]
---

# Chat Widget State: Universal Download Action & Navigation Disambiguation

## Status: ACTIVE (Deployed to Production on Cloudflare Pages)

## Behavioral Specifications
1. **Download Request Disambiguation**:
   - Queries matching `/\b(download|save|get|fetch|grab|export)\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+)/i` or `"download resume"`, `"download cv"`, `"get resume"` route exclusively to `isDownloadIntent`.
   - Never treated as section scroll navigation.
2. **Dynamic DOM Download Matching**:
   - Scores candidates dynamically across any website via attributes (`a[download]`, `href*='.pdf'`, `href*='resume'`) and semantic text.
   - Dispatches visual spotlight and physical click via `ActionDispatcher.click()`.
   - Native trigger via `downloadEl.click()` guarantees file download without popup suppression.
   - Clean, descriptive response returned: `📥 Triggered download for **[FileName]** (\`[selector]\`). The file is downloading to your device or opening in a new tab.`.
3. **Section Landmark Navigation**:
   - Strictly reserved for navigational requests (`go to`, `navigate to`, `scroll to`, `show`, `jump to`) or exact section container ID matches.
   - Action verbs are disqualified from section scrolling.
4. **Benchmarking & Compliance**:
   - 26/26 Giskard benchmark test pass.
   - 6/6 Numeric grounding and A11y tests pass.
   - 4/4 Vega engine tests pass.
   - Live E2E verification confirmed on `https://paulcreates.online`.
