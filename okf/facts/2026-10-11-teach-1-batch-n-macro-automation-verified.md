# OKF Fact: Dynamic "Teach 1 → Batch N" Macro Automation & Human Confirmation Gate

- **Date**: 2026-10-11T11:12:00Z
- **Author**: Antigravity Pair Programming Agent
- **Entity**: `chat-widget`
- **Layer**: `current`
- **Status**: `verified`

## 1. Problem Definition & Scope Transition
- **Data Entry Fatigue Root Cause**: Merchants, inventory controllers, and operators waste hours repeating identical multi-step action sequences (click row -> open edit mode -> mutate fields -> click save) across dozens or hundreds of sibling items.
- **Scope Mandate Enforced**:
  - **Zero CSV/File Uploads**: Eliminated all drag-and-drop CSV upload requirements. The agent inspects the live active DOM directly within the web application.
  - **Zero UI Intrusion**: Kept unrelated applications (`tshirt-experiment`) clean with zero unwanted buttons or banners.
  - **Zero Technical Fraud**: Element selection, event dispatching, and error handling run genuinely against client-side DOM nodes with 0 prompt token overhead and isolated step timeouts.

## 2. Core Architecture Implemented
1. **Demonstration Capture Engine (`src/lib/macroRecorder.ts`)**:
   - Capture-phase DOM event listeners (`click`, `input`, `change`) scoped outside the widget container.
   - Detects the entity container (`tr`, `[role='listitem']`, `.card`, `article`, `li`) from the initial interaction.
   - Computes relative sub-element selectors (e.g. `{{entity_selector}} [data-action='edit']`, `{{entity_selector}} input[name='price']`).
   - Scans active view for sibling entities matching structural tags and classes.
   - Compiles recorded sequence into a parameterized `BatchProposal` with concrete `WorkflowStep[]` (action: `click` | `type`).

2. **Interactive Human Confirmation Gate (`src/components/BatchConfirmationCard.tsx`)**:
   - Renders inline review matrix inside chat with per-entity checkboxes, entity names, status diffs, and execution badges.
   - Enables selective approval (toggle all, individual item exclusions).
   - Real-time progress bars and status indicators (`pending` -> `running` -> `success` / `failed` / `skipped`).

3. **Sequential Batch Runner with Error Isolation (`src/lib/batchEngine.ts`)**:
   - Executes parameterized workflow steps sequentially across approved entities.
   - Paced with 250ms stabilization jitter between entities to respect reactive frontend frameworks.
   - Step-level watchdogs and isolated error boundaries: single entity failure (e.g., missing button) is captured and recorded on that entity without halting the remaining batch.

4. **Chat Harness UI Integration**:
   - `ChatHeader.tsx`: Subtle "Record Macro" button in header and "Teach 1 → Batch N Macro" item in overflow menu (`•••`).
   - `ChatWidget.tsx`: "Teach 1 → Batch N" quick action chip in suggested workflows header.
   - `useChat.ts`: Natural language intent trigger routing prompts like `"record macro"`, `"watch what I do"`, `"teach 1"` directly to `startMacroRecording`.

## 3. Empirical Verification Suite (`tests/test_teach1_batchN_macro.mjs`)
- Tested against a realistic 10-row e-commerce inventory table (`#inventory-table` with multi-column status, price inputs, and edit/save action buttons).
- **Test 1**: Established 10 multi-column items in simulated DOM (10/10 detected).
- **Test 2**: Recorded 3 actions on Row 1 (click edit -> change price to $35.00 -> click save).
- **Test 3**: Auto-parameterization validated:
  - Step 1: `click` on `{{entity_selector}} [data-action='edit']`.
  - Step 2: `type` "35.00" on `{{entity_selector}} input[name='price']`.
  - Step 3: `click` on `{{entity_selector}} [data-action='save']`.
  - Detected all 10 sibling entities.
- **Test 4**: Confirmation gate selective approval: approved items 1–8, excluded items 9–10.
- **Test 5**: Sequential batch runner execution: 8 succeeded, 0 failed, 2 cleanly skipped.
- **Test 6**: Error boundary fault isolation: deliberately removed save button on Row 4; verified Row 4 safely marked `failed` with explicit error explanation, while remaining 9 rows executed with `success` (9 succeeded, 1 failed).
- **Result**: 100% pass rate across all 6 test scenarios.
