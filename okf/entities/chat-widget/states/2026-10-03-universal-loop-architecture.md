---
type: state
valid_from: 2026-10-03T04:08:00Z
valid_to: 2026-10-03T04:15:00Z
learned_at: 2026-10-03T04:08:00Z
layer: history
trust: machine-confirmed
---

# State: Universal Agent Loop Architecture & Tier-Aligned Termination

1. **Immutable User Goal**:
   - The user's initial objective is preserved across all harness iterations. Observations are strictly passed as tool feedback rather than mutating the root query.
2. **Tier-Aligned Execution Strategy**:
   - **Semantic Router (MiniLM)**: Functions as a deterministic intent classifier. Upon tool execution, it consumes the observation and concludes immediately with `{ final: ... }`, preventing recursive re-embedding loops.
   - **Generative LLMs (Nano, SmolLM2, Gemma)**: Multi-step reasoning loops are anchored by explicit completion criteria in prompt feedback, allowing models to close turns naturally.
3. **Primitive Orthogonality**:
   - Read/search primitives (`search`, `read`, `browse:inspect`) produce pure observations without side effects.
   - Write/action primitives (`browse:type`, `browse:click`, `write`, custom tools) mutate host application state.
