---
type: event
timestamp: 2026-10-03T03:00:00Z
entity: chat-widget
---

# Event: Implemented Universal Agent Harness, Five Primitives, and Chrome AI Expert Judge

- Created `frontend/src/lib/agentHarness.ts`: decoupled harness loop wrapping frozen models with 5 canonical primitives (`browse`, `sandbox`, `read/write`, `search`, `ask`), context compaction via `mem://` references, and cycle detection.
- Created `frontend/src/lib/expertJudge.ts`: Chrome AI Expert Judge rubric evaluator computing Accuracy, Precision, Recall, F1, and Cohen's Kappa (κ) with qualitative interpretation bounds.
- Created `frontend/src/lib/recipeStore.ts`: Dynamic few-shot golden exemplar store and deterministic site macro compiler.
- Integrated harness telemetry and Evals Studio into `useChat.ts` and `ChatWidget.tsx`.
- Updated host app demo in `index.html` with interactive catalog and live app state telemetry.
