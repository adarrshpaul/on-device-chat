# State: Vega Physics Engine Primary with Secondary Laya Fallback

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** current
- **Version:** `0.1.9`
- **Status:** Active
- **Valid_from:** 2026-10-10T14:34:00Z
- **Valid_to:** null

## Summary
The on-device web AI chat assistant employs a physics-based System 1 decision engine based on Vega (`vegaml`), utilizing damped Hamiltonian dynamics in 64-dimensional latent space integrated via symplectic Euler. Vega is established as the PRIMARY decision layer, while Laya System 1 is retained as a SECONDARY load. Under the Single Decision Layer mandate, exactly 1 decision layer executes at a time: Vega runs first; only if Vega abstains, is unbound out-of-distribution, or lacks sufficient certainty/margin does the router fail over to Laya.

## Active Invariants & Rules
1. `Single Decision Layer at a Time`: The agent never runs Vega and Laya concurrently in duplicate. Vega executes first as the primary non-autoregressive decision engine. If Vega yields an in-distribution decision with $\text{confidence} \ge 0.65$ and $\text{margin} \ge 0.12$ without abstaining, its decision is utilized directly.
2. `Autonomous Secondary Failover to Laya`: If Vega abstains ($\text{confidence} < 0.65$), finishes unbound ($\text{nearest} > 3.8$), or flags low margin ($< 0.12$), the router automatically moves to Laya System 1 as the secondary decision layer, documenting the failover in `DecisionTrace.engineUsed` and `DecisionTrace.explanation`.
3. `Hamiltonian Physics Mechanics`:
   - 64D latent state with harmonic confinement ($\kappa = 0.05$).
   - Symplectic Euler numerical integration with damping friction and soft-capped effective gradients ($\text{force\_max} = 20.0$).
   - Gaussian potential wells for candidate options; score levels aligned along a 1D rail.
   - Dynamic thermodynamic temperature calibration $\tau(x)$ from kinetic energy, distance to nearest well, steps used, and option count.
   - Outputs calibrated probabilities, split-conformal prediction sets, abstain flags, and unbound OOD indicators.
4. `Radical Architectural Honesty (Rule 7)`: All decision traces explicitly label whether the decision was resolved by the Vega Hamiltonian engine or escalated to the secondary Laya layer. No simulated tensor steering or false zero-overhead claims are permitted.
5. `Zero-Latency Instant Readiness`: Widget initializes immediately with Vega physics engine ready in 0ms (0 tokens), allowing DOM navigation, site tours, and tool routing to execute instantly without waiting for network downloads.
