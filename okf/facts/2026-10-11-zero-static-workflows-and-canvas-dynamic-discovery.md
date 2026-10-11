---
id: fact_zero_static_workflows_canvas_dynamic_discovery
layer: current
valid_from: 2026-10-11T15:27:00Z
valid_to: null
confidence: 1.0
provenance: "Empirical Playwright browser test on basketball.paulcreates.online and source audit"
---

# Fact: Zero Static Workflows & In-Memory Dynamic Adaptation Mandate

## Root Cause of Hardcoded Workflow Suggestions
In `src/components/ChatWidget.tsx` (lines 68-109), an outdated fallback block existed:
```ts
if (list.length === 0) {
  const fallbacks = [
    { name: "🗺️ Guided Interactive Tour", target: "#home", "#projects", "#skills", "#contact" },
    { name: "🚀 Deep Dive Key Projects", target: "#projects" },
    { name: "✉️ Quick Contact & Connect", target: "#contact" },
  ];
  fallbacks.forEach(w => list.push({ workflow: w, confidence: 0.94, isPredicted: true }));
}
```
Whenever a user visited an external website without matching landmarks (e.g., `https://basketball.paulcreates.online/`, Amazon, SauceDemo), `list.length === 0`, causing the widget to inject these 3 hardcoded portfolio workflows and deceive users with an "AI Predicted (94%)" label.

## Resolution & Structural Fixes
1. **Complete Purge:** Removed all static fallback arrays, hardcoded `#home`, `#projects`, `#skills`, `#contact` selectors, and fake 0.94 confidence scores from `ChatWidget.tsx`.
2. **Honest Empty State:** When `displayWorkflows.length === 0`, render an honest empty state prompt: "No Pre-built Workflows for This View. Record any custom workflow in seconds, or use Teach 1 → Batch N".
3. **100% Dynamic Discovery in `WorkflowPredictor` & `workflowStore`:**
   - Interactive Canvas: If a canvas exists (e.g. basketball game), dynamically synthesize `🎮 Play Game Autopilot` (`action: "game_autopilot"`, target `canvas`).
   - Interactive Buttons: Inspect visible action buttons (`play`, `start`, `launch`, `add to cart`, `search`, etc.) and derive clean labels from actual DOM element text.
   - Landmarks: Derive section workflow titles dynamically from physical `h1-h4` text or element IDs.
   - Downloads & Forms: Extract labels dynamically from verified anchor tags and input elements.
4. **Execution Engine Parity:** `workflowRunner.ts` now supports `game_autopilot` step action, invoking `CanvasGameController.playGame()` directly.
5. **Rule 9 Formally Established:** Added Rule 9 ("Zero Static Workflows & In-Memory Dynamic Adaptation Mandate") to global `AGENTS.md`.
