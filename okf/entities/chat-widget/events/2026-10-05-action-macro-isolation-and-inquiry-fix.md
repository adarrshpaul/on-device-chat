---
event_id: 2026-10-05-action-macro-isolation-and-inquiry-fix
entity: chat-widget
timestamp: 2026-10-05T12:20:00+05:30
author: Antigravity
status: completed
---

# Event: Action Macro Isolation and Capabilities Inquiry Routing Fix

## Root Cause Analysis
Users asking *"What actions can you perform on this page?"* received:
`Executed verified site recipe for "What actions can you perform on this page?" (2 steps).`
instead of an explanation of available page actions.

The root causes were:
1. **Blind Trajectory Compilation**:
   In `AgentHarness.runLoop()`, any successful multi-step execution (`trajectory.length >= 2`) was unconditionally saved into `recipeStore` as a deterministic site macro, even when the user's intent was an informational question.
2. **Overly Permissive Substring Matching**:
   In `recipeStore.findMatchingMacro()`, matching used loose bidirectional substring checks (`normalizedGoal.includes(r.triggerPhrase) || r.triggerPhrase.includes(normalizedGoal)`). When a question shared words with any past trajectory, it intercepted the question in 18ms and replayed arbitrary DOM actions.
3. **Missing Capabilities Inquiry Matcher**:
   `escalationManager.ts` lacked a specific regex for *"what actions can you perform"*, allowing the question to fall through to the harness macro runner.

## Architectural Resolution
1. **Action Goal Guard (`isActionGoal`)**:
   - Implemented `isActionGoal` in `recipeStore.ts`.
   - Rejects any query ending in `?` or beginning with inquiry words (`what`, `how`, `why`, `where`, `can you`, `tell me`, `list actions`).
   - Requires physical action verbs (`click`, `open`, `navigate`, `scroll`, `toggle`, `type`, `tour`).
2. **Exact Action Trigger Matching (`recipeStore.ts`)**:
   - Replaced substring checks with strict exact matching (`normalizedGoal === r.triggerPhrase`).
   - Filters out non-action goals in both `findMatchingMacro()` and `saveMacroRecipe()`.
3. **Physical Tool Mutation Requirement (`agentHarness.ts`)**:
   - Only trajectories containing actual DOM mutations (`click`, `type`, `scroll`, `navigate`, `tour`) are eligible for macro compilation.
4. **First-Class Actions Inquiry Handler (`escalationManager.ts`)**:
   - Added `isActionsInquiry` matching *"what actions can you perform on this page"*, *"what can you do here"*, and *"available actions"*.
   - Returns a structured markdown overview of all live capabilities:
     - Theme Control (`toggle theme`)
     - Guided Site Tour (`site tour`)
     - Landmark Navigation (`open projects`, `go to experience`, `open synth`, `contact`)
     - DOM Element Control
     - Associative Engram Recall (`where is ...`, `help me remember ...`)
     - Local Math & Sandbox
5. **E2E Playwright Verification (`test_actions_inquiry.mjs`)**:
   - Verified on `http://127.0.0.1:4300/`: Query `"What actions can you perform on this page?"` returned the full capabilities breakdown with `isMacro: false` (100% PASSED).
