---
type: event
valid_from: 2026-10-03
valid_to: 2026-10-03
learned_at: 2026-10-03T01:17:00Z
layer: current
trust: machine-confirmed
---

# Event: Robust Semantic Tool Router & Typo Tolerance Update

- Discovered that previous keyword fallback failed on "navigate to /settings" due to strict threshold (0.38) and lack of camelCase decomposition.
- Implemented camelCase token decomposition (`navigateTo` -> `navigate to`).
- Added Levenshtein distance typo-tolerance (allowing typos like "avigate" -> "navigate").
- Enhanced slot/argument extraction for arbitrary paths (`/settings`, `/profile`, `to settings`), numbers, and search terms.
- Verified build and live Vite reload.
