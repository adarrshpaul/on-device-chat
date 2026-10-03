---
type: state
valid_from: 2026-10-03
valid_to: 2026-10-03T03:00:00Z
learned_at: 2026-10-03T02:31:00Z
layer: previous
trust: machine-confirmed
---

# State: Progressive Multi-Tier Escalation Architecture

1. **Initial Tier**: Chrome Gemini Nano (0 MB).
2. **Intermediate Tiers**: MiniLM Router (~15-20 MB ONNX) and SmolLM2-135M (~80 MB Q4 ONNX WebGPU).
3. **Deep Tier**: Gemma 4 E2B Unified Architecture (~600-800 MB).
4. **User Feedback Protocol**:
   - Every response provides 👍 / 👎 / "Escalate".
   - Negative rating triggers transparent notification: *"I understand this didn't meet your expectations. I am escalating this conversation to a more capable neural model..."*
5. **Background Prefetching**:
   - Uses `requestIdleCallback`, `fetch(..., { priority: 'low' })`, checks `navigator.connection` (suppresses on Save-Data / 2G), and caches in Cache API.
