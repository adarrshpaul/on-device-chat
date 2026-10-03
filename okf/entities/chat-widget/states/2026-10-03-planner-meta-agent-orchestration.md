---
type: state
valid_from: 2026-10-03T07:15:00Z
learned_at: 2026-10-03T07:15:00Z
layer: current
trust: machine-confirmed
---

# State: Planner-Agent & Meta-Agent Orchestration Architecture

1. **Two-Tier Agentic Decomposition**:
   - **Planner Agent (`PlannerAgent`)**: Decomposes high-level or ambiguous user goals into ordered `PlanTask` units classified by type (`action` vs `reasoning`). Employs single-task fallback for simple instructions and JSON schema decomposition for multi-stage goals.
   - **Meta-Agent (`MetaAgent`)**: Orchestrates plan execution state (`pending` $\to$ `in_progress` $\to$ `completed` / `failed`), manages inter-task context transfer, routes tasks between execution engines, and intercepts failure conditions.
2. **Specialized Task Execution Engines**:
   - **Action Tasks (`type: "action"`)**: Dispatched to `AgentHarness` in bounded sub-sprints (default: 4 steps per subtask) rather than a monolithic 10-step runaway loop.
   - **Reasoning Tasks (`type: "reasoning"`)**: Executed via Chain-of-Thought (CoT) without DOM or tool side-effects, saving token and step latency.
3. **Dynamic Replanning on Roadblocks**:
   - If an action subtask hits a terminal failure (e.g., product out of stock, unresolvable element), the `MetaAgent` invokes `PlannerAgent.replan()` to adjust remaining tasks dynamically rather than looping on dead selectors.
4. **Clean Integration & Universal Bundle**:
   - Fully integrated and exported from `src/index.ts` alongside `AgentHarness` and `expertJudge`.
   - Multi-target builds (Vite ESM, CJS, and standalone minified IIFE) verify 100% type safety and zero bundle regressions.
