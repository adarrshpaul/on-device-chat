---
type: fact
valid_from: 2026-10-02
learned_at: 2026-10-02T19:17:00Z
layer: current
trust: machine-confirmed
---

# Fact: Client-Side Size & Inference Footprints

1. **Chrome Gemini Nano**: Built into modern Chrome (`window.ai.languageModel`). Model weight download size for the web application is **0 MB**.
2. **Transformers.js Router**: ONNX MiniLM feature extractor requires **~15-20 MB** download, executing client-side with WebGPU or WASM fallback.
3. **SmolLM2-135M**: Q4 ONNX generative model requires **~80 MB**, lazy-loaded on demand.
4. **Gemma 4 E2B Unified Architecture**: Contains unified weights where audio/vision projections cannot be physically stripped, making raw Gemma 4 ~600-800 MB at Q4.
