---
entity: chat-widget
type: event
timestamp: 2026-10-10T20:34:00+05:30
author: assistant
title: Universal Download Action Execution and Navigation Disambiguation
tags: [harness, navigation, download, motor-action, browser-tools]
---

# Universal Download Action Execution and Navigation Disambiguation

## Context & Problem
When a user entered motor action requests such as "download resume", "download cv", or "get resume", the agent harness misclassified the intent under generic landmark section navigation (`isSectionNavIntent`). Because `matchPrefix` was null, `targetQuery` was set to the entire query (`"download resume"`), which fuzzy-matched `a[download]` via `smartQuerySelector` and returned:
`📍 Navigated with human gaze to download resume (a[href='/Adarrsh-Paul-Resume.pdf']). Section is spotlighted on your screen.`
with `tool: "scroll"`. The page merely scrolled and spotlighted the link with human gaze tracking without triggering the actual download action.

## Root Cause
1. `isSectionNavIntent` lacked an action-verb disqualifier (`download`, `get`, `save`, `fetch`, `export`, `click`, etc.).
2. When no explicit navigation prefix (`go to`, `navigate to`, `scroll to`) was present, `isSectionNavIntent` permitted broad element token matching across interactive buttons and anchor links.
3. The harness lacked a dedicated first-class `isDownloadIntent` handler with motor click dispatch and `a[download]` execution.

## Solution Implemented
1. **Dedicated Download Intent Handler (`isDownloadIntent`)**:
   - Matches download expressions: `/\b(download|save|get|fetch|grab|export)\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+)/i`, `download resume`, `download cv`, etc.
   - Dynamic Multi-Strategy DOM Discovery:
     - Strategy A: Direct attribute match (`a[download*='${target}' i]`, `a[href*='${target}' i]`).
     - Strategy B: Weighted scoring across candidates (`a[download]`, `.pdf`, `resume`, `cv`, `download`).
     - Strategy C: Common document/PDF anchor fallback (`a[href$='.pdf' i]`).
   - Dispatches visual spotlight and synthetic human click via `ActionDispatcher.click(downloadEl)`.
   - Programmatically triggers `downloadEl.click()` for native browser download/new tab handling.
   - Emits clean confirmation: `📥 Triggered download for **[FileName]** (\`[selector]\`). The file is downloading to your device or opening in a new tab.` with `tool: "click"`.
2. **Navigation Disambiguation Guard**:
   - Explicitly rejects action verbs (`download`, `save`, `get`, `fetch`, etc.) from `isSectionNavIntent`.
   - Without an explicit navigation prefix, only actual landmark containers (`section[id]`, `article[id]`, `main > div[id]`) are matched.
3. **Agent Harness Primitives & Tools**:
   - Added `case "download":` to `AgentHarness.executeTool` and `primitiveBrowse`.
   - Added download action verbs to `isActionIntent`.

## Verification & Deployment
- E2E Playwright Browser Test Suite (`test_harness_navigation_and_download_suite.mjs`):
  - "download resume" -> PASSED (Downloaded `Adarrsh-Paul-Resume.pdf`)
  - "download cv" -> PASSED (Downloaded `Adarrsh-Paul-Resume.pdf`)
  - "get resume" -> PASSED (Downloaded `Adarrsh-Paul-Resume.pdf`)
  - "go to projects" -> PASSED (Navigated to `#projects`)
  - "about" -> PASSED (Navigated to `#about`)
- Regression Benchmarks:
  - Vega Physics Engine: 4/4 PASS
  - Numeric Grounding & A11y: 6/6 PASS
  - Giskard Stress Suite: 26/26 PASS
- Live Deployments via `npx wrangler pages deploy`:
  - `cloudfare-portfolio-app` (`paulcreates.online`): `1cca5396.cloudfare-portfolio-app-41v.pages.dev` (Verified live in headless Chromium)
  - `local-agent-harness` (`agent.paulcreates.online`): `3e0983bb.local-agent-harness.pages.dev`
