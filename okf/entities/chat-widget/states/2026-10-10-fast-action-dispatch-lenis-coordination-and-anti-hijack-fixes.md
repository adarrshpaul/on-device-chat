# State: Fast Action Dispatch, Lenis Coordination & Anti-Hijacking Fixes

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** historic
- **Version:** `0.1.9`
- **Status:** Superceded
- **Valid_from:** 2026-10-10T04:35:00Z
- **Valid_to:** 2026-10-10T05:00:00Z

## Summary
The on-device chat widget and browser copilot delivers ultra-responsive, sub-15ms motor execution and robust workflow automations. Coordinated smooth scrolling via `smoothScrollTo` harmonizes with host page scroll engines (Lenis / GSAP ScrollTrigger), ensuring that section navigation, workflow steps, and element spotlighting smoothly transition the viewport without interference. Workflow matching enforces strict word-boundary semantics to prevent regular conversational queries from being hijacked into macros. Direct navigation and scroll intents execute instantly via deterministic System 1 motor dispatch with 0 prompt token overhead.

## Active Invariants & Rules
1. `Host Scroll Coordination`: All DOM scrolling, spotlighting, and viewport movements use `smoothScrollTo()`, delegating to `window.lenis.scrollTo()` on Lenis-enabled sites and falling back to native smooth scrolling.
2. `Anti-Hijacking Workflow Guard`: Automatic workflow triggering is strictly constrained to explicit command invocations (`run workflow`, `start tour`) or whole-phrase boundary matches. Loose tag substring matches (e.g. `ai` in `again`) are prohibited.
3. `Sub-15ms Motor Fast-Path`: Directional viewport scrolling (`scroll down`, `scroll up`, `top`, `bottom`) and landmark jumps (`go to projects`, `skills`, `journey`, `contact`, `hire me`) execute deterministically in System 1 with instant DOM updates and structured decision traces.
4. `Verified Live DOM Selectors`: All starter workflows and candidate mappings target verified live DOM elements (`#home`, `#journey`, `#skills`, `#projects`, `#insights`, `#contact`).
