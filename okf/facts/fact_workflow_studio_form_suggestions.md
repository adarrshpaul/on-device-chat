---
id: fact_workflow_studio_form_suggestions
subject: workflow-studio-step-editor
predicate: dynamic-form-and-value-suggestions
valid_from: 2026-10-12T02:45:00Z
valid_to: null
confidence: 1.0
source: claude-p-consultation
---

# Fact: Dynamic Form Suggestions and Value Fields in Workflow Studio

Workflow Studio provides dynamic form extraction and element suggestions directly from the live webpage:
1. When action `type` is chosen, a dedicated "Text to type" input is rendered with suggestion pills (current value, datalists) and Enter toggle.
2. Target selectors are selected via a searchable Combobox displaying live page inputs with human-readable labels, icons, and presence status dots.
3. Users can point and click any element on the page using the `⌖ Pick from page` inspector.
4. Detected forms can be converted into 1-click multi-step automations via `Build steps`.
5. All hardcoded `#about` and `projects` defaults have been removed, ensuring 100% dynamic DOM synthesis.
