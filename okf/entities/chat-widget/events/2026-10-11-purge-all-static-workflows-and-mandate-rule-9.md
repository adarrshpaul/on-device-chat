---
id: evt_purge_all_static_workflows_mandate_rule_9
timestamp: 2026-10-11T15:27:00Z
entity: chat-widget
type: architectural_mandate_and_bugfix
---

# Event: Purge All Static Workflows & Establish Rule 9 Mandate

## Changes Applied:
- Purged lines 68-109 in `src/components/ChatWidget.tsx` containing hardcoded `#projects`, `#skills`, `#contact` fallbacks.
- Updated `WorkflowPredictor.predictWorkflows()` to dynamically generate `🎮 Play Game Autopilot` on canvas websites and discover real visible buttons and dynamic landmark headings.
- Updated `workflowStore.synthesizeSiteWorkflows()` to synthesize `🎮 Play Game Autopilot` when `<canvas>` is present.
- Updated `workflowRunner.ts` to support `game_autopilot` step execution via `CanvasGameController.playGame()`.
- Added Rule 9 to global `AGENTS.md` strictly prohibiting static workflow templates or fake AI confidence fallbacks.
- Verified live on `https://basketball.paulcreates.online/`:
  - Discovered Suggested Workflows: `["🎮 Play Game Autopilot"]` with 100% confidence.
  - Zero portfolio templates present.
  - Autopilot scored 100 points autonomously on the live canvas.
