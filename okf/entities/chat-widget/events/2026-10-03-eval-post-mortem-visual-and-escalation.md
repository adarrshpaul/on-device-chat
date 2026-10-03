---
type: event
entity: chat-widget
timestamp: 2026-10-03T08:05:00Z
learned_at: 2026-10-03T08:05:00Z
source: user-collaboration
trust: verified
---

# Event: Evaluation Post-Mortem on Visual Query & Model Escalation

## Evaluation Summary
User tested the prompt *"What is on this page?"* across all 4 model tiers:
1. **Tier 0 (Gemini Nano)**: Successfully called `browse.see`, perceived rendered headings and product cards (Headphones, Smartwatch), and replied in 1 step (11s).
2. **Tier 1 (MiniLM Router)**: Semantic similarity false positive between *"What is on this page?"* and `navigateTo` (*"Navigate to a page on the site"*), triggering a false navigation call in 17ms with `path: "What is on this page?"`.
3. **Tiers 2 & 3 (SmolLM2 & Gemma 4)**: Fallback leakage. Because WebGPU weights were not pre-warmed in memory, execution silently dropped through to Tier 1 router, producing identical 23ms and 33ms false navigation calls.

## Architectural Action Items
1. Raise MiniLM routing threshold from `0.28` to `0.45` and require navigational intent verbs (`go`, `open`, `navigate`, `switch`) before matching `navigateTo`.
2. Fix Tier 2/3 silent fallback: display an explicit loading/downloading indicator when WebGPU neural weights are compiling instead of silently invoking the Tier 1 router.
