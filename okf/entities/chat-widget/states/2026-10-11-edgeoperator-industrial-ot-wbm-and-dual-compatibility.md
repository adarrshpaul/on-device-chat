---
id: state_edgeoperator_industrial_ot_wbm_and_dual_compatibility
layer: history
valid_from: 2026-10-11T22:00:00Z
valid_to: 2026-10-12T02:25:00Z
entity: chat-widget
---

# State: EdgeOperator Industrial OT WBM Specialization & Dual Backwards Compatibility

## Active State Properties
- **Product Identity:** Rebranded from generic on-device chat to **EdgeOperator • Autonomous On-Device Web Operator**, targeting zero-cloud air-gapped industrial OT Web-Based Management (WBM) switches, PLCs, RTUs, and telemetry controllers (Siemens SCALANCE, Schneider ConneXium, Phoenix Contact, Wago, Moxa).
- **Dynamic Industrial OT Recognition (Rule 9):**
  - Synthesizes 100% dynamic workflows for commit and navigation actions without hardcoded selectors.
  - Recognizes commit buttons via text and value inspection: `Set Values`, `Apply`, `Save to switch`, `Save configuration`, `Save to NVM`, `Commit`.
  - Recognizes hierarchical left-tree navigation links: `System`, `Security`, `Passwords`, `Layer 2`, `Layer 3`, `Load & Save`, `Diagnostics`, `Maintenance`, `PROFINET`, `SNTP`.
  - Discovers table grids in embedded web servers that lack `<tbody>` or use raw `<tr>` wrappers.
- **"Teach 1 → Batch N" Field Commissioning:**
  - Extracts network table parameters (Port, VLAN, Admin State, PoE, Speed/Duplex) dynamically into structured entities.
  - Replays single-row parameter modifications across entire switch racks with human-in-the-loop validation before firing commit buttons.
- **Rugged High-Contrast Plant Mode:**
  - Added `.eo-rugged-mode` CSS theme variant offering ultra-high contrast ratio (>7:1) for field technicians operating laptops in high-glare plant floors and outdoor substations.
- **Dual Backwards Compatibility:**
  - Both `<edge-operator>` and `<on-device-chat>` custom elements registered.
  - `window.EdgeOperator = window.OnDeviceChat = window.Gemma4Agent = instance`.
  - Dual CSS custom properties `--eo-*` and `--g4-*`.
  - Dual widget container selectors `.eo-widget-container` and `.g4-widget-container`.
  - Dual storage keys (`eo_dock_position`/`g4_dock_position`, `eo_ondevice_model_permission`/`g4_ondevice_model_permission`).
  - Dual build artifacts: `dist/edge-operator.min.js` and `dist/on-device-chat.min.js`.
- **Chrome MV3 Extension:**
  - Branded to EdgeOperator v0.2.0 in `manifest.json`, `popup.html`, `popup.js`, and `background.js`.
  - Context menus and command shortcuts (`Alt+Shift+A`) synchronized.
- **Zero-Cloud Air-Gapped Security:**
  - Strict local-first execution complying with industrial air-gap mandates (IEC 62443 / NIS2).
  - No external cloud API calls, zero telemetry, full offline operation.
- **Verification:**
  - Validated by comprehensive test suite including `test:industrial` (12 passed, 0 failed) with realistic Siemens SCALANCE and Schneider Electric WBM mock environments.
