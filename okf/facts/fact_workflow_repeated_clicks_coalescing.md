---
id: fact_workflow_repeated_clicks_coalescing
subject: workflow-runner-and-studio
predicate: repeated-clicks-coalescing-and-stepper
valid_from: 2026-10-12T03:00:00Z
valid_to: null
confidence: 1.0
source: claude-p-consultation-and-e2e-playwright-verification
---

# Fact: Repeated Clicks Coalescing and Sequential Execution

When users click interactive elements (e.g., "Add to Cart") repeatedly during workflow creation or recording:
1. **Schema Support**: `WorkflowStep` supports `repeatCount?: number` (up to 50) and `repeatIntervalMs?: number` (default 400ms).
2. **Recorder Coalescing**: `MacroRecorder` resolves clicks to nearest clickable ancestor (`button, a, [role='button']`) and coalesces rapid repeated clicks within a 2500ms window into a single step with `count = (last.count || 1) + 1`.
3. **Studio Stepper UI**: `WorkflowStepEditor` renders a compact `Repeat: [−] N [+] times · every 400 ms` stepper when the step action is `click`. Picking the same element consecutively in `WorkflowStudio` merges into `repeatCount + 1`.
4. **Resilient Sequential Execution**: `WorkflowRunner` loops `1..repeatCount`, dynamically re-acquires the element via `reacquireClickable` to handle SPA DOM node recreation and transient `aria-busy`/`disabled` states up to 3000ms, and pauses `repeatIntervalMs` between clicks. Watchdog timeouts scale with repeat count.
