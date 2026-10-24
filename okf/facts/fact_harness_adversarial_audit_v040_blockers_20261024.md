---
id: fact_harness_adversarial_audit_v040_blockers_20261024
entity: agent_harness
property: release_readiness_v040
layer: fact
status: verified
valid_from: 2026-10-24
valid_to: infinity
author: claude-code
trust: code-read + node check of isFailureObservation; npm test exit 0, build clean (all suites green — tests do not cover the defects below)
---

# Adversarial harness audit: 0.4.0 stable is NOT ready

## Release blockers (verified in code)
1. §7: hardcoded confidence/"hallucinationShield verified" literals shown by DecisionCard as "Calibrated Confidence" / "P(true)":
   agentHarness.ts:1114-1134 (1.0/0.88, "0 hallucination risk"), :1317-1337 (0.94/0.72, verified:true, nothing verifies);
   escalationManager.ts:464-477, 581-592, 643, 763-774, 824-831, 928-941, 1093-1104, 1174-1180, 1321-1328, 1507-1514, 1531-1539.
2. TodoManager.createPlan has no production caller (only todoManager.ts:40 def; PlannerAgent unused). Plan checklist, approval gate, update_task line are dead in prod. Same defect flagged 09:30, reported fixed by TASK-117.
3. isFailureObservation (agentHarness.ts:61) treats `Error executing tool "x": ... timed out` and `Action blocked by Safety Gate: ...` as SUCCESS (verified via node). Also false-positives on page text containing "not found".
4. Cycle detector (agentHarness.ts:1430-1466) returns last observation as `final` after 2 zero-delta repeats = reports success when nothing changed.
5. 8s Promise.race (1404) does not cancel the tool; abort only checked at loop top -> late mutations after timeout/Stop.
6. Nav resume (useChat.ts ~340) calls sendMessage(userGoal) = restarts from step 0 although navPersistence stores stepIndex/trajectory -> repeated mutations.

## High-severity weaknesses
- Compaction (1583-1591) keeps messages[1]; with prior history that is the context block, so Task Goal + initial a11y list are dropped.
- Grounding: A11y scan once (viewport, 24 items) at start, never refreshed; numeric IDs go stale.
- sampleBestOfN k=2 re-calls same prompt (no diversity on deterministic tiers); predictText runs executeSiteTour as a side effect outside executeTool/SafetyGate; a predictor error becomes a user-visible `final`.
- predictText goal regex `["']([^"']+)["']` truncates goals containing apostrophes.
- Tier 0/1 "model" is mostly regex routing in escalationManager.predictText.
- Synthetic pressEnter keydown will not trigger form submission; contenteditable path sets innerText (ignores clearFirst, breaks ProseMirror/Lexical).
- Macro auto-compile saves whole trajectory incl. earlier failed steps; replay success = absence of failure substrings.
- Progress UI: onStepProgress(step, tool, obs) only; useChat fills args:{}, durationMs:0; ChatWidget shows "Thinking..." + last tool. Thinking extracted at 1549 never reaches UI; predictor is non-streaming.

## Proposed (not implemented)
RunEvent stream + RunTimeline accordion; per-step postconditions/verifier; re-grounding per step; real benchmark subset before any "best agent" claim.
