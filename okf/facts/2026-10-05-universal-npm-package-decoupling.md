---
fact_id: 2026-10-05-universal-npm-package-decoupling
entity: chat-widget
valid_from: 2026-10-05T08:10:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Universal NPM Package & CDN Distribution Decoupling

## Summary
The on-device chat widget (`on-device-chat`) has undergone a comprehensive decoupling audit to ensure 100% portability and zero hardcoded logic. All site-specific assumptions, DOM selectors, framework classes (`button.btn-circle`, `data-row-id="music"`, `(click)="synth"`), and cue placeholders have been stripped out. The widget now operates purely on W3C standard accessible DOM semantics, dynamic section/heading introspection, and framework-agnostic heuristics across arbitrary third-party websites (e-commerce, SaaS, documentation, blogs, SPAs).

## Invariant Guarantees
1. **Dynamic Semantic Element Grounding (`smartQuerySelector`)**:
   - Universal accessible name resolution without framework-specific CSS classes or hardcoded SVG icons.
   - Standard domain shortcuts: Theme toggles (`aria-label`, `title`, `class*="theme"`, `class*="dark-mode"`), Menu drawers (`[aria-expanded]`, `aria-label*="menu"`), Search inputs (`input[type="search"]`, `placeholder*="search"`), E-commerce actions (`cart`, `checkout`), and Modal dismiss buttons.
2. **Dynamic Section & Route Discovery**:
   - Capabilities inventory and Site Tour introspect live host DOM elements (`document.title`, `main > section`, `header`, `nav a`, `article`, `h1`-`h3`) at runtime.
   - Dynamic capabilities greeting populates actual discovered section names without hardcoded project names.
3. **Universal Shadow DOM Web Component Delivery**:
   - `<on-device-chat>` custom element falls back to standard jsDelivr CDN stylesheets rather than localized asset relative paths.
4. **Verified Multi-Site E2E Test Suite**:
   - Verified on isolated synthetic SaaS architecture (`Acme Cloud`) in Playwright with 0 leaked strings, dynamic section extraction, live theme toggles, and universal engram cue prompts.
