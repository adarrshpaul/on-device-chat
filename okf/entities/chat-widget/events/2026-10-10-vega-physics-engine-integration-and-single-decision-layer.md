# Event: Vega Decision Engine Integration & Single Decision Layer Architecture

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Type:** Architectural Transition & Engine Integration
- **Source:** User directive & vegaml (NandhaKishorM/vegaml) integration
- **Timestamp:** 2026-10-10T14:34:00Z

## Summary
Integrated the Vega Decision Engine (`vegaml`) into the on-device AI assistant as the PRIMARY System 1 decision engine, while keeping Laya as a SECONDARY load and strictly enforcing a Single Decision Layer policy (exactly 1 decision layer runs at a time).

## Key Implementation Details
1. **Vega Decision Engine (`vegaEngine.ts`)**:
   - Implements non-autoregressive decision making via damped Hamiltonian dynamics in a 64-dimensional latent space ($D=64$).
   - Simulates numerical trajectory relaxation using symplectic Euler integration with friction and soft-capped effective gradients ($\text{force\_max}=20.0$).
   - Reconstructs dynamic potential wells $U(z) = \frac{1}{2}\kappa \|z\|^2 - \sum_k a_k \exp(-\|z - c_k\|^2 / 2\sigma_k^2)$ per question:
     - `choice`: Candidate options projected into 64D wells with semantic affinity depth modulation ($\log a_k \in [-0.5, 3.8]$).
     - `score`: Centers aligned along a 1D rail in $\mathbb{R}^{64}$ so ordinal neighbors are physical neighbors.
     - `boolean`: Binary truth wells evaluated via evidence grounding and statement verification.
   - Thermodynamic temperature calibration: $\tau(x)$ derived dynamically from residual kinetic energy, distance to nearest well bottom, fraction of step budget used, and option count.
   - Outputs calibrated probabilities summing to 1.0, split-conformal prediction sets (LAC sets), explicit abstain flags ($\text{confidence} < 0.65$), and unbound out-of-distribution flags ($\text{nearest} > 3.8$).

2. **Single Decision Layer Policy & Secondary Fallback**:
   - Exactly ONE decision layer runs at a time.
   - Vega is the primary decision engine, operating in 0ms (0 prompt tokens) in browser TypeScript/WASM.
   - If Vega performs well (`!abstain && !unbound && confidence >= 0.65 && margin >= 0.12`), its decision trace is returned immediately.
   - If Vega does not perform well (abstains, unbound OOD, or low confidence), the manager automatically escalates execution to the secondary decision layer (Laya System 1).
   - Decisions are never redundantly run in duplicate; failover is clean and logged in the transparent decision trace.

3. **Escalation Manager & UI Integration**:
   - Tier 1.5 in `TIER_METADATA` updated to `Vega Physics System 1` (14.3M params / 57 MB + Secondary Laya Fallback).
   - `DecisionCard.tsx` updated to surface Vega physics telemetry: settle steps, residual kinetic energy, temperature $\tau$, and conformal prediction sets.
   - Tested and verified: 26/26 Giskard benchmark tests, 6/6 numeric grounding tests, and 4/4 Vega engine unit tests passed.
   - Synced and deployed to Cloudflare Pages: `local-agent-harness` (`agent.paulcreates.online`) and `cloudfare-portfolio-app` (`paulcreates.online`).
