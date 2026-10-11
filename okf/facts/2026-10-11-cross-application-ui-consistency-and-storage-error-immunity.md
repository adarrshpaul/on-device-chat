---
id: fact_cross_application_ui_consistency_and_storage_error_immunity
timestamp: 2026-10-11T18:00:00Z
author: agent
type: empirical_benchmark
---

# Fact: Cross-Application UI Consistency, CSS Immunity, and Storage Error Defense

## Empirical Verification
The on-device chat agent was evaluated against adversarial CSS injection and live complex web applications (Amazon e-commerce, basketball canvas game, sandboxed iframe documents):
1. **Adversarial CSS Stress Test:**
   - Host `html { font-size: 62.5% !important; }` did not alter widget rem/typography scales.
   - Host `body { font-family: 'Comic Sans MS' !important; }` was blocked; clean Inter/system-ui remained active.
   - Host `input { background-color: #ffffff !important; border: 4px solid red !important; }` was blocked; input remained dark obsidian transparent (`rgba(0, 0, 0, 0)` with `0px` border).
   - Host `svg { width: 450px !important; }` was bounded to 32px.
   - Host sticky header with `z-index: 1000000000` sat beneath the widget (`z-index: 2147483647`).
2. **Amazon E-Commerce Verification:**
   - Host `input[type="text"]` white background override eliminated; input field renders transparent obsidian glass with `#f8fafc` text.
3. **Basketball Canvas Verification:**
   - Auto-docked to left edge with 0px canvas overlap; host `margin-left: 435px` preserved.
4. **Storage Error Immunity:**
   - On `origin: "null"` documents (e.g. `page.setContent()`, sandboxed iframes without `allow-same-origin`), synchronous `SecurityError` exceptions from `window.sessionStorage`, `window.localStorage`, and `indexedDB.open` were safely caught; stores seamlessly fell back to memory maps with zero widget crashes.
