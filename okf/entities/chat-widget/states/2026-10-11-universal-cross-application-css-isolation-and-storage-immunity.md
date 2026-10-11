---
id: state_universal_cross_application_css_isolation_and_storage_immunity
layer: current
valid_from: 2026-10-11T18:00:00Z
valid_to: null
entity: chat-widget
---

# State: Universal Cross-Application UI Consistency, Hardened CSS Isolation & Storage Immunity

## Active State Properties
- **Universal CSS Isolation:** Strict scoped resets applied under `.g4-widget-container` for typography, box-sizing, buttons, inputs, textareas, SVGs, headings, paragraphs, and links.
- **Defensive Inline Input Styles:** Direct inline style properties (`backgroundColor: "transparent", color: "#f8fafc", border: "none"`) guarantee dark obsidian glass appearance even against high-specificity host rules (Amazon, Wikipedia, Bootstrap).
- **Z-Index Fortification:** Enforced `z-index: 2147483647 !important` on container and custom element `:host`, sitting firmly above any host fixed headers or modals.
- **SVG Containment:** SVGs locked to `max-width: 32px !important; max-height: 32px !important; margin: 0 !important; padding: 0 !important;`, preventing host framework expansion.
- **Storage Error Immunity:** All accesses to `localStorage`, `sessionStorage`, and `indexedDB` across all singletons are wrapped in synchronous `try / catch` blocks with graceful in-memory fallbacks, running safely on `origin: "null"`, sandboxed iframes, and privacy-restricted browsing modes.
- **Zero-Occlusion Side Docking:** Dynamic left/right docking preserves host game canvases and main interactive content.
- **Test Automation:** Validated by `tests/test_cross_application_ui_consistency.mjs` integrated into the standard `npm test` pipeline.
