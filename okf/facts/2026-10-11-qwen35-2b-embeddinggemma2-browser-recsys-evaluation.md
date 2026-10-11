# Architectural Evaluation: Qwen3.5 2B (WebLLM) + EmbeddingGemma 2 (Transformers.js) for In-Browser Recommendation Systems

- **Date**: 2026-10-11T00:30:00Z
- **Status**: Evaluated & Integrated into Multi-Tier RecSys Roadmap
- **Domain**: On-Device Web Agent, Semantic Workflow Retrieval & Recommendation Engine

## 1. Executive Summary
The proposed stack—**Qwen3.5 2B (WebLLM)** paired with **EmbeddingGemma 2 (Transformers.js v3)**—represents the state-of-the-art dual-stage (Retrieval + Ranking) architecture for purely in-browser, privacy-preserving recommendation systems. 

However, deploying this stack in a client-facing web copilot requires careful tiering to prevent cold-start abandonment:
- **EmbeddingGemma 2 (270M text core)** is an exceptional semantic retriever (~150MB Q4) with Matryoshka Representation Learning (MRL down to 256/128 dims).
- **Qwen3.5 2B (WebLLM)** provides high-quality reasoning and hybrid Gated Delta linear attention, but imposes a **1.4GB–2.2GB** WebGPU download and high VRAM footprint that cannot serve cold-start first-visit users.

---

## 2. Component Deep Dive

### A. EmbeddingGemma 2 (Transformers.js v3) — The Stage 1 Bi-Encoder Retriever
* **Release**: October 6, 2026 (Google DeepMind).
* **Architecture**: Modular 740M total parameter multimodal model, but features a standalone **~270M parameter Text/Code Core**.
* **Key Innovations**:
  - **Matryoshka Representation Learning (MRL)**: Emits 768-dim embeddings that can be natively truncated to 256 or 128 dimensions with <1.5% loss in retrieval precision.
  - **Transformers.js v3 WebGPU / WASM**: Direct in-browser ONNX Runtime execution with zero Python backend.
  - **Footprint**: ~150MB (INT4) / ~270MB (INT8). Inference latency: **8–14 ms** per query on modern GPUs.
* **Role in Agent Harness**: Ideal for vector indexing of user-saved workflow templates, site action histories, and DOM landmark descriptions. Performs nearest-neighbor cosine search across 1,000+ workflow candidates in sub-frame time (<5ms).

### B. Qwen3.5 2B (WebLLM TVM WebGPU) — The Stage 2 Cross-Encoder Ranker & Synthesizer
* **Release**: February 2026 (Alibaba Qwen team).
* **Architecture**: Hybrid Gated Delta linear attention (3:1 linear-to-full attention ratio) with 262K native context.
* **Key Innovations**:
  - Specifically optimized for agentic tool routing and structured JSON outputs.
  - Linear attention layers reduce KV-cache memory pressure during multi-step reasoning.
  - Executable in WebLLM via TVM WebGPU (Apache 2.0).
* **Footprint**: ~1.2GB–2.2GB download weight. VRAM consumption: ~1.8GB–2.5GB. Cold-start download time: 15–45s on broadband.
* **Role in Agent Harness**: Evaluates the Top-K candidates retrieved by EmbeddingGemma 2, resolves multi-step parameter bindings, personalizes rankings based on the user's active session, and synthesizes novel compound workflows on the fly.

---

## 3. Comparison Matrix: Recommendation Stacks

| Feature / Metric | Tier 1 (Current Reflex): Vega Hamiltonian (14.3M) | Tier 1.5: EmbeddingGemma 2 (270M) | Tier 2 (Proposed): Qwen3.5 2B + EmbeddingGemma 2 | Tier 2 Edge: Decision-2.0-Lux-9B + EmbeddingGemma 2 |
|---|---|---|---|---|
| **Download Size** | **0 MB (Instant)** | ~150 MB | **1.55 GB – 2.4 GB** | ~150 MB (client) + 0 MB (edge) |
| **Cold Start** | **< 1 ms** | ~1.5 s | **15 – 45 s** | ~1.5 s |
| **Inference Latency** | **< 5 ms** | **8 – 14 ms** | **120 – 350 ms** | **18.4 ms** |
| **Retrieval Power** | Heuristic + Landmark | SOTA MRL Vector Cosine | SOTA Vector Cosine | SOTA Vector Cosine |
| **Ranking Quality** | Damped Hamiltonian 64D | Dot-Product Similarity | Deep Generative Reasoning | Non-autoregressive Calibrated Choice |
| **Mobile WebGPU Viability** | 100% | 95% | Risky (OOM on <4GB VRAM) | 100% |
| **Privacy** | 100% On-Device | 100% On-Device | 100% On-Device | Edge Worker (Zero logging) |

---

## 4. Architectural Synthesis & Implementation Roadmap

To avoid punishing first-time visitors with a 1.5GB+ download while offering the deepest possible recommendation intelligence, we adopt a **3-Tier Cascade Recommendation Architecture**:

1. **Stage 0 (Cold Start / First Visit): Vega Hamiltonian Reflex (14.3M)**
   - Pre-loaded, 0 download delay.
   - Instantly ranks and surfaces suggested workflows in the UI before any network download occurs.
2. **Stage 1 (Local Vector Retrieval): EmbeddingGemma 2 (270M Core via Transformers.js)**
   - Loaded when the user activates local workflows.
   - Indexes and retrieves relevant stored workflows and action sequences using MRL-256 embeddings in <10ms.
3. **Stage 2 (Heavy Ranking & Synthesis Options)**:
   - **On-Device Power Tier**: Qwen3.5 2B via WebLLM for desktop users with dedicated WebGPU who opt into local generative synthesis.
   - **Edge Fast Tier**: Decision-2.0-Lux-9B on `api.paulcreates.online` (18.4ms) for mobile/lightweight clients desiring instant sub-20ms calibrated ranking without downloading 1.4GB of weights.
