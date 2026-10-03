---
type: state
valid_from: 2026-10-03T03:00:00Z
valid_to: 2026-10-03T03:50:00Z
learned_at: 2026-10-03T03:00:00Z
layer: history
trust: machine-confirmed
---

# State: Universal Agent Harness with Chrome AI Expert Judge & Evaluation Loop

1. **Harness vs. Model Separation**:
   - The model is strictly a frozen text function emitting structured JSON tool decisions (`{ tool: "browse", args: { ... } }` or `{ final: "..." }`).
   - The host harness wraps the model, providing the loop, the memory, permission checks, and cycle breakers.
2. **Five Canonical Primitives**:
   - `read` / `write` / `edit`: Scratchpad notes and state memory in IndexedDB.
   - `sandbox`: Sandboxed JavaScript evaluation without direct DOM tampering.
   - `browse`: Universal DOM inspector, accessibility tree snapshots, element clicks, form typing, and extraction.
   - `search`: In-page full-text search and element matching.
   - `ask`: Halts loop to request human confirmation or input.
3. **Chrome AI Expert Judge & Alignment Dataset**:
   - Automatically logs execution traces `(userGoal, trajectory, finalOutput, feedback, activeTier)` into IndexedDB.
   - Computes statistical metrics beyond the luck floor: Accuracy, Precision (target class = FAIL), Recall, F1, and **Cohen's Kappa (κ)**.
   - Batch judging via Chrome Built-in AI (`LanguageModel`) at temperature 0 using official rubric criteria.
4. **Harness Self-Enhancement Loop**:
   - Stores verified golden exemplars for each site domain.
   - Compiles repeated multi-step agent actions into zero-latency, zero-token deterministic site macros (`recipeStore`).
