---
id: event_workflow_form_element_suggestions_and_picking
entity: chat-widget
timestamp: 2026-10-12T02:45:00Z
author: claude-p-consultation
type: ui-enhancement
---

# Event: Workflow Studio Dynamic Form Suggestions, Element Picker & Step Value Input

## Problem Addressed
In `WorkflowStudio.tsx`, when users created or configured execution steps:
1. Selecting action `type` showed no input field for `value` (what to type), preventing users from entering text.
2. The `target` field defaulted to hardcoded `#about` or `projects`, violating Rule 9.
3. Users were forced to manually guess CSS selectors without any context from the active webpage.

## Claude Consultation (`claude -p`)
Consulted Claude Code via `claude -p` on architectural patterns for dynamic form extraction and step authoring. Claude provided:
1. `pageFormExtractor.ts`: Dynamic live-DOM scanner discovering fields, textareas, selects, toggles, buttons, and form containers with replay-verified selectors and human-friendly labels (including WBM parameter tables).
2. `elementPicker.ts`: Point-and-click element inspector (`⌖`) with event swallowing (preventing destructive triggers) and hover outline preview.
3. `WorkflowStepEditor.tsx`: High-density step card with segmented action bar, searchable target combobox with live presence indicators (green = found on page, amber = missing), and dedicated `value` input with suggestion pills and Enter toggle (`↵`).
4. 1-click form formulation: `synthesizeFormSteps` turns entire detected forms into full multi-step workflows in 1 click.

## Verification
- Built package (`npm run build`) and extension sync with bit-parity.
- Added and executed `tests/test_page_form_extractor.mjs` (6 passed, 0 failed).
- All 10 existing test suites pass with 0 regressions.
- Verified in Playwright that clicking "Build steps" on a WBM configuration form generates a 7-step sequence with 0 tokens.
