# State: Clean In-Flow Model Download Telemetry & Clamped Progress UI

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** historic
- **Version:** `0.1.9`
- **Status:** Superceded
- **Valid_from:** 2026-10-10T05:20:00Z
- **Valid_to:** 2026-10-10T05:28:00Z

## Summary
The on-device chat widget features a unified, single in-flow model download progress UI with strict [0, 100]% mathematical clamping and ratio normalization across all model weight loaders (Embedder, Laya Q8, SmolLM2, and Gemma 4). Duplicate floating header progress overlays have been eliminated, preventing layout collision and text overflow. Progress telemetry is displayed cleanly with accurate stage indicators, download percentages, and model size metrics without disrupting chat message flow.

## Active Invariants & Rules
1. `Normalized Progress Ratios`: Any progress callback value from ONNX, Transformers.js, or fetch pipelines is automatically normalized via `progRatio = prog > 1 ? prog / 100 : prog` before computation.
2. `Strict [0, 100]% Clamping`: All displayed stage percentages and overall progress bar widths are strictly bounded with `Math.min(100, Math.max(0, val))`.
3. `Single In-Flow Layout`: Exactly one progress element exists in the widget hierarchy, positioned in standard document flow (`shrink-0`) directly below the header. Floating `absolute -bottom-[*]` badges are forbidden to prevent collision.
4. `Universal Site Adaptability`: The assistant autonomously detects host site category, generates live heading action chips, and resolves arbitrary DOM landmarks.
5. `Zero Prompt Overhead on Fast-Path`: Deterministic motor actions execute instantly (<15ms, 0 tokens) with virtual radar gaze pacing.
