# Fact & Architectural Decision: Dedicated Canvas Grounding with LightOnOCR-3-0.8B

- **Status**: Accepted / Final Architecture Decision
- **Date**: 2026-10-10
- **Scope**: Multimodal Canvas & Graphic Grounding Architecture (`on-device-chat`)
- **Decision**: Adopt LightOnOCR-3-0.8B exclusively for Canvas / Non-DOM Visual Grounding

## 1. Audit of Active Model Tiers Against Canvas / Visual Grounding

| Model Tier | Model Name | Architecture | Canvas / Vision Support? | Audit Verdict |
|---|---|---|---|---|
| **Tier 0** | Gemini Nano | Chrome Built-in LLM | ❌ Text-only in Chrome Stable. Multimodal Prompt API (`expectedInputs: [{type: 'image'}]`) is experimental / fails on stable builds. | Cannot reliably inspect Canvas. |
| **Tier 1** | MiniLM-L6-v2 | 22M BERT Embedder | ❌ Pure text vector space. No pixel or token vision ingestion. | 0% Canvas capability. |
| **Tier 1.5** | Vega / Laya | 14.3M Physics Classifier | ❌ Non-autoregressive discrete decision head. | 0% Canvas capability. |
| **Tier 2** | SmolLM2-135M | Llama-style Decoder LLM | ❌ Pure text autoregression. | 0% Canvas capability. |
| **Tier 3** | Gemma 4 / Gemma 2 2B | Google Gemma Decoder | ❌ Pure text autoregression (lacks SigLIP / PaliGemma vision projector). | 0% Canvas capability. |
| **Service Layer** | `VisionService` (Current) | `Xenova/moondream2` (900MB) | ⚠️ Generic VQA, but lacks specialized UI OCR, coordinate bounding box prediction, or chart data extraction. | Inadequate for precise canvas button/chart grounding. |

## 2. Definitive Finding
**None of the 5 active model tiers support Canvas UI perception, text extraction, or element grounding.** When the user navigates `<canvas>` elements (e.g., Three.js 3D world on `paulcreates.online`, Figma, canvas charts, or WebGL views), the DOM accessibility tree sees only an opaque `<canvas>` tag with zero inner buttons or text.

## 3. The Final Architecture Decision
1. **Division of Responsibility**:
   - **HTML DOM Web Pages**: Governed 100% by `A11yTreeEngine` and `ActionDispatcher` (<2ms, 0 MB download).
   - **Canvas / WebGL / Document Images**: Governed by **`LightOnOCR-3-0.8B`**.
2. **LightOnOCR-3-0.8B Capabilities for Canvas**:
   - **Transcription Mode**: Extracts rendered text and labels from canvas frames.
   - **Grounding Mode**: Predicts exact bounding boxes `[ymin, xmin, ymax, xmax]` for visual buttons, legends, and controls inside the canvas, feeding into `ActionDispatcher.clickCoordinates(normX, normY)`.
   - **Chart/Table Mode**: Converts visual data plots inside canvas into structured HTML tables.
3. **Execution Path**:
   - Serviced via dedicated edge/container endpoint (vLLM / serverless worker) or ONNX WebGPU export, triggered only when target is `<canvas>` or uploaded document, protecting the default browser bundle from weight bloat.
