# EdgeOperator (`@edgeoperator/core` / `on-device-chat`)

[![npm version](https://img.shields.io/npm/v/on-device-chat.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/on-device-chat)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Benchmarks: 100% Passed](https://img.shields.io/badge/Benchmarks-100%25%20Passed-brightgreen?style=flat-square)](https://agent.paulcreates.online)
[![Extension: MV3](https://img.shields.io/badge/Chrome_Extension-MV3_Ready-purple?style=flat-square&logo=google-chrome)](https://github.com/adarrshpaul/on-device-chat)
[![Air-Gapped: IEC 62443](https://img.shields.io/badge/Air--Gapped-IEC%2062443-emerald?style=flat-square)](https://agent.paulcreates.online)

An autonomous, local-first on-device web agent and Chrome Developer Extension running **100% inside the user's browser**. Built for field engineers and technicians operating air-gapped **Industrial Web-Based Management (WBM)** interfaces (Siemens SCALANCE, Schneider Electric ConneXium, Phoenix Contact, Wago, Moxa, SIMATIC RTUs) and modern complex web applications.

Powered by **Chrome Built-in Gemini Nano** (0 MB), **Vega Hamiltonian Decision Engine** (<5ms reflex), **MiniLM WebGPU**, and **WebLLM**. Zero cloud API costs, zero data egress, air-gapped OT network safety, and 100% dynamic DOM discovery.

---

## 🏭 Why EdgeOperator for Industrial OT Web-Based Management?

Field engineers configuring industrial Ethernet switches, managed gateways, and PLCs across manufacturing plants and utility substations face repetitive, high-stakes manual routines:
- **Zero Cloud Access**: Factory floor subnets (`192.168.x.x` / `10.x.x.x`) are strictly air-gapped without internet access. Cloud-based AI agents (OpenAI, Claude, cloud RPA) cannot connect.
- **Form-Heavy, Left-Navigation UIs**: Siemens SCALANCE WBM, Schneider ConneXium, Phoenix Contact FL SWITCH, and Wago interfaces share a universal pattern: hierarchical left tree navigation, tabular parameter matrices, and explicit two-stage commit buttons (`[Set Values]`, `[Apply]`, `[Save to switch]`).
- **High-Risk Configuration Drifts**: Applying VLAN assignments, port speeds, QoS priorities, or NTP/SNTP addresses across 24 switches in a rack manually is error-prone. One missed click halts production.

**EdgeOperator solves this locally**:
1. **100% Air-Gapped & Offline**: Runs purely on the technician's laptop browser. Zero telemetry, zero cloud calls, zero firewall exemptions needed.
2. **Dynamic OT WBM Grounding (Rule 9)**: 100% dynamic in-memory DOM inspection. Zero hardcoded vendor templates or fragile XPath selectors. Automatically identifies commit buttons and hierarchical tree menus.
3. **"Teach 1 → Batch N" Field Commissioning**: Record the configuration of 1 port or 1 switch, verify the diff, and replay across N ports or devices deterministically with human confirmation.
4. **Rugged High-Contrast Plant Mode**: Dedicated `.eo-rugged-mode` CSS theme engineered for visibility on ruggedized laptops under high-glare plant floors and outdoor field stations.

---

## 🚀 Key Features in v0.3.0

- **EdgeOperator Rebranding & Dual Compatibility**:
  - Drop-in custom elements: `<edge-operator>` and backwards-compatible `<on-device-chat>`.
  - Global runtime bindings: `window.EdgeOperator`, `window.OnDeviceChat`, and `window.Gemma4Agent`.
  - Dual build distributions: `dist/edge-operator.min.js` and `dist/on-device-chat.min.js`.
- **Industrial OT WBM Autonomous Recognition**:
  - Dynamically detects and prioritizes commit buttons (`Set Values`, `Apply`, `Save to switch`, `Save configuration`, `Save to NVM`, `Commit`).
  - Synthesizes dynamic navigation paths from hierarchical left-tree menus (`System`, `Security`, `Passwords`, `Layer 2`, `Layer 3`, `Load & Save`, `Diagnostics`, `Maintenance`).
  - Dynamically parses embedded web server tables even when `<tbody>` tags are missing or rows use raw `<tr>` wrappers.
- **"Teach 1 → Batch N" Parameter Cloner**:
  - Dynamically extracts entity tables (Ports, VLANs, Admin States, PoE, IP Subnets).
  - Parameterizes recorded user actions and presents an explicit confirmation card with row counts and action diffs before execution.
- **Chrome Developer Extension (Manifest V3)**:
  - Packaged MV3 extension (`extension/`) with background service worker, action popup, Alt+Shift+A hotkey, and bit-parity bundle synchronization.
- **Universal Cross-Application CSS Isolation**:
  - Impenetrable scoped resets (`!important`), inline defensive inputs, and `z-index: 2147483647` protecting against hostile host stylesheets.
- **Canvas Game Autopilot & Zero-Occlusion HUD**:
  - Dynamic left/right auto-docking preserving game viewports, Mini HUD bar, and Ghost Transparency mode.
- **Omni-Storage Error Defense**:
  - All storage accesses (`localStorage`, `sessionStorage`, `indexedDB`) wrapped in synchronous `try / catch` blocks with seamless in-memory fallbacks on restricted origins.

---

## 🏛️ Multi-Model Escalation & Specialty Matrix

Rather than forcing users to download heavy gigabyte-scale models upfront, EdgeOperator cascades dynamically through four local tiers:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 0: Chrome Gemini Nano (0 MB download, Chrome Built-in AI) │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (On fallback or unsupported browser)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: MiniLM Semantic Router (~15 MB, Transformers.js WebGPU) │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (On complex multi-step reasoning)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tier 2: SmolLM2-135M (~80 MB Q4 ONNX, Fast In-Browser LLM)      │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (On deep task decomposition)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tier 3: Gemma 4 E2B (~600–800 MB, WebLLM WebGPU Execution)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚡ The Five Canonical Agent Primitives

EdgeOperator executes actions via an isolated, deterministic host harness strictly decoupling **"decide"** (frozen on-device model) from **"do"** (host execution):

1. **`browse`**: Visual snapshot, element inspection (`inspect(el)`), smooth scrolling, clicks, and text entry.
2. **`search`**: Fast in-page text scanning, selector generation, and element discovery.
3. **`sandbox`**: Isolated JS computation for math, IP subnet calculation, or data transformation without DOM access.
4. **`read` / `write`**: Temporary agent scratchpad storage (`mem://...`) with automatic >1KB context compaction.
5. **`ask`**: Human permission gate before sensitive mutations (e.g. switch reboot, NVRAM commit).

---

## 📦 Installation & Usage

### 1. React / Modern Web App (npm)

```bash
npm install on-device-chat
# or npm install @edgeoperator/core
```

```tsx
import React from 'react';
import { ChatWidget } from 'on-device-chat'; // or @edgeoperator/core
import 'on-device-chat/style.css';

export default function App() {
  return (
    <div>
      {/* EdgeOperator Drop-In Widget */}
      <ChatWidget
        initialTier="gemini-nano"
        defaultOpen={false}
      />
    </div>
  );
}
```

### 2. Standalone Zero-Config Script Tag (Field Laptops & WBMs)

Add to any web interface with **just 1 line of HTML** — zero build step, automatic CSS injection:

```html
<!-- Instant drop-in: automatically injects CSS and mounts EdgeOperator -->
<script src="dist/edge-operator.min.js" data-auto-init></script>
```

Or initialize programmatically:

```html
<script src="dist/edge-operator.min.js"></script>
<script>
  // Mount anywhere on the page or as a floating launcher
  EdgeOperator.init({
    mode: 'gemini-nano', // 'gemini-nano' | 'compact' | 'gemini-api'
    defaultOpen: true
  });
</script>
```

*(Legacy `OnDeviceChat.init()` remains 100% backwards-compatible).*

### 3. Chrome Extension (Manifest V3)

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `extension/` directory from this repository.
4. Open any page or industrial switch WBM and press `Alt+Shift+A` (or click the EdgeOperator extension icon) to launch the agent.

---

## 🧪 Testing & Verification

The suite includes 10 automated test suites with 100% pass rates:

```bash
cd frontend
npm test
```

- **`test:industrial`**: Validates dynamic commit button recognition (`[Set Values]`, `[Apply]`), hierarchical tree navigation, and table grid extraction on Siemens SCALANCE XC-208 and Schneider Electric ConneXium fixtures.
- **`test:workflows`**: Validates dynamic in-memory workflow synthesis and Rule 9 compliance.
- **`test:consistency`**: Verifies CSS isolation under hostile host rules (Amazon, Wikipedia, Bootstrap, Canvas games).
- **`test:giskard`**: Verifies 26/26 adversarial security, goal-hijacking, and sandbox escape benchmarks.
- **`test:sota`**: Validates Mind2Web, WebArena, WebVoyager, and SeeClick integration.

---

## 📂 Repository Structure

```
gemma4-chat-agent/
├── extension/                    # Chrome MV3 Extension
│   ├── manifest.json             # Extension manifest (v0.2.0 EdgeOperator)
│   ├── background.js             # Background service worker & context menus
│   ├── popup.html / popup.js     # Action popup UI
│   └── content/                  # Synchronized content scripts & CSS
├── frontend/                     # Core library package
│   ├── src/                      # TypeScript sources
│   │   ├── components/           # UI components (Widget, Header, Input, Studio, BatchCard)
│   │   ├── lib/                  # Agent Harness, WorkflowPredictor, BatchEngine, A11yTree
│   │   └── main.tsx              # Library entry point & Web Component registrations
│   ├── tests/                    # 10 automated test suites & fixtures
│   │   ├── fixtures/             # Realistic Siemens SCALANCE & Schneider WBM mocks
│   │   └── test_industrial_ot_wbm_recognition.mjs
│   └── package.json              # Package manifest
├── okf/                          # Bi-temporal OKF knowledge framework
└── README.md                     # Documentation
```

---

## 📄 License

[Apache License 2.0](LICENSE) © 2026 Adarrsh Paul.
