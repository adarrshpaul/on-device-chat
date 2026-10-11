# State: Universal Site Adaptability, Persona Detection & Dynamic DOM Discovery

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** historic
- **Version:** `0.1.9`
- **Status:** Superceded
- **Valid_from:** 2026-10-10T05:10:00Z
- **Valid_to:** 2026-10-10T05:20:00Z

## Summary
The on-device chat widget and browser copilot operates as a universally adaptable AI assistant for any website, framework, and domain. It dynamically inspects the host page DOM to detect the site's category (`ecommerce`, `docs`, `saas`, `portfolio`, `blog`, `general`), extracts live page headings to generate customized action chips, and resolves arbitrary landmark navigation requests on the fly via direct IDs, heading hierarchies, navigation links, and ARIA regions. Paced human gaze tracking and multi-layer theme synchronization ensure seamless operation across DaisyUI, Tailwind, CSS variables, and native browser settings.

## Active Invariants & Rules
1. `Universal Landmark Resolution`: Navigation requests resolve dynamically against the live DOM (IDs, `h1..h4` text, `nav a[href]` links, and ARIA roles) without requiring hardcoded keyword maps.
2. `Dynamic Site Persona Adaptation`: Initial empty-state action chips and badges adapt autonomously to whatever domain and page the widget is embedded in.
3. `Universal Search Execution`: Search commands (`search for [query]`) dynamically discover host search inputs, glide the virtual cursor to focus, and type with synthetic reactive dispatch.
4. `Zero Prompt Overhead on Fast-Path`: Universal landmark jumping, search input focusing, viewport scrolling, and theme toggling execute deterministically via System 1 motor actions (<15ms, 0 tokens).
5. `Human Gaze Pacing`: All navigation steps maintain a minimum 1800ms observation pause with the virtual radar gaze cursor.
