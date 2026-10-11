# Prompt for Claude Code: Diagnosing & Solving Repeated Clicks ("Click 3 Times, Runs 1 Time") in EdgeOperator Workflows

## Context & Problem Statement
In **EdgeOperator** (`on-device-chat`), the user reports this critical issue:
> "right now clicking on add to cart 3 times, but when running workflow only 1 time. fix this issue please. also ask claude to suggest UI and proper workflow integration."

### The User Scenario
The user performs an action like clicking "Add to cart" (or an increment `+` button, or repeated OT switch toggle) **3 times**.
However, when the workflow runs, it only executes **1 time**.

---

## Code Investigation in the Repo

### 1. `WorkflowStep` Definition (`frontend/src/lib/types.ts`)
```ts
export interface WorkflowStep {
  id: string;
  title: string;
  action: "tour" | "click" | "scroll" | "type" | "select" | "teleport" | "wait" | "verify" | "game_autopilot";
  target?: string;
  value?: string;
  pressEnter?: boolean;
  delayMs?: number;
  status?: "idle" | "running" | "success" | "error";
  output?: string;
}
```
Notice: There is **NO `repeatCount` / `iterations` / `count`** property on `WorkflowStep`. A step only knows how to execute once.

### 2. `MacroRecorder.ts` Recording Logic
When a user records a macro:
```ts
private static handleClick = (e: MouseEvent) => {
  if (!MacroRecorder.session || !MacroRecorder.session.isActive) return;
  const target = e.target as HTMLElement;
  if (!target) return;
  if (isWidgetElement(target) || target.closest("#g4-macro-recorder-banner, #eo-macro-recorder-banner")) return;

  MacroRecorder.recordAction(target, "click");
};
```
And in `compileActionsToSteps(actions: RecordedDomAction[])`:
If the user clicks "Add to cart" 3 times:
- Does it generate 3 separate steps with the same target?
- Or if the target changes (e.g. button state / text / React re-render), what happens?

### 3. `WorkflowRunner.ts` Execution Logic
```ts
case "click": {
  const target = step.target;
  if (!target) throw new Error("Missing click target");
  const el = smartQuerySelector(target);
  if (!el) throw new Error(`Target "${target}" not found`);

  spotlightElement(el, step.title || `Click: ${target}`);
  await this.sleep(300);
  await ActionDispatcher.click(el);
  await this.sleep(800);
  const dt = Math.round(performance.now() - t0);
  return `Clicked element <${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}> (${dt}ms)`;
}
```

### 4. Why Repeated Clicks Fail or Drop During Replay in Modern Web Apps:
1. **Virtual DOM Node Replacement:** In React/Vue/Angular/Shopify SPAs, clicking "Add to cart" triggers a state update that replaces or re-renders the button DOM node (or updates its attributes, e.g. text from "Add to Cart" to "Added!" or disabled during network request).
   If there are 3 separate steps:
   - Step 1 clicks `button 'Add to cart'`. The button text changes or gets disabled, or the cart drawer opens with a backdrop!
   - Step 2 tries `smartQuerySelector("button 'Add to cart'")` -> FAILS or is blocked!
2. **Missing `repeatCount` on Step:** Neither `WorkflowStudio` nor `WorkflowStep` has a repeat count. If a user wants to buy 3 of an item, or click an increment button 3 times, they have no first-class UI to say `Repeat: 3x`.
3. **Macro Recorder Fragmentation vs Coalescing:** If a user clicks the same button 3 times in quick succession during demonstration:
   - Should `MacroRecorder` coalesce consecutive clicks on the same element into a single step with `repeatCount: 3` (e.g. `Click "Add to cart" (3x)`)?
4. **Playback Execution of Repeated Clicks:**
   - If a step has `repeatCount: 3`, how should `WorkflowRunner` execute it?
   - Should it re-query the target element before each repeated click?
   - Should it wait for button re-enabling or brief debounce pause (`repeatIntervalMs = 400ms`) between clicks?

---

## What We Need from Claude Code
Please provide an architectural and implementation specification addressing:

1. **Root Cause Analysis:** Why did clicking "Add to cart" 3 times result in only 1 click during playback?
2. **Schema & Engine Updates:**
   - How should `WorkflowStep` in `types.ts` support repetition? (e.g., `repeatCount?: number`, `repeatIntervalMs?: number`).
   - How should `WorkflowRunner.ts` execute repeated clicks with resilient DOM re-querying and interval pacing?
   - How should `MacroRecorder.ts` intelligently detect and coalesce consecutive clicks on the same element into a single step with `repeatCount`?
3. **Workflow Studio UI (`WorkflowStepEditor.tsx` & `WorkflowStudio.tsx`):**
   - How to present the repeat count in the UI cleanly in our 380px panel?
     (e.g., a compact `1x` / `2x` / `3x` / `Nx` counter pill or multiplier input next to the Action/Target, or a "Repeat" field for Click/Type actions).
   - Displaying `(3x)` badge in the step list and workflow preview cards.
4. **Exact Code Changes:**
   - Provide concrete TypeScript / React code for `types.ts`, `workflowRunner.ts`, `macroRecorder.ts`, and `WorkflowStepEditor.tsx`.
