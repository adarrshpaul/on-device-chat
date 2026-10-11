# OKF Fact: Canvas Game Interaction Gap & LightOnOCR-3-0.8B Integration Status

- **Date**: 2026-10-11T14:28:00Z
- **Author**: Antigravity Pair Programming Agent
- **Entity**: `on-device-chat` / `agentHarness`
- **Layer**: `current`
- **Status**: `gap_identified`

## 1. LightOnOCR-3-0.8B Integration Status
- **Status**: **NOT INTEGRATED** in runtime code.
- **Context**: LightOnOCR-3-0.8B was evaluated on 2026-10-10 as an architectural proposal (`okf/facts/2026-10-10-final-decision-canvas-grounding-lighton-ocr.md`) for potential canvas bounding box regression.
- **Codebase Reality**: Zero lines of code exist in `frontend/src/` integrating LightOnOCR. `VisionService.ts` currently contains only standard image fallbacks.
- **Blockers to Direct Client Bundling**:
  - Model weights: ~450MB–1.6GB (prohibitive for the lightweight 540KB `on-device-chat` bundle).
  - No thinking/deliberation: LightOn AI explicitly disabled reasoning/CoT in the chat template; it only outputs bounding boxes.

## 2. Canvas & Real-Time Game Capability Gap
- **Identified Failure Mode**: When navigating canvas-heavy applications (e.g. `basketball.paulcreates.online`, Phaser 3, WebGL, 3D canvas):
  1. `A11yTreeEngine` perceives only an opaque `<canvas>` element with zero DOM children.
  2. The assistant's ReAct loop is discrete and turn-based (latency ~500ms–2000ms), while real-time games require 60Hz continuous frame tracking and physics-informed sub-second action timing.
- **Test Demonstration vs. Agent Reality**:
  - The Basketball Bash automation was executed by an external Node.js/Playwright physics script (`test_full_game_high_score.mjs`), scoring 43 points on Phaser Matter.js physics.
  - The actual user-facing widget (`ChatWidget` / `agentHarness`) had 0% agency over the game.
- **Required Architecture for Real-Time Canvas Agency**:
  - Expose a Canvas / Game Engine hook tool (`inspectCanvasGame`) that detects runtime engines (Phaser, Three.js, Pixi) and connects the assistant to canvas state.
  - Introduce an autonomous continuous control loop (`runCanvasController`) allowing the assistant to execute high-frequency game actions on behalf of the user.
