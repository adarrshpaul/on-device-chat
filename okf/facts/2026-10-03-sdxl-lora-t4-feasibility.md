---
type: fact
id: fact-sdxl-lora-t4-feasibility
valid_from: 2026-10-03T07:15:00Z
learned_at: 2026-10-03T07:15:00Z
trust: verified
domain: machine-learning
---

# Fact: SDXL 1.0 LoRA Fine-Tuning Feasibility on Free T4 GPU (16GB VRAM)

1. **VRAM Footprint & Fit**:
   - SDXL 1.0 base model (2.6B UNet + 800M dual CLIP/OpenCLIP text encoders) cannot undergo full parameter fine-tuning on a 16GB T4.
   - However, **SDXL 1.0 LoRA (rank 16 to 64)** fits within 16GB VRAM (consuming ~11.5–13.2 GB) when using:
     - FP16 mixed precision.
     - Gradient checkpointing enabled.
     - 8-bit Adam optimizer (`bitsandbytes`).
     - xFormers / PyTorch 2.0 SDPA memory-efficient attention.
     - Pre-cached latents (VAE and text encoder latents cached to RAM/disk).
     - Batch size 1 with gradient accumulation steps (2 to 4).
2. **Training Time for ~30 Images**:
   - Standard fine-tuning schedule: 800–1,200 total optimizer steps (~25–40 repeats per image over 1–2 epochs).
   - On a T4 GPU (Turing architecture, compute capability 7.5), step time is ~2.0–2.8 seconds/step with cached latents.
   - Total training duration: **35 to 65 minutes**, safely within Google Colab free tier limits (2–4 hours).
3. **Commercial Licensing**:
   - SDXL 1.0 is released under the **Open RAIL++-M License**.
   - Open RAIL++-M explicitly permits commercial use, revenue generation, and redistribution of weights and derivative works (LoRAs), with standard prohibitions on illegal and harmful content.
   - LoRA weights trained by the user are owned by the creator and can be commercialized or hosted freely.
