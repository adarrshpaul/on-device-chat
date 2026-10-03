---
type: event
entity: chat-widget
timestamp: 2026-10-03T07:25:00Z
learned_at: 2026-10-03T07:25:00Z
source: user-collaboration
trust: verified
---

# Event: In-Browser WebGPU Image Generation Architecture Analysis

## Context
The user inquired about running an image generation model directly inside the web browser client-side, exploring how to execute fine-tuned models on client hardware without backend GPU hosting costs.

## Key Architectural Findings & Decisions
1. **Memory & Runtime Boundary**: Full SDXL 1.0 (6.6GB) cannot fit directly into standard browser WebGPU tabs without tripping Chrome's 2–4GB heap limit. Client-side browser execution requires distilled or quantized models: **SD-Turbo** (1 step, ~1.4GB) or **SD 1.5 + LCM** (4 steps, ~1.5GB).
2. **Export & Porting Path for Fine-Tuned Models**:
   - Option A (Direct WebGPU In-Browser): Fine-tune LoRA on SD-Turbo or SD 1.5 $\to$ fuse LoRA weights into UNet $\to$ export via `optimum-cli` to ONNX FP16/INT8 $\to$ run via `onnxruntime-web/webgpu`.
   - Option B (Hybrid Edge): If using full SDXL 1.0 + LoRA fidelity, host on Cloudflare Workers AI / edge server and stream image response directly to the browser chat canvas.
3. **Execution Runtime**: Recommended stack is `onnxruntime-web/webgpu` or `@mlc-ai/web-stable-diffusion` running inside a dedicated `Web Worker` with `OffscreenCanvas` to prevent UI thread freezes.
