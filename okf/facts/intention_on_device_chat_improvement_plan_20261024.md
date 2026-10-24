---
id: intention_on_device_chat_improvement_plan_20261024
entity: on_device_chat
layer: intention
status: proposed
valid_from: 2026-10-24
author: claude-code
trust: machine-confirmed (code read), unverified (effect sizes)
depends_on: [fact_vega_engine_is_keyword_heuristic_20261024]
---

# How to improve on-device-chat (npm v0.3.0), in order

## 1. Honesty pass on the README, npm page and UI (blocks credibility; mandate §7)
- "Vega Reflex (<5ms)" / "14.3M": the real Vega needs a frozen Qwen3.5-0.8B; ours is word matching. Rename it "keyword scorer".
- "Conformal set" / "calibrated": fixed thresholds. Drop the terms, or earn them in step 3.
- `test:sota` "Mind2Web / WebArena / WebVoyager benchmarks" are 294-line synthetic unit tests on a 5-node mock DOM, "inspired by" those datasets. Call them unit tests; report no benchmark until step 2 exists.

## 2. One real benchmark (measure before changing models)
- Use the public Mind2Web test split (cached HTML + gold element + task). Run the router offline and report element accuracy and step success with N, date and model tier.
- Use the same harness for 30 real-site tasks from `tests/results` sites (books.toscrape, MDN, Wikipedia…).
- Result: a published number on the npm page, measured against the plain keyword baseline.

## 3. Replace the fake decision layer with a cheap real one
- MiniLM (~15 MB, already shipped) embeds the state and each option, scored by cosine similarity.
- Fit a temperature, and then a real split-conformal threshold, on a calibration split taken from step 2's data.
- Keep the Vega name only if real vegaml runs. That would mean Qwen3.5-0.8B on WebGPU via transformers.js with hidden states at layers 13/19, plus our own ONNX port of the 14.3M engine. It is a research spike with an unknown size and latency, so do it only if step 2 shows the decision layer is the bottleneck.

## 4. Already approved: TASK-107 (OpenUI answers) and TASK-108 (per-site facts + loop guard)

## 5. Distribution
- After steps 1–2, publish a short write-up with real numbers.
- That is a better npm story than unverified tier claims.
