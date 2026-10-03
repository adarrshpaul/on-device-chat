---
type: fact
id: fact-tier-multimodal-readiness
valid_from: 2026-10-03T07:40:00Z
learned_at: 2026-10-03T07:40:00Z
trust: verified
domain: machine-learning
---

# Fact: Multi-Tier Vision-to-Text (Multimodal) Capabilities & Drop-in Paths

1. **Tier 0 (Chrome Built-in Gemini Nano)**:
   - **Native Multimodal Support**: The Chromium Prompt API (`window.ai.languageModel`) natively supports image input when initialized with `expectedInputs: [{ type: "image" }]`.
   - Accepts `ImageBitmap`, `HTMLCanvasElement`, or `Blob` directly in `session.prompt()`.
   - Zero-download (0 MB), executes on OS NPU/GPU.
2. **Tier 1 (MiniLM Semantic Router)**:
   - **Not Multimodal**: Pure BERT-style text embedding model (22M parameters, 384-dimensional output). Solely used for semantic tool/macro matching.
3. **Tier 2 (SmolLM2 / Transformers.js WebGPU)**:
   - **Current**: `SmolLM2-135M-Instruct` is text-only.
   - **Drop-in Vision Twin**: `HuggingFaceTB/SmolVLM-256M-Instruct` or `SmolVLM-500M` runs on the identical `@huggingface/transformers` WebGPU engine already running in `compactEngine.ts`.
4. **Tier 3 (Gemma 4 E2B / WebLLM)**:
   - **Current**: `gemma-2-2b-it-q4f16_1-MLC` is text-only.
   - **Google Vision Twin**: `google/paligemma-3b-pt-224` (or `paligemma2-3b`) directly marries Gemma 2B with a SigLIP vision encoder for image-to-text, OCR, and GUI bounding-box coordinates.
