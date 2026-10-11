# Event: RCA & Fix: Question Intent Routing, Background Noise Elimination & Grounded Q&A

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Type:** bug_fix
- **Trigger:** User query "who is john ??" triggered `browse` action and dumped raw accessibility snapshot `[1] button "Toggle Theme"` instead of conversational knowledge answering.

## Root Cause Analysis (RCA)
1. **Background Noise Contaminating Laya System 1 Tool Routing:**
   `layaEngine.routeAgentAction` passed `User Goal + Active Page Context (400 chars)` into `predictDecision`. Background page words ("button", "toggle", "interactive", "form") matched criteria for `browse`, artificially inflating its score over `final` (Direct Answer) by +72% margin even for purely informational questions like "who is john ??".
2. **Missing Question Intent Classification in Escalation Manager:**
   `escalationManager.ts` only evaluated `isActionIntent` (which looked for action keywords like `open`, `click`, etc.). When `isActionIntent` was false, Tier 1.5 blindly handed queries to `layaEngine.routeAgentAction`, which selected `browse`.
3. **Empty Action Parameters Defaulting to Snapshot:**
   When `layaDecision.selectedTool` was `"browse"`, `escalationManager` emitted `{ selector: "body" }` without an action, causing `agentHarness.primitiveBrowse` to default to `action: "snapshot"` and dump raw accessibility tree indices (`[1] button "Toggle Theme"`).
4. **Unconditional Observation Echoing (`hasObservation`):**
   When `agentHarness` completed step 1, `escalationManager` received `hasObservation = true` and unconditionally returned `{ final: lastObservation }`, causing raw internal DOM inspection strings to be printed directly into the user chat interface.
5. **Cold Extractive Q&A Output in `pageQA.ts`:**
   When queries had zero term matches, `answerFromPage` returned technical debug dumps (`Controls: 14 buttons, 22 links; Method: BM25...`) instead of an empathetic, conversational, grounded clarification.

## Fixes Implemented
1. **Direct Q&A Fast Path (`escalationManager.ts`):**
   - Added `isQuestionOrInfoIntent` to detect questions (`who`, `what`, `where`, `when`, `why`, `how`, `is`, `are`, `tell me`, `?`).
   - If `isQuestionOrInfoIntent` is true, Tier 1.5 routes directly to `answerFromPage` with high-confidence grounded retrieval (<15ms).
   - In `hasObservation`: guarded against raw DOM snapshot leakage (`[1] button "Toggle Theme"`) and sanitized responses.
2. **Isolated Tool Choice State (`layaEngine.ts`):**
   - In `routeAgentAction`: immediately routed questions to `selectedTool: "final"`.
   - Constrained `predictDecision` state to `Goal: "${userGoal}"`, completely eliminating background page text interference from tool choice classification.
3. **Relevance Thresholding & Human Conversational Fallback (`pageQA.ts`):**
   - Filtered spurious low-confidence hits (`semantic < 0.35 && lexical < 1.2`).
   - For queries with no matches (e.g. "who is john ??"), returned a clear, polite explanation:
     "I searched the current website, but found no mention of "john". This site is Paul's Portfolio... If you are looking for a specific project, skill, or contact info, feel free to ask!"
4. **Harness Response Sanitization (`agentHarness.ts`):**
   - Added regex and prefix guards to `cleanFinal` to prevent any raw accessibility tree indices (`[1] button ...`) from ever leaking into user-facing chat output.
