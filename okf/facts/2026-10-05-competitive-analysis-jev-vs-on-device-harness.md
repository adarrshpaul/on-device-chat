---
fact_id: 2026-10-05-competitive-analysis-jev-vs-on-device-harness
entity: agent-harness
valid_from: 2026-10-05T12:55:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Competitive Architecture Analysis: TypeSafe Jev vs. Local-First Agent Harness

## Summary
Architectural and empirical benchmark comparison between TypeSafe's Jev model (hosted non-autoregressive decision model on Cloudflare Workers AI / Vercel AI Gateway) and our Local-First Agent Harness (Laya System 1 + In-Browser Gemini Nano + Host Recipes).

## Dimensional Comparison
1. **Latency & Response Speed**:
   - **TypeSafe Jev**: 70ms–500ms network roundtrip + cloud inference.
   - **Local-First Harness**: <10ms for Host Recipes; ~15–20ms for native Chrome Gemini Nano on client NPU/GPU. Zero network roundtrip overhead.
   - **Verdict**: Local-First decisively beats Jev on interactive browser latency.

2. **Cost & Unit Economics**:
   - **TypeSafe Jev**: \$0.042 / 1M input tokens. Output is free, but per-decision pricing scales linearly with volume and egress.
   - **Local-First Harness**: \$0.00 / 0 Tokens. Runs 100% on client device hardware.
   - **Verdict**: Local-First decisively beats Jev on unit economics.

3. **DOM & Browser Grounding**:
   - **TypeSafe Jev**: Blind to client DOM state unless heavy HTML/JSON payloads are serialized and sent over HTTP on every action.
   - **Local-First Harness**: Native in-DOM execution. Directly measures `boundingClientRect`, `aria-label`, accessibility trees, `window.scrollY`, and dispatches synthetic input events.
   - **Verdict**: Local-First decisively beats Jev for browser automation.

4. **Model Capacity & Multi-Class Disambiguation**:
   - **TypeSafe Jev**: Server-side model trained via RLCD (Reinforcement Learning for Calibrated Decisions) across 255-way discrete classification heads.
   - **Local-First Harness**: In-browser heuristics handle 10–25 actions; running full 524MB neural weights in-browser incurs high bandwidth and WASM threading overhead.
   - **Verdict**: Jev wins on pure server-side neural capacity for 100+ fuzzy classification options unless our harness cascades to edge models.

5. **Production Hybrid Blueprint**:
   - The optimal architecture is a 3-tier cascade:
     - Tier 1: Client Host Recipes & DOM Gating (<10ms, \$0.00) handles 80%+ of deterministic interactions.
     - Tier 2: In-browser Gemini Nano / MiniLM (~15ms, \$0.00) handles semantic grounding.
     - Tier 3: Edge Decision Layer (Jev on Cloudflare Workers AI / Edge Gateway) handles ambiguous fallbacks when confidence < 0.8.
