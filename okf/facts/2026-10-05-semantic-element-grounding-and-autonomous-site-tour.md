---
fact_id: 2026-10-05-semantic-element-grounding-and-autonomous-site-tour
entity: chat-widget
valid_from: 2026-10-05T04:12:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Semantic Element Grounding and Autonomous Guided Site Tour

## Summary
The on-device agent harness pairs multi-modal semantic element resolution with autonomous guided site tours, ensuring local models (Gemini Nano, MiniLM, Gemma) locate accessible DOM targets and navigate live web applications without selector hallucination.

## Invariant Guarantees
1. **Multi-Attribute Accessible Name Resolution (`smartQuerySelector`)**:
   - Matches targets by CSS selector, ID, `aria-label`, `title`, `alt`, `data-row-id`, `data-testid`, class tokens, and token overlap.
   - Textless buttons with SVG icons (such as `<button aria-label="Toggle Theme">`) resolve reliably when queried with semantic phrases like `button.toggle-theme`, `toggle theme`, or `click toggle thme`.
2. **Initial Loop Grounding**:
   - Before executing step 0 in `AgentHarness.runLoop()`, candidate interactive elements currently visible on screen are mapped and injected into the initial user prompt. Models never operate in the dark or invent non-existent class names.
3. **Autonomous Guided Site Tour (`executeSiteTour`)**:
   - Queries and orders key landmark sections (Hero, Featured Projects, Technical Skills, Audio/3D Labs, Contact).
   - Smoothly scrolls the host page to the focused landmark (`scrollY` update) and activates the glowing agent spotlight ring (`spotlightElement`).
   - Produces an interactive markdown guide with section summaries and quick teleport triggers.
4. **Fluid Widget Scroll Trapping**:
   - Intercepts wheel ticks and touch gestures on `.g4-window-card` without synchronous `getComputedStyle` layout thrashing, routing clamped delta to active viewports while isolating host window scroll.
