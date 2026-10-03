---
type: fact
id: fact-in-browser-diffusion-memory-bounds
valid_from: 2026-10-03T07:25:00Z
learned_at: 2026-10-03T07:25:00Z
trust: verified
domain: machine-learning
---

# Fact: In-Browser Image Diffusion Memory & Runtime Feasibility

1. **Browser Tab Memory Ceilings**:
   - V8 / Chromium enforces a per-tab heap ceiling (typically 2GB–4GB maximum).
   - Full SDXL 1.0 base model (6.6GB in FP16, 2.6B UNet + 800M text encoders + VAE) **cannot** safely run unquantized inside a single browser tab without triggering browser tab crash / OOM.
   - WebGPU enforces `maxBufferSize` limits (typically 256MB–1GB per buffer depending on client GPU hardware).
2. **Feasible In-Browser Diffusion Architectures (WebGPU)**:
   - **SD-Turbo** (512x512, 1-step inference, ~1.4GB FP16/INT8).
   - **Stable Diffusion 1.5 + LCM (Latent Consistency Model)** (512x512, 4-step inference, ~1.6GB).
   - **SDXS / Distilled Models** (~500MB).
   - **Segmind SSD-1B (quantized)** (1.3B parameter distilled SDXL architecture).
3. **Execution Engines**:
   - **ONNX Runtime Web (`onnxruntime-web/webgpu`)**: Decomposes pipeline into `text_encoder.onnx`, `unet.onnx`, and `vae_decoder.onnx` executed via WebGPU compute shaders.
   - **MLC Web-Stable-Diffusion (`@mlc-ai/web-stable-diffusion`)**: Uses Apache TVM to compile UNet/VAE kernels directly to WebGPU WGSL.
4. **Main Thread Isolation**:
   - Diffusion model loading and WebGPU compute must run within a dedicated **Web Worker** with `OffscreenCanvas` or `ImageData` transfer to avoid locking the UI thread.
