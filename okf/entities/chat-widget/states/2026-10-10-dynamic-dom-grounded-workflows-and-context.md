# State: Zero-Hardcoding Dynamic DOM-Grounded Workflows & Context Engine

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** history
- **Version:** `0.1.9`
- **Status:** Superseded
- **Valid_from:** 2026-10-10T07:05:00Z
- **Valid_to:** 2026-10-10T14:34:00Z

## Summary
The on-device web AI chat agent operates on 100% dynamic DOM grounding with zero hardcoded starter workflows, domain assumptions, or static navigation items. When loaded on any of the millions of web platforms (SPAs, developer harnesses, SaaS dashboards, e-commerce storefronts, blogs, or documentation portals), the agent synthesizes suggested workflows and navigation action pills strictly at runtime from the live host page DOM. All static starter workflow arrays (`UNIVERSAL_STARTER_WORKFLOWS`, `wf_portfolio_tour`, `wf_ai_engram_deepdive`, `wf_theme_toggle`, `wf_scroll_top`) have been eradicated from code, IndexedDB has been upgraded to version 4 with automatic legacy starter purge mechanisms, and localStorage is sanitized on initialization.

## Active Invariants & Rules
1. `Zero Hardcoded Starters`: No static arrays of starter workflows exist in code. Workflows displayed in the Quick Workflows bar and suggested to users are synthesized on the fly via `synthesizeSiteWorkflows()` or retrieved from user-saved custom automations in IndexedDB.
2. `Strict DOM-Gated Capability Synthesis`:
   - **Site Tour**: Synthesized exclusively when `planSiteTour()` detects 2 or more structural landmarks/sections (`section[id], article[id], main > section`).
   - **Interactive Playgrounds & Forms**: Discovered dynamically by locating action dispatch buttons (`button, input[type='submit']` matching run/dispatch/execute/test/benchmark/calculate) and their inputs.
   - **Dark/Light Theme**: Synthesized ONLY if a real theme toggle button (`button[aria-label*='theme' i], [data-theme-toggle], .theme-toggle`) physically exists in the DOM.
   - **Scroll to Top**: Synthesized ONLY if document height exceeds viewport height by >= 1.4x (`scrollHeight > innerHeight * 1.4`).
3. `Dynamic Navigation Action Pills`: `detectSitePersona()` discovers primary chips directly from live host page navigation links (`nav a, header a, .navbar a`) and document headings (`main h2, section h2`), mapping them directly to user action chips with zero static category fallbacks.
4. `Automatic Legacy Store Sanitization`: Database version bumped to 4. IndexedDB upgrades wipe old stores containing legacy static starter records, and `WorkflowStoreImpl.init()` strips all legacy starter IDs (`wf_portfolio_*`, `wf_ai_engram_*`, `wf_site_tour`, `wf_theme_toggle`, `wf_scroll_top`) from both memory cache and LocalStorage.
5. `Autonomous AI Workflow Generation`: `WorkflowStudio` AI prompt generation scans the live document DOM for matching element IDs, classes, buttons, links, and headings, creating verified selectors rather than assuming external URLs.
6. `Zero-Latency Instant Readiness & Chat Routing`: Engine readiness (`engineStatus = "ready"`) is initialized immediately at widget mount so that local System 1 routines (DOM navigation, site tour, page summary, and BM25 extractive search) respond in 0ms without waiting for 15 MB neural weights to download over the network. Normal conversational input routes directly to the agent harness and is never hijacked by automation workflows unless explicitly prefixed by `/wf` or `/workflow`. Error conditions append descriptive assistant messages rather than failing silently.
