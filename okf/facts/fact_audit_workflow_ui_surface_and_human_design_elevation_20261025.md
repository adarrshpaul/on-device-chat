---
id: fact_audit_workflow_ui_surface_and_human_design_elevation_20261025
entity: on_device_chat
property: workflow_ui_and_ergonomics
layer: current
status: verified-local
valid_from: 2026-10-25T02:30:00+05:30
author: antigravity
depends_on: [fact_audit_claude_updates_and_task120_status_20261025]
---

# Audit: Workflow UI Surface Defects vs. Human Tactile Design Language

## 1. Verified Defect Evidence
- Evaluated user screenshot `current_workflow_defect.png`:
  1. Truncated container label (`Workflows:` clipped off on left border in `ChatWidget.tsx:1007-1015`).
  2. Sub-20px touch targets (`py-0.5`, `w-5 h-5` chevrons, `text-[10px]`) violating 44px tap target standard.
  3. Squeezed text and icon duplication (`▶ ✉ Quick Contact & Connect ▶ ✉`), with adjacent buttons squashed to 0px text width.
  4. Muddy dark-gray palette (`bg-black/40 border-white/6 text-gray-300`) with flat low contrast.
  5. Unaligned vertical stacking colliding with the voice provider switcher.

## 2. Design Elevation Mapping from Human Inspiration
- Deconstructed 4 user-supplied design inspirations:
  - **Color Science**: Purposeful high-saturation accents against calm foundation (Neon Chartreuse `#E7FE55` for status/verified, Electric Fuchsia `#FF2E93` for connectors/drafts, Cobalt `#2563EB` for action tiles).
  - **Tactile Scale**: 40-48px touch targets, 16px corner radius (`rounded-2xl`), subtle micro-borders and soft ambient shadows.
  - **First-Class Workflow Representation**: Workflows as connected tactile stories (icon tile + step badge + run trigger) and chat composer chips (`Entire Workflow ✕`).

## 3. Four Selectable Remediation Plans
- Defined Plan A (Quick Workflows Bar Overhaul), Plan B (Chat Composer Elevation), Plan C (WorkflowStudio Visual Refactor), and Plan D (Unified Harmony).
- Published detailed visual audit in artifact `workflow_ui_surface_audit.md`. Awaiting user plan selection.
