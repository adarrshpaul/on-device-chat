# EdgeOperator (`on-device-chat`)

[![npm version](https://img.shields.io/npm/v/on-device-chat.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/on-device-chat)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-agent.paulcreates.online-emerald?style=flat-square)](https://agent.paulcreates.online)

**Local-first, on-device AI web operator and browser agent widget running 100% inside the browser.**

Turn any web application, dashboard, or air-gapped internal interface into an autonomous, voice- or chat-controllable system with **zero API costs**, **zero cloud server dependencies**, and **zero prompt data egress**.

👉 **[Experience Live Interactive Demo at agent.paulcreates.online →](https://agent.paulcreates.online)**

---

## ⚡ Core Superpowers

| Capability | What Happens | Benefit |
|---|---|---|
| **🎙️ On-Device Voice Dictation** | Wispr Flow style voice typing via local WebGPU Whisper with Web Audio FFT visualizer, context-aware disfluency cleaner, personal dictionary, and direct DOM injection (ProseMirror, Lexical, Slate, Monaco) | Fast, private dictation without sending audio to third-party servers |
| **🛡️ SafetyGate & Storage Isolation** | Intercepts destructive actions (`DELETE`, checkout, order placement) behind an explicit user confirmation modal; isolates storage per origin | Prevents runaway agent loops and unintended state changes |
| **🔧 Self-Healing Locators & Real Waits** | 3-pass element grounding (A11y tree ID → resilient CSS selectors → text + role scan) with dynamic polling | Zero flaky automation steps on modern SPAs (React, Vue, Angular) |
| **⚡ Form Synthesis (`⚡ Build steps`)** | Discovers live DOM inputs, selects, radio groups, and textareas into instant 1-click automations | Zero hardcoded scripts; adapts dynamically to any web form |
| **⌖ Point-and-Click Picker** | Interactive crosshair tool with hover spotlight captures robust, unique CSS selectors from live DOM | Resilient element targeting without inspecting dev tools |
| **×N Repeated Clicks** | Coalesces rapid clicks (e.g. "Add to Cart 3×") into a single atomic action with SPA `aria-busy` DOM re-acquisition | Eliminates double-orders and race conditions on SPAs |
| **📦 Teach 1 → Batch N** | Record 1 demonstration on a row/card; auto-discovers sibling entities for parameterized batch execution with human approval gate | Automates repetitive table, catalog, and grid workflows |
| **📥 RFC 4180 Table Extraction** | Extracts structured data from any DOM table or list into validated RFC 4180 CSV or JSON with 0 prompt overhead | 1-click export of financial, inventory, and telemetry grids |
| **🎭 Playwright Test Export** | 1-click export of recorded web automations directly into clean, runnable `@playwright/test` scripts | Instant E2E test scaffolding from natural user actions |
| **👻 Translucent Ghost Mode** | Frosted-glass backdrop mode with dock switcher (left/right dock or floating pill) | Keeps underlying UI visible while the agent navigates |
| **🏛️ 4-Tier Escalation** | Chrome Gemini Nano (0 MB) → Vega Reflex (<5ms) → MiniLM WebGPU (~15 MB) → WebLLM | Instant load times without requiring multi-GB model downloads upfront |

---

## 🚀 3 Quickstart Options

### 1. 1-Line Standalone Drop-in (`<script>`)

Add this script tag to any web page. It automatically injects the UI and mounts without external dependencies:

```html
<script src="https://cdn.jsdelivr.net/npm/on-device-chat@0.4.0/dist/edge-operator.min.js" data-auto-init></script>
```

Or initialize programmatically:

```html
<script src="https://cdn.jsdelivr.net/npm/on-device-chat@0.4.0/dist/edge-operator.min.js"></script>
<script>
  EdgeOperator.init({
    mode: 'auto', // 'gemini-nano' | 'compact' | 'auto'
    defaultOpen: true
  });
</script>
```

### 2. Standard Web Component (`<edge-operator>`)

Encapsulated in Shadow DOM with strictly scoped CSS to prevent stylesheet bleeding:

```html
<script src="https://cdn.jsdelivr.net/npm/on-device-chat@0.4.0/dist/edge-operator.min.js"></script>
<edge-operator default-open="true" tier="auto"></edge-operator>
```

### 3. React / Bundler (`npm install on-device-chat`)

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
* **Zero Data Egress Guarantee**: Prompts, form inputs, session credentials, and DOM trees never leave the browser.
* **Optional Cloud Fallback**: If you explicitly configure `mode: 'gemini-api'`, requests use Google AI Studio endpoints. When `mode: 'auto'` or `mode: 'gemini-nano'`, execution is 100% on-device.

---

## ⚙️ Programmatic API

```typescript
import EdgeOperator from 'on-device-chat';

// Version
console.log(EdgeOperator.version); // "0.4.0"

// Open widget or deep-link directly into specific workstation tabs
EdgeOperator.open({ panel: 'workflows' });
EdgeOperator.open({ panel: 'chat' });
EdgeOperator.open({ panel: 'navigator' });
EdgeOperator.open({ panel: 'evals' });

// Close widget
EdgeOperator.close();

// Destroy instance and unmount
EdgeOperator.destroy();
```

---

## 🧪 Verification & Testing

EdgeOperator includes 17 automated test suites with real browser validation:

```bash
npm test
```

* `test:voice`: On-device Whisper WebGPU transcription, personal dictionary, and DOM text injection.
* `test:safety`: SafetyGate approval modal, destructive action interception, and storage isolation.
* `test:task114`: Dynamic real waits, self-healing locators, Playwright script export, and table extraction.
* `test:industrial`: Industrial OT WBM recognition & parameter extraction.
* `test:workflows`: Dynamic in-memory workflow synthesis and repeat click coalescing.
* `test:consistency`: Scoped CSS isolation under hostile host stylesheets.
* `test:giskard`: Giskard LLM security and prompt injection benchmark.
* `test:sota`: Mind2Web, WebArena, and WebVoyager benchmarks.

---

## 📄 License

[Apache License 2.0](LICENSE) © 2026 Adarrsh Paul.
