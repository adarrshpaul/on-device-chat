---
type: state
valid_from: 2026-10-02
learned_at: 2026-10-02T19:17:00Z
layer: current
trust: machine-confirmed
---

# State: Hybrid Multi-Tier Client AI Engine (MBs Payload)

The widget operates without a mandatory Python/Ollama backend. It supports 3 client tiers:
1. **Tier 0 (0 MB): Chrome Built-in Gemini Nano** (`window.ai.languageModel`) on-device.
2. **Tier 1 (~15 MB): Compact Semantic Router** (`Xenova/all-MiniLM-L6-v2`) via Transformers.js for immediate function classification and slot extraction.
3. **Tier 2 (~80 MB Q4): SmolLM2-135M-Instruct** via WebGPU for conversational text generation.
4. **Cloud Tier (0 MB): Gemini API Bridge** (Flash 2.0/1.5) when API key or proxy is supplied.
