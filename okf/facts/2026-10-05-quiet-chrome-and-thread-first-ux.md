---
fact_id: 2026-10-05-quiet-chrome-and-thread-first-ux
entity: chat-widget
valid_from: 2026-10-05T08:50:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Quiet Chrome, Collapsed Empty State, and Thread-First Product UX

## Summary
The on-device chat widget underwent an end-to-end design and density overhaul, shifting from a heavy multi-job "engineer dashboard" to a quiet, thread-first consumer copilot interface.

## Invariant Design Decisions
1. **Quiet Header Chrome**:
   - Brand title `AI Copilot` with subtle inline model text dropdown (`Gemini Nano ▾`).
   - Engineer status badges ("0 MB Chrome Native") stripped from user-facing chrome.
   - Status beacon reduced to a clean 8px emerald dot with hover tooltip (`On-device · <Model>`).
   - Secondary destinations (Navigation Hub, History, Judge & Evals) moved off the primary header into an overflow menu (`•••`), eliminating loud badge counters (`8`, `10`).
   - Text Escalate button enabled conditionally after low-confidence turns.
2. **Collapsed Context-Aware Empty State**:
   - Replaced multi-card marketing landing hero with a single context line (`This page · <domain/path>`) and 4 compact prompt chips (`Summarize this page`, `Explain the code`, `Find the main CTA`, `List form fields`).
3. **Thread-First Typography & Message Flow**:
   - User messages: right-aligned with light translucent fill (`bg-white/10`, hairline border).
   - Assistant turns: full-width flat prose (zero card bubble containers), blending directly into the obsidian panel.
   - Inline monospace tool summary (`inspected page elements`, `clicked button`, etc.) with expandable step traces.
   - Quiet inline thumbs feedback with progressive `Try stronger model` text link.
4. **Anchor Composer**:
   - Left dismissible page context tag (`/docs/api ×`).
   - Clean central input (`Ask about this page...`) with purple accent focus hairline border (`border-purple-500/60`), eliminating loud neon shadows.
   - Right dual-state button: Send arrow (`↑`) or Stop square (`■`) when generating.
   - Removed visual clutter: eye icon and under-composer slogans ("Local-First Intelligence", "Zero Data Exfiltration").
5. **Unified Geometry & Single Purple Accent**:
   - 8px panel border-radius, 6px chip border-radius, hairline borders (`rgba(255,255,255,0.08)`).
   - Purple accent reserved strictly for active tabs, send actions, and markdown hyperlinks.
