# EdgeOperator (`@edgeoperator/core` / `on-device-chat`)

[![npm version](https://img.shields.io/npm/v/on-device-chat.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/on-device-chat)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Benchmarks: 100% Passed](https://img.shields.io/badge/Benchmarks-100%25%20Passed-brightgreen?style=flat-square)](https://agent.paulcreates.online)
[![Air-Gapped: IEC 62443](https://img.shields.io/badge/Air--Gapped-IEC%2062443-emerald?style=flat-square)](https://agent.paulcreates.online)

A local-first, on-device AI agent and autonomous web operator running entirely inside the user's browser. Built for field engineers managing air-gapped **Industrial Web-Based Management (WBM)** interfaces (Siemens SCALANCE, Schneider Electric ConneXium, Phoenix Contact, Wago, Moxa, SIMATIC RTUs) and complex enterprise web applications.

Powered by **Chrome Built-in Gemini Nano** (0 MB), **Vega Decision Engine** (<5ms reflex), **MiniLM WebGPU**, and **WebLLM**. Zero cloud API costs, zero data egress, and 100% dynamic DOM discovery.

---

## 🏛️ 4-Tier Progressive Escalation Hierarchy

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

EdgeOperator executes actions via an isolated, deterministic host harness that strictly decouples **"decide"** (frozen on-device model) from **"do"** (host execution):

1. **`browse`**: Visual snapshot, element inspection (`inspect(el)`), smooth scrolling, clicks, and text entry.
2. **`search`**: Fast in-page text scanning, selector generation, and element discovery.
3. **`sandbox`**: Isolated JS computation for math, date math, or data transformation without DOM access.
4. **`read` / `write`**: Temporary agent scratchpad storage (`mem://...`) with automatic >1KB context compaction.
5. **`ask`**: Human permission gate before sensitive mutations or unresolvable ambiguities.

---

## 📦 Installation & Usage

### 1. React (npm)

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
      <ChatWidget
        initialTier="gemini-nano"
        defaultOpen={false}
      />
    </div>
  );
}
```

### 2. Standalone Zero-Config Script Tag

```html
<!-- 1-line instant drop-in -->
<script src="dist/edge-operator.min.js" data-auto-init></script>
```

Or configure programmatically:

```html
<script src="dist/edge-operator.min.js"></script>
<script>
  EdgeOperator.init({
    mode: 'gemini-nano',
    defaultOpen: true
  });
</script>
```

*(Legacy `OnDeviceChat.init()` remains 100% backwards-compatible).*

---

## 🧪 Testing & Verification

Run the full suite of 10 automated test suites:

```bash
npm test
```

Includes:
- `npm run test:industrial`: Industrial OT WBM recognition & parameter extraction.
- `npm run test:workflows`: Dynamic in-memory workflow synthesis (Rule 9).
- `npm run test:consistency`: Scoped CSS isolation under hostile host stylesheets.
- `npm run test:giskard`: Giskard LLM security and goal-hijacking benchmark.
- `npm run test:sota`: Mind2Web, WebArena, WebVoyager, and SeeClick integration.

---

## 📄 License

[Apache License 2.0](LICENSE) © 2026 Adarrsh Paul.
