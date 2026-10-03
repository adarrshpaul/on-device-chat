---
type: event
timestamp: 2026-10-03T04:26:00Z
entity: chat-widget
---

# Event: Root Cause Analysis and Fix for Indefinite "Auditing..." Loop

- **Symptom Reported**: When clicking "Audit All" in the Expert Judge Studio, the button spun indefinitely on "Auditing..." and never stopped.
- **Root Cause Analysis (RCA)**:
  1. *Unbounded Awaiting on Chrome LanguageModel*: In `expertJudge.ts`, the judge checked `if (lm)` and immediately called `await lm.create(...)` and `await session.prompt(...)` without an explicit timeout or checking `availability() === "readily"`.
  2. *Chrome Model Download/Session Stall*: In Chromium, when `#prompt-api-for-gemini-nano` is present but the weights are not downloaded locally (`availability` returns `"after-download"`, `"downloading"`, or `"no"`), `lm.create()` initiates a slow 1.5 GB background download or stalls the promise indefinitely without resolving.
  3. *Unbounded Batch Iteration*: In `useChat.ts`, `runBatchJudge` looped sequentially across all traces without per-trace try/catch boundaries, timeouts, or incremental UI updates. A hang on trace 1 locked the entire batch, keeping `isJudging = true` indefinitely.
- **Resolution**:
  1. **Fail-Safe Timeout Engine**: Added generic `withTimeout<T>(promise, ms, fallback)` utility in `expertJudge.ts`.
  2. **Pre-flight Availability Gate**: Wrapped `lm.availability()` in an 800ms check. If availability is not `"readily"`, the judge immediately skips to the deterministic offline rubric engine without hanging on gigabyte downloads.
  3. **Strict Session & Prompt Timeouts**: Enforced 2500ms timeout on `lm.create()` and 3000ms timeout on `session.prompt()`, ensuring session disposal in `finally`.
  4. **Incremental Batch Execution**: In `useChat.ts`, `runBatchJudge` now processes each trace within isolated try/catch boundaries and calls `refreshEvalsData()` after each trace completes, providing real-time progress and guaranteeing `setIsJudging(false)` in `finally`.
