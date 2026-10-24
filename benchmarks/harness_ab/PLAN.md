# Harness A/B benchmark: on-device-chat 0.3.0 vs 0.4.0 (pre-registered 2026-10-25)

**Question:** with the SAME model, does the 0.4.0 harness complete real web tasks more often than 0.3.0?

**Versions**
- A = npm `on-device-chat@0.3.0` tarball, `dist/edge-operator.min.js`
- B = commit `9e58152` (v0.4.0), built in a clean worktree with `npm ci && npm run build`
- Bundle SHA-256s are recorded in each run manifest.

**Model:** OpenRouter `google/gemma-3-4b-it`, temperature 0, max_tokens 600. The same for both versions. This is a small model close in size to the on-device ones, but it is served remotely. **This measures the harness, not the on-device runtime.**

**Execution**
- The bundle is injected with Playwright (`bypass_csp`, widget mode). Then `new EdgeOperator.AgentHarness({maxSteps: 12}).runLoop(goal, predictor)` runs with each version's defaults.
- Fresh browser context per run (no IndexedDB/localStorage carry-over). Run timeout 240 s.
- Order alternates per repetition (A,B then B,A). 10 tasks × 5 reps × 2 versions = 100 runs.
- If a page navigation ends the run, the checker still runs on the resulting page.

**Not measured**
- trusted CDP input (extension only);
- on-device model speed;
- latency differences (the machine is busy with another job).

**Scoring (fixed before running)**
- success = the task checker passes (page state, or the final answer for 2 read tasks);
- false completion = the agent returned a final answer but the check failed;
- infra failure = the provider or browser failed after 3 retries. Excluded from the denominators, but reported.

**Reporting**
- Per version: successes / valid runs, with 95% Wilson intervals.
- Per task: a paired comparison (A vs B successes).
- False-completion counts.
- No claims beyond the intervals. Overlapping intervals are reported as "no detectable difference".
