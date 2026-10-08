---
type: state
valid_from: 2026-10-05T08:45:00+05:30
learned_at: 2026-10-05T08:45:00+05:30
layer: current
trust: machine-confirmed
---

# State: Quiet Chrome, Collapsed Empty State & Thread-First Product UX

1. **Quiet Header Chrome & Subdued Controls**:
   - Header condensed to brand title `AI Copilot` and inline model selector (`Gemini Nano ▾`).
   - Engineer diagnostic counters ("0 MB Chrome Native") stripped from user-facing chrome.
   - Status beacon reduced to a clean 8px emerald dot with hover tooltip (`On-device · <Model>`).
   - Auxiliary modes (Navigation Hub, History, Judge Studio) relocated off primary header into an overflow popover menu (`•••`), eliminating distracting badge numbers (`8`, `10`).
   - Text `Escalate` button conditionally enabled only following low-confidence turns.

2. **Collapsed Context-Aware Empty State**:
   - Eliminated the 3 tall promotional cards and landing copy.
   - Initial empty state condensed to a single context line (`This page · <domain/path>`) and 4 compact prompt chips (`Summarize this page`, `Explain the code`, `Find the main CTA`, `List form fields`).

3. **Thread-First Typography & Message Flow**:
   - User messages: right-aligned with light translucent fill (`bg-white/10`, hairline border).
   - Assistant turns: full-width flat prose (zero card bubble containers), blending directly into the obsidian panel.
   - Inline monospace tool summary (`inspected page elements`, `clicked button`, etc.) with expandable step traces.
   - Quiet inline thumbs feedback with progressive `Try stronger model` text link.

4. **Anchor Composer**:
   - Left dismissible page context tag (`/docs/api ×`).
   - Clean central input (`Ask about this page...`) with purple accent focus hairline border (`border-purple-500/60`), eliminating loud neon shadows.
   - Right dual-state button: Send arrow (`↑`) or Stop square (`■`) when generating.
   - Dropped visual clutter: eye icon and under-composer slogans ("Local-First Intelligence", "Zero Data Exfiltration").

5. **Unified Geometry & Single Purple Accent**:
   - 8px panel border-radius, 6px chip border-radius, hairline borders (`rgba(255,255,255,0.08)`).
   - Purple accent reserved strictly for active tabs, send actions, and markdown hyperlinks.
