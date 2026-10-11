# Fact: Zero-Hardcoding Architecture for Universal Web Agent Adaptation

- **Date:** 2026-10-10
- **Category:** Architecture & Adaptability
- **Status:** Verified

## Core Principles
1. **Universal Portability**: The chat assistant is designed to mount on arbitrary web applications without prior knowledge of their DOM structure, domain names, or business logic.
2. **Dynamic DOM Synthesis**:
   - Navigation suggestions (action pills) are extracted dynamically from `nav a`, `header a`, `.navbar a`, and section headings on the active page.
   - Suggested workflows are synthesized at runtime by inspecting the live page for real interactive controls (run/execute buttons, inputs), structural sections (`planSiteTour()`), verified theme toggles, and scrollable heights.
3. **No Static Starter Seeding**: Neither IndexedDB nor LocalStorage contains pre-populated hardcoded starter workflows. Only user-created or explicitly saved workflows persist in storage.
4. **Target Grounding Invariant**: Any workflow possessing specific CSS or ID targets (`#id`, `.class`) must verify that at least one target exists in the live DOM before being surfaced in the UI.
