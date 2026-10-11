# Architectural Evaluation: LightOnOCR-3-0.8B for Web Agent Harness

- **Status**: Evaluated / Rejected for Client Web Harness (Viable for Backend PDF OCR only)
- **Date**: 2026-10-10
- **Scope**: Multi-Modal Vision & Reasoning Evaluation (`on-device-chat`)
- **Subject**: `lightonai/LightOnOCR-3-0.8B`

## 1. Model Profile
- **Architecture**: Qwen3.5-VL Vision-Language backbone (0.8B parameters).
- **Primary Function**: End-to-end OCR transcription, document layout detection, chart extraction to HTML, and bounding box grounding `[ymin, xmin, ymax, xmax]`.
- **Weights Footprint**: ~1.6 GB (FP16/BF16) / ~450MB–800MB (INT4/GGUF).
- **Inference Runtime**: Server-side PyTorch / `vLLM` (`vllm serve lightonai/LightOnOCR-3-0.8B --trust-remote-code`). No standard in-browser WebGPU runtime yet.

## 2. Evaluation Against User Requirements

### A. Requirement 1: "Will this help us answer only after analysis?" (Reasoning / CoT)
- **Verdict: NO.**
- **Technical Evidence**: LightOn AI explicitly documents in the model card: *"It is trained and evaluated with thinking disabled, which corresponds to the default chat template."*
- **Reasoning**: LightOnOCR is strictly an image-to-text transcription and bounding-box regression model. It possesses no chain-of-thought (CoT) reasoning or deliberation dynamics. For multi-step analysis before action, models like `LiquidAI/LFM2.5-1.2B-Thinking-ONNX` or DeepSeek-R1 distillations are required.

### B. Requirement 2: "Do we need this in our Web Agent Harness?"
- **Verdict: NO for live web browsing; ONLY viable if adding backend PDF/Document scanning.**
- **DOM Superiority**: For standard web browsing, `A11yTreeEngine.scan()` extracts the ground truth DOM hierarchy, W3C accessible names, and interactive nodes in `<2ms` with `0 MB` download overhead.
- **Latency & Footprint Penalty**: Replacing or augmenting DOM grounding with an 800M visual OCR model would force clients to download ~500MB+ into browser WebGPU, increasing step latency from 2ms to ~1500ms while introducing visual OCR hallucinations on small UI fonts.
- **Canvas/Visual Boundary**: In the rare event of navigating `<canvas>` or WebGL interfaces without DOM elements, our existing `VisionService` captures downscaled canvas snapshots and delegates to multi-modal API/Nano rather than burdening the browser client with heavy local OCR weights.
