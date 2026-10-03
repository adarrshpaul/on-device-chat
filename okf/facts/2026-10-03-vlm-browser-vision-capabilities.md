---
type: fact
id: fact-vlm-browser-vision-capabilities
valid_from: 2026-10-03T07:35:00Z
learned_at: 2026-10-03T07:35:00Z
trust: verified
domain: machine-learning
---

# Fact: In-Browser Vision-Language Models (Image-to-Text) vs Gemma Architecture

1. **Gemma 2 2B (Current Tier 3) Boundary**:
   - The current WebLLM engine model (`gemma-2-2b-it-q4f16_1-MLC`) is a **pure text-to-text** autoregressive model with a discrete vocabulary embedding table.
   - It possesses **zero native vision capabilities**; it cannot consume image patches, pixel tensors, or screenshots directly.
2. **Google's Vision-Language Gemma (PaliGemma / PaliGemma 2)**:
   - Google's official vision-enabled Gemma model family is **PaliGemma** (combining a 400M SigLIP vision encoder + 2B/3B Gemma language backbone with a linear projection layer).
   - Designed for Image-to-Text: OCR, visual question answering (VQA), image captioning, and GUI element localization.
3. **In-Browser WebGPU VLM Engines**:
   - **Transformers.js v3 (`@huggingface/transformers`)**: Supports `image-to-text` pipelines via WebGPU (`device: "webgpu", dtype: "q4"`) for **PaliGemma**, **Moondream 2** (1.86B, ~900MB), and **SmolVLM** (256M–2B).
   - **Chrome Built-in Multimodal AI (`window.ai.languageModel`)**: Select Chrome builds allow passing `ImageBitmap` or `Blob` directly in `session.prompt([{ type: "image", value: bitmap }, ...])`.
4. **Agent Value**:
   - For autonomous web agents, Vision-to-Text (VLM) enables visual page inspection (taking canvas snapshots and reading layout/buttons) independent of brittle HTML/CSS selectors.
