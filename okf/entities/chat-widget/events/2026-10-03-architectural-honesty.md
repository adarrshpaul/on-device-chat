---
type: event
valid_from: 2026-10-03
valid_to: 2026-10-03
learned_at: 2026-10-03T02:22:00Z
layer: current
trust: machine-confirmed
---

# Event: Architectural Honesty & Removal of Regex Fallbacks

- Audited the codebase per Rule 7 (Zero Fraud & Architectural Honesty Mandate).
- Acknowledged to the user that previous responses utilized heuristic regex/keyword fallback while ONNX models were offline/uninitialized, which did not constitute real generative neural inference.
- Completely removed silent heuristic keyword fallbacks in `CompactEngine`.
- Enforced genuine neural forward passes using `Xenova/all-MiniLM-L6-v2` dense embeddings and `HuggingFaceTB/SmolLM2-135M-Instruct` on WebGPU, with explicit neural confidence percentages and transparent status.
