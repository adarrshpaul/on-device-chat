---
id: state_dynamic_form_extraction_and_step_combobox
layer: current
valid_from: 2026-10-12T02:45:00Z
valid_to: null
entity: chat-widget
---

# State: Dynamic Form Extraction, Interactive Element Combobox & Step Value Input

## Active State Properties
- **Dynamic Form & Element Extractor (`pageFormExtractor.ts`):**
  - Live page scanning (`scanPage()`) extracting up to 150 inputs, 150 action buttons/links, and 40 landmarks. Excludes `.eo-widget-container` and internal chrome.
  - Resolves human-readable labels from `aria-labelledby`, `aria-label`, `<label for>`, table cell adjacency (WBM parameter tables), placeholders, and names.
  - Generates replay-verified CSS selectors that roundtrip through `smartQuerySelector` back to the exact element.
  - Identifies `<form>`, fieldset, table, and dialog groups into `PageFormGroup`s.
- **1-Click Form Formulation (`synthesizeFormSteps`):**
  - "Build steps" button converts detected forms on the active page into full multi-step workflows in 1 click, capturing initial values and targeting submit buttons.
- **Workflow Step Editor (`WorkflowStepEditor.tsx`):**
  - Dedicated `value` input field for `type` action with `↵` Enter key toggle and quick suggestion pills (current values, datalist options).
  - Dedicated `<select>` dropdown handling in `WorkflowRunner` and `ActionDispatcher` with exact value/text precedence.
  - Searchable `TargetCombobox` with live element existence beacon (emerald = present in DOM, amber = missing), element type icons, and hover preview bounding boxes.
- **Live Element Picker (`elementPicker.ts`):**
  - Crosshair cursor (`⌖`) with pointer event swallowing (preventing accidental form submission or purchases during inspection) and Escape key cancellation.
- **Zero Rule 9 Violations:**
  - Removed all hardcoded `#about` and `projects` defaults from `WorkflowStudio.tsx`.
