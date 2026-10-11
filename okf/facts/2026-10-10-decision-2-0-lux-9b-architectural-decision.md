# Architectural Evaluation & Decision: vllm-sr/Decision-2.0-Lux-9B & Decision Family

- **Status**: Accepted for Edge Supervisor Tier (Tier 3.5 / API Gateway)
- **Date**: 2026-10-10
- **Scope**: Decision Head & Action Routing Architecture (`on-device-chat` / `api.paulcreates.online`)
- **Subject**: `vllm-sr/Decision-2.0-Lux-9B` and the `Decision-2.0` Family (`Kai-0.6B`, `Eos-0.8B`, `Lux-9B`)

## 1. Architectural Alignment
`Decision-2.0` (developed by vLLM Semantic Router) perfectly mirrors our existing `VegaDecisionEngine` / `LayaDecisionEngine` paradigms:
- **No Text Generation**: Single forward-pass probability distribution over typed schemas (`choice`, `yes/no` / `boolean`, `score`).
- **Standardized Schema**: Uses the exact `system_one` question criteria format that `vegaEngine.ts` implements.
- **Latency Advantage**: Median inference latency of **18.4 ms** on GPU for `Lux-9B`, and **4.9 ms** for `Kai-0.6B`.

## 2. Parameter & Deployment Reality Check
- **`Decision-2.0-Lux-9B`**:
  - Size: 7.94B parameters (~4.5 GB in INT4, ~16 GB in FP16).
  - Context: 16,384 tokens.
  - Client Viability: **Too heavy for client browser WebGPU** (would crash mobile tabs and require 4.5 GB download).
  - Edge/Server Viability: **Superior Edge Supervisor**. Can be hosted on vLLM server or container behind `api.paulcreates.online`.
- **`Decision-2.0-Kai-0.6B` / `Eos-0.8B`**:
  - Size: 0.60B parameters (~350 MB in INT4).
  - Latency: 4.9 ms.
  - Client Viability: Small enough to run via ONNX WebGPU on modern desktops or as an ultra-cheap serverless worker.

## 3. Decision Pipeline Integration Architecture
Instead of jumping directly from a fast client heuristic to a slow, expensive 70B generative LLM when uncertain, our hierarchy becomes:
1. **Tier 1 (Client Reflex, <5ms)**: Local `VegaDecisionEngine` (14.3M) / `Laya` runs in-browser with zero network calls.
2. **Tier 2 (Edge Decision Supervisor, ~20ms)**: If local Vega triggers `abstain: true` or margin < 0.15, the harness calls `api.paulcreates.online` backed by `Decision-2.0-Lux-9B` (or `Kai-0.6B`). Receives calibrated probabilities across tools in 18.4ms without generating a single wasteful token.
3. **Tier 3 (Generative Reasoning Fallback, 1-3s)**: Full generative LLM (Gemini 2.0 / Gemma 4) is invoked ONLY if free-form text synthesis or deep creative reasoning is explicitly required.
