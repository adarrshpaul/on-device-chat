---
id: 2026-10-10-universal-harness-conversation-memory-and-nav-persistence
entity: chat-widget
type: event
timestamp: 2026-10-10T21:44:00+05:30
author: Antigravity
---

# Universal Harness Architecture Overhaul: Memory, Domain Bias Purge & Nav Persistence

## Context & Problem
An honest architectural audit revealed 3 core systemic flaws in the on-device web agent:
1. **Conversational Amnesia**: `useChat.ts` invoked `runLoop(content, ...)` with only the raw latest query string, omitting prior dialogue turns. Multi-turn co-reference ("it", "the first one") failed completely.
2. **Hardcoded Domain Biases**: `pageQA.ts` had a static fallback message telling users to ask about "research papers and engineering skills". `agentHarness.ts` had a static list of 11 consumer electronic nouns (`categoryNouns`). `escalationManager.ts` had a hardcoded dictionary of 16 section synonyms (`hire` -> `contact`, `hero` -> `home`).
3. **Multi-Page App (MPA) Unload Death**: When the agent navigated to another page via hyperlinks or `window.location.href`, the browser destroyed the JavaScript heap, aborting the in-flight task loop with 0 recovery mechanism.

## Root Cause Analysis
- Intent routing leaned on an expanding cascade of 38 regex literals and 12 fast-path handlers instead of generic perception and semantic grounding.
- Lack of state serialization across full-page HTTP transitions.

## Changes Executed
1. **Multi-Turn Conversation Memory**:
   - Updated `useChat.ts` to pass full dialogue history into `AgentHarness.runLoop(content, predictor, tier, conversationHistory)`.
   - Updated `AgentHarness.runLoop` to inject recent dialogue turns (up to 4 turns, bounded to ~1000 chars) into prompt before execution.
2. **Domain Bias Purge**:
   - Removed hardcoded portfolio phrase in `pageQA.ts`, dynamically synthesizing suggestions from `digest.outline`.
   - Removed `categoryNouns` list in `agentHarness.ts`'s `addToCart`, validating candidates dynamically against catalog elements and DOM text tokens.
   - Removed static `commonSynonyms` dictionary in `escalationManager.ts`, replacing with dynamic container heading, ID, and ARIA label attribute matching.
3. **Cross-Page Navigation State Machine**:
   - Implemented `NavPersistenceManager` (`src/lib/navPersistence.ts`) serializing active tasks (`InFlightTaskState`) to `sessionStorage` before page unloads.
   - Hooked `NavPersistenceManager.saveTask` into `click` on external hyperlinks and `navigate`/`goto` primitives.
   - Added auto-open and auto-resumption on page load in `ChatWidget.tsx` and `useChat.ts`.
4. **Comprehensive Test Suite & Verification**:
   - Added `test:universal` (`tests/test_universal_harness_architecture.mjs`).
   - Verified 4/4 suites pass: Giskard (26/26), Grounding (6/6), Vega (4/4), Universal (3/3).
   - Executed live Playwright browser test on `https://paulcreates.online` confirming:
     * Download resume action: ✅
     * Multi-turn memory: ✅
     * Cross-page reload resumption: ✅
5. **Deployments**:
   - `cloudfare-portfolio-app`: Deployed to Cloudflare Pages (`https://56b1530b.cloudfare-portfolio-app-41v.pages.dev`).
   - `local-agent-harness`: Deployed to Cloudflare Pages (`https://a8bf41cf.local-agent-harness.pages.dev`).
