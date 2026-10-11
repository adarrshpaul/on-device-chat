# Event: Purge Static Starter Workflows & Implement Runtime DOM Synthesis

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Actor:** AI Assistant Pair Programmer
- **Target State:** `2026-10-10-dynamic-dom-grounded-workflows-and-context.md`

## Description
Completely eradicated all hardcoded starter workflow definitions (`UNIVERSAL_STARTER_WORKFLOWS`, `wf_portfolio_tour`, `wf_ai_engram_deepdive`, `wf_site_tour`, `wf_theme_toggle`, `wf_scroll_top`) from `workflowStore.ts`. Replaced with runtime DOM synthesis (`synthesizeSiteWorkflows()`) that scans the live document DOM for real interactive elements, navigation landmarks, and capabilities whenever the user opens any website. Bumped IndexedDB to version 4 with purge mechanisms for legacy cache records, updated `WorkflowStudio` AI workflow generation to inspect live DOM selectors, updated `sitePersona` action pills to prioritize host navigation links, verified unit tests pass, and deployed updates to Cloudflare Pages.
