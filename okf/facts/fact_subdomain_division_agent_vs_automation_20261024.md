---
type: fact
valid_from: 2026-10-24
learned_at: 2026-10-24T17:53:00Z
layer: current
trust: verified
author: user-mandate
---

# Fact: Strict Subdomain Boundary — agent.paulcreates.online vs automation.paulcreates.online

## Hard Invariant (User Mandate 2026-10-24)
1. **`https://automation.paulcreates.online/`**:
   - **Exclusively** hosts the entire Sovereign Industrial Automation Suite, OpenPLC Web Studio, Mars PID/Sabatier digital twins, and SCADA workbenches.
   - Deployed from `~/foundry/docs/` to Cloudflare Pages project `process-automation-hub`.

2. **`https://agent.paulcreates.online/`**:
   - **Exclusively** hosts the EdgeOperator / `on-device-chat` AI Agent demo (`~/foundry/gemma4-chat-agent/frontend/docs/`).
   - It MUST NEVER contain or serve automation, SCADA, or PLC twins.
   - Any prior deployment of `~/foundry/docs/` to the `local-agent-harness` project was an erroneous deployment overwrite and must never happen again.

3. **`https://aasx.paulcreates.online/`**:
   - Exclusively hosts the AASX Package Explorer & 3D Asset Administration Shell Digital Twin (`aasx-voyager`).
