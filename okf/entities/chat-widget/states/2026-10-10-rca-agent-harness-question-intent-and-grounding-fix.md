# State: Robust Question Intent Routing, Background Noise Immunity & Grounded Q&A

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** historic
- **Version:** `0.1.9`
- **Status:** Superceded
- **Valid_from:** 2026-10-10T05:37:00Z
- **Valid_to:** 2026-10-10T06:08:00Z

## Summary
The on-device agent harness and escalation manager implement a strict partition between informational/knowledge questions (`isQuestionOrInfoIntent`) and browser automation commands (`isActionIntent`). Pure questions route directly to grounded page knowledge retrieval via `answerFromPage` without invoking DOM automation tools (`browse`). Background page DOM text is excluded from Laya System 1 tool classification state to prevent keyword contamination. Requisite thresholding filters out spurious low-similarity matches, and queries with missing terms produce helpful, human-like summaries of the site rather than technical debug dumps or raw accessibility tree snapshots.

## Active Invariants & Rules
1. `Question vs Motor Action Partition`: Informational questions (who, what, where, when, why, how, is, are, tell me, ?) never route to DOM automation primitives (`browse`). They invoke grounded Q&A with extractive evidence or generative synthesis.
2. `State Purity in Tool Routing`: `layaEngine.routeAgentAction` evaluates `Goal: "${userGoal}"` in isolation, preventing words in host page text from artificially inflating tool scores.
3. `Observation Hygiene`: Observations returned to `escalationManager` that begin with `[1]` or contain raw accessibility tree text are intercepted and sanitized before presentation to the user.
4. `Relevant Grounding Threshold`: Passages must satisfy `semantic >= 0.35` or `lexical >= 1.2` to be considered matches; queries with no qualifying matches generate clear, empathetic clarifications detailing site scope.
5. `Zero Fraud & Trace Integrity`: Decision traces reflect real, unmanipulated telemetry from the executing engine without synthetic distributions.
