---
id: fact_openharness_concepts_and_thinking_state_fix
layer: current
valid_from: 2026-10-11T02:08:00Z
valid_to: null
tags:
  - openharness
  - bugfix-thinking-state
  - watchdog-timer
  - context-window-compaction
  - production-deployment
---

# Fact: OpenHarness Architecture Absorption & In-Flight Thinking State Resilience Fix

## Summary
1. **Clarification on Ornith-9B Model Deployment**:
   - `Ornith-1.5-9B` is maintained in `local-agent-harness` as an Apple Silicon / Python fine-tuning pipeline (`ling_ornith_pipeline.py`, `docs/ornith-9b-finetuning-plan.md`).
   - The public site at `agent.paulcreates.online` is a Cloudflare Pages static edge application running the client-side browser harness (Gemini Nano, Vega Decision Engine, MiniLM, and SmolLM2 via ONNX / WebLLM), not the local Python Ornith-9B weights.

2. **Root Cause Analysis (RCA): Widget Stuck in "Thinking..." State**:
   - **RCA 1 (Missing `try/finally` around workflow execution)**: `runSavedWorkflow()` in `useChat.ts` called `await workflowRunner.runWorkflow(wf)` without a `try/finally` block. If `recordExecution()` or an error occurred during or after step observation, `setIsLoading(false)` was skipped, leaving the widget permanently locked in the thinking state.
   - **RCA 2 (Uncaught promise in post-workflow recording)**: `workflowRunner.ts` had unhandled promises in `workflowStore.recordExecution(workflow.id)`. Any IndexedDB exception aborted the step return.
   - **RCA 3 (Lack of Watchdog & Manual Stop Control)**: If an animation or scroll pause took longer than expected, there was no watchdog timer to auto-recover the UI, nor was there a manual cancel button in the thinking state indicator.

3. **OpenHarness (`HKUDS/OpenHarness`) Architecture Concepts Incorporated**:
   - **Bounded Tool Execution (`ToolExecutionContext`)**: OpenHarness wraps every tool with strict timeouts. Applied an 8s watchdog to `executeTool` in `agentHarness.ts` and 10s watchdog to `executeStep` in `workflowRunner.ts`.
   - **Auto-Compacting Context Bounding (`MAX_TRACKED_USER_GOALS = 5`)**: When conversation history grows, older user goals are compressed into a compact `# Prior User Goals: [...]` index while keeping recent turns verbatim, preventing small on-device models from hitting context limits.
   - **UI Recovery Watchdog & Interactive Stop**: `ChatWidget.tsx` now has a 25s auto-watchdog that automatically releases `isLoading` if an action ever hangs, and a prominent `Stop` button next to `Thinking...` so users can abort in-flight execution at any time.

4. **Production Deployments Verified**:
   - `cloudfare-portfolio-app`: Deployed to `https://7444eeb3.cloudfare-portfolio-app-41v.pages.dev` (`paulcreates.online`).
   - `local-agent-harness`: Deployed to `https://2bbf8a5b.local-agent-harness.pages.dev` (`agent.paulcreates.online`).
   - Resilient workflow completion verified with automated test (`Workflow run result: SUCCESS Steps completed: 4`).
