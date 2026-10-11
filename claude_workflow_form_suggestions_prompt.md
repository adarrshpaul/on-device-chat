# Prompt for Claude Code: Designing the Professional Form & Element Suggestion System for EdgeOperator Workflow Studio

## Context & Problem Statement
We are building **EdgeOperator** (`on-device-chat`), an on-device local-first AI web copilot and workflow automation engine designed for Web-Based Management (WBM), e-commerce, and repetitive web workflows.

The user encountered a major UX and functional issue in the **Workflow Studio** (`WorkflowStudio.tsx`), where users create and edit multi-step automation workflows.

### The Screenshot Issue (Uploaded by User)
In the workflow step builder:
- **Trigger Keyword (Optional):** `add to cart`
- **Execution Steps (1)** -> Step 1
- **Action:** Selected as `type`
- **Target / Selector:** A raw text input displaying `projects`
- **Missing Value:** There is **NO** input field for the text/value to type! When `type` is selected, the user has no way to specify what text should actually be typed into the element!
- **Cryptic CSS Selectors & No Suggestions:** The user is expected to manually write CSS selectors like `projects` or `#about`.
- **User Feedback:**
  > "what should we type looks like a UI issue we must show suggestions actual suggestion formulate forms from the webpage and enhance UI ask claude how to do it in the best professional way"

---

## Current Implementation in `WorkflowStudio.tsx`
Lines 361–390 of `WorkflowStudio.tsx`:
```tsx
<div className="grid grid-cols-2 gap-1.5">
  <div>
    <label className="text-[9px] text-gray-400 block">Action</label>
    <select
      value={step.action}
      onChange={(e) => handleUpdateStep(idx, { action: e.target.value as any })}
      className="w-full bg-[#111626] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none"
    >
      <option value="scroll">scroll</option>
      <option value="teleport">teleport (engram)</option>
      <option value="click">click</option>
      <option value="type">type</option>
      <option value="verify">verify (noul)</option>
      <option value="wait">wait</option>
    </select>
  </div>

  <div>
    <label className="text-[9px] text-gray-400 block">Target / Selector</label>
    <input
      type="text"
      value={step.target || ""}
      onChange={(e) => handleUpdateStep(idx, { target: e.target.value })}
      placeholder="#about, projects"
      className="w-full bg-[#111626] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none"
    />
  </div>
</div>
```

And in `types.ts`:
```ts
export interface WorkflowStep {
  id: string;
  title: string;
  action: "tour" | "click" | "scroll" | "type" | "teleport" | "wait" | "verify" | "game_autopilot";
  target?: string;
  value?: string;
  delayMs?: number;
  status?: "idle" | "running" | "success" | "error";
  output?: string;
}
```

And in `workflowRunner.ts`:
```ts
case "type": {
  const target = step.target;
  if (!target) throw new Error("Missing input target");
  const el = smartQuerySelector(target) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) throw new Error(`Input "${target}" not found`);

  spotlightElement(el, step.title || `Type: ${target}`);
  await this.sleep(350);
  await ActionDispatcher.type(el, step.value || "");
  await this.sleep(800);
  const dt = Math.round(performance.now() - t0);
  return `Typed "${step.value}" into ${target} (${dt}ms)`;
}
```

---

## Architectural & Rule Invariants
1. **Rule 9 (Zero Hardcoded Selectors & Dynamic Discovery Mandate):**
   - NEVER hardcode `#projects`, `#about`, `#contact`, or static placeholders.
   - All suggestions must be dynamically discovered from the live active DOM (excluding `.eo-widget-container` / `.g4-widget-container`).
2. **380px Panel Budget:**
   - The UI is housed in a 380px floating obsidian-glass container.
   - Components must be compact, responsive, high-density, and clean.
3. **No External Libraries:**
   - Use standard React, Tailwind CSS, and `lucide-react` icons already installed in the repo.

---

## What We Need from Claude Code
Please provide an architectural and implementation specification addressing:

1. **DOM Form & Interactive Element Discovery Engine (`pageFormExtractor.ts` or similar):**
   - How should we dynamically scan the live page to extract:
     - Form inputs (`<input>`, `<textarea>`, `<select>`) with clean human-readable labels, element types, placeholders, current values, and resilient CSS selectors.
     - Clickable controls (buttons, links) with text and context.
     - Entire `<form>` structures or settings blocks for 1-click form workflow synthesis.
2. **Workflow Studio Step Editor Redesign:**
   - When Action is `type`:
     - How should the Target Selector be presented? (e.g. searchable Combobox / Dropdown listing live page inputs with icons + label + selector + "custom" input).
     - How should the "Value to Type" field be designed? (Clear input with contextual suggestion pills like placeholder, current value, or batch variables `{{value}}`).
   - When Action is `click`:
     - Target Selector suggests detected buttons (e.g. "Add to Cart", "Apply", "Save", "Submit").
   - When Action is `select`:
     - Target Selector suggests `<select>` elements, and Value suggests the options available in that dropdown.
3. **"🎯 Pick Element from Page" Live Inspector Tool:**
   - How to implement a point-and-click element inspector that lets the user click any element on the webpage to automatically fill the Target and Action.
4. **"✨ Formulate Form from Page" (1-Click Workflow Generator):**
   - If the active page contains a form (e.g. e-commerce search, login, settings panel, WBM parameter table), how should the UI let the user generate the full multi-step workflow in 1 click?
5. **Exact Code Changes & Component Structure:**
   - Provide concrete TypeScript / React interfaces, helper functions, and JSX for `WorkflowStudio.tsx`.

Be specific, pragmatic, and uncompromising on UX polish.
