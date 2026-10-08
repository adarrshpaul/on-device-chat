---
fact_id: 2026-10-08-liquid-lfm2-cot-integration-architecture
entity: chat-widget
valid_from: 2026-10-08T09:33:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Liquid Foundation Model (LFM2/2.5) CoT Architecture for Site Navigation & Automation

## 1. Reference Implementation Analysis (`quant.paulcreates.online`)
The trading intelligence terminal at `quant.paulcreates.online` features a production-tested WebGPU execution pipeline powered by Transformers.js and ONNX Runtime:
1. **`LiquidAI/LFM2.5-1.2B-Thinking-ONNX`** (`q4`): 1.2B parameter deep Chain-of-Thought (CoT) reasoning model that streams `<thought>...</thought>` tokens before emitting structured verdicts.
2. **`LiquidAI/LFM2.5-350M-ONNX`** (`q4`, ~220MB): Sub-500ms deterministic KPI extractor without CoT overhead.
3. **`LiquidAI/LFM2.5-230M-ONNX`** (`q4`, ~140MB): Sub-300ms nano sentiment screener.
4. **Key Production Finding**: Models under 500M parameters MUST NOT be prompted for CoT thinking monologues; doing so causes token loops and slow convergence. CoT is exclusively reserved for the 1.2B Thinking model.

## 2. Integration Proposal for `on-device-chat`
Currently, `on-device-chat` relies on:
- Chrome Gemini Nano (0 MB, but requires Chrome flags & Chromium engine).
- MiniLM (~15 MB, embedding-based keyword router, lacks generative planning).
- Gemini API (cloud, requires key).

### Dual-Tier LFM2 Integration Design:
1. **Site Task Automator (Deep Planning)**:
   - **Model**: `LiquidAI/LFM2.5-1.2B-Thinking-ONNX` via WebGPU (`q4`).
   - **Capability**: Autonomously inspects the DOM engram map, synthesizes multi-step browser macros, streams reasoning via `<thought>` tags, and outputs validated tool calls (`browse(action="click", selector=...)`).
   - **Thought Ledger UI**: Reuses the collapsible Thinking UI component already built into `MessageBubble`.
2. **Site Navigator (Sub-Second Fast Teleportation)**:
   - **Model**: `LiquidAI/LFM2.5-350M-ONNX` via WebGPU (`q4`).
   - **Capability**: Resolves arbitrary user site navigation queries to candidate DOM landmark nodes in < 400ms without sending DOM data to external clouds.
