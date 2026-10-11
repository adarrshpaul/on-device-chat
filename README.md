# EdgeOperator (`on-device-chat`)

[![npm version](https://img.shields.io/npm/v/on-device-chat.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/on-device-chat)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-agent.paulcreates.online-emerald?style=flat-square)](https://agent.paulcreates.online)

**Local-first, on-device AI web operator and browser agent widget running 100% inside the browser.**

Turn any web application, dashboard, or air-gapped internal interface into an autonomous, voice-or-chat controllable system with **zero API costs**, **zero server dependencies**, and **zero prompt data egress**.

👉 **[Experience Live Interactive Demo →](https://agent.paulcreates.online)**

---

## ⚡ What It Does

| Capability | What Happens | Benefit |
|---|---|---|
| **Form Synthesis (`⚡ Build steps`)** | Automatically detects page forms, inputs, datalists, and selects into instant 1-click automations | No manual selector guessing or script writing |
| **Point-and-Click Picker (`⌖`)** | Interactive crosshair tool with hover spotlight captures robust, unique CSS selectors from live DOM | Resilient element targeting |
| **Repeated Clicks (`×N`)** | Coalesces rapid clicks (e.g. "Add to Cart" 3×) into a single step with repeat count and SPA DOM re-acquisition | Works reliably on React, Shopify, and Vue stores |
| **Teach 1 → Batch N** | Record 1 user demonstration on a row/card; auto-discovers sibling entities for parameterized batch execution with human approval gate | Automates repetitive table, catalog, and grid workflows |
| **Game & Canvas Autopilot** | Real-time Physics-aware trajectory forecasting and canvas entity inspection | Autonomous gameplay and visual HUD tracking |
| **4-Tier Escalation** | Chrome Gemini Nano (0 MB) → Vega Reflex (<5ms) → MiniLM WebGPU (~15 MB) → WebLLM | Instant load times, no multi-GB model lock-in |

---

## 🚀 3 Quickstart Options

### 1. 1-Line Standalone Drop-in (`<script>`)

Add this script tag to any web page. It automatically injects the UI and mounts without dependencies:

```html
<script src="https://cdn.jsdelivr.net/npm/on-device-chat@0.2.0/dist/edge-operator.min.js" data-auto-init></script>
```

Or initialize programmatically:

```html
<script src="https://cdn.jsdelivr.net/npm/on-device-chat@0.2.0/dist/edge-operator.min.js"></script>
<script>
  EdgeOperator.init({
    mode: 'auto', // 'gemini-nano' | 'compact' | 'auto'
    defaultOpen: true
  });
</script>
```

### 2. Standard Web Component (`<edge-operator>`)

Encapsulated in Shadow DOM to prevent CSS bleeding:

```html
<script src="https://cdn.jsdelivr.net/npm/on-device-chat@0.2.0/dist/edge-operator.min.js"></script>
<edge-operator default-open="true" tier="auto"></edge-operator>
```

### 3. React (`npm install on-device-chat`)

```bash
npm install on-device-chat
```

```tsx
import React from 'react';
import { ChatWidget, EdgeOperator } from 'on-device-chat';
import 'on-device-chat/style.css';

export default function App() {
  return (
    <div>
      <ChatWidget config={{ defaultOpen: false, mode: 'auto' }} />
      <button onClick={() => EdgeOperator.open({ panel: 'workflows' })}>
        Open Automations Studio
      </button>
    </div>
  );
}
```

---

## 🏛️ 4-Tier Progressive Escalation Hierarchy

EdgeOperator cascades dynamically across local in-browser models rather than forcing gigabyte-scale downloads upfront:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 0: Chrome Gemini Nano (0 MB download, Chrome Built-in AI) │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (On fallback or unsupported browser)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: Vega Engine (<5ms) + MiniLM Router (~15 MB WebGPU)      │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (On complex multi-step reasoning)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tier 2: SmolLM2-135M (~80 MB Q4 ONNX, In-Browser LLM)           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (On deep task decomposition)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tier 3: Gemma 4 / WebLLM (~600–800 MB, WebGPU Execution)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Privacy & Architecture Honesty

* **Local Inference**: All neural weights (Chrome Gemini Nano, MiniLM WebGPU, ONNX) execute client-side on the user's hardware.
* **Data Guarantee**: Prompts, form inputs, session credentials, and DOM trees never leave the browser.
* **Optional Cloud Fallback**: If you explicitly configure `mode: 'gemini-api'`, requests use Google AI Studio endpoints. When `mode: 'auto'` or `mode: 'gemini-nano'`, execution is 100% on-device.

---

## ⚙️ Programmatic API

```typescript
import EdgeOperator from 'on-device-chat';

// Version
console.log(EdgeOperator.version); // "0.2.0"

// Open widget or deep-link directly into Workflow Studio
EdgeOperator.open({ panel: 'workflows' });
EdgeOperator.open({ panel: 'chat' });

// Close widget
EdgeOperator.close();

// Destroy instance and unmount
EdgeOperator.destroy();
```

---

## 🧪 Verification & Testing

EdgeOperator includes 10 automated test suites with real browser validation:

```bash
npm test
```

* `test:industrial`: Industrial OT WBM recognition & parameter extraction.
* `test:workflows`: Dynamic in-memory workflow synthesis and repeat click coalescing.
* `test:consistency`: Scoped CSS isolation under hostile host stylesheets.
* `test:giskard`: Giskard LLM security and prompt injection benchmark.
* `test:sota`: Mind2Web, WebArena, and WebVoyager benchmarks.

---

## 📄 License

[Apache License 2.0](LICENSE) © 2026 Adarrsh Paul.
