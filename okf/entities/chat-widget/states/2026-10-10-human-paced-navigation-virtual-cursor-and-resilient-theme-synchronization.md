# State: Human-Paced Navigation, Virtual Gaze Cursor & Resilient Theme Synchronization

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** historic
- **Version:** `0.1.9`
- **Status:** Superceded
- **Valid_from:** 2026-10-10T05:00:00Z
- **Valid_to:** 2026-10-10T05:10:00Z

## Summary
The on-device chat widget and browser copilot delivers human-paced, visually grounded web navigation and multi-layer resilient theme synchronization. Navigation steps are paced with a minimum 1800ms human reading interval, allowing smooth scrolling (Lenis / CSS smooth) to settle completely. A virtual human gaze cursor (`#g4-agent-human-cursor`) glides across the viewport to the target element's center with a radar pulse indicator and live badge (`👁️ Observing: [Target]`). The chat stream maintains single-message in-place progress updates during multi-step automations. Theme mode switching synchronizes framework signals, direct DOM classes, and localStorage.

## Active Invariants & Rules
1. `Human Reading Interval`: All automated navigation steps and element tours enforce `Math.max(delayMs, 1800)` so users have adequate visual time to observe and comprehend each step.
2. `Virtual Gaze Cursor & Spotlight`: Element navigation activates `humanNavigateTo()`, positioning the floating human cursor dot with radar pulse and spotlight border with 0 viewport drift.
3. `In-Place Workflow Telemetry`: Multi-step workflow updates mutate a single container message in place, preventing chat stream flooding.
4. `Multi-Layer Theme Resilience`: Theme toggle and mode setting dispatches to `window.setTheme()`, `window.toggleTheme()`, direct `data-theme` attribute, `.dark` class toggles on both `<html>` and `<body>`, and `localStorage.setItem('theme', mode)`.
