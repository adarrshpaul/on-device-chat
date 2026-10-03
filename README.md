# Gemma 4 Agent & Web Widget (`gemma4-chat-widget`)

[![npm version](https://img.shields.io/npm/v/gemma4-chat-widget.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/gemma4-chat-widget)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Benchmarks: 26/26 Passed](https://img.shields.io/badge/Giskard%20Evals-26%2F26%20Passed-brightgreen?style=flat-square)](https://docs.giskard.ai/)
[![Live Demo](https://img.shields.io/badge/Demo-agent.paulcreates.online-6366f1?style=flat-square)](https://agent.paulcreates.online)

An autonomous, multi-tier client-side web agent and drop-in chat widget running entirely inside the user's browser. Built with **Chrome Built-in Gemini Nano** (0 MB), **Transformers.js WebGPU** (MiniLM / SmolLM2), and **WebLLM** (Gemma 4 E2B). Zero cloud API costs, zero data exfiltration, and full deterministic web navigation.

---

## 🏛️ 4-Tier Progressive Escalation Hierarchy

Rather than forcing users to download heavy gigabyte-scale models upfront, `gemma4-chat-widget` cascades dynamically through four local tiers:

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

The widget executes actions via an isolated, deterministic host harness that strictly decouples **"decide"** (frozen on-device model) from **"do"** (host execution):

1. **`browse`**: Visual snapshot, element inspection (`inspect(el)`), smooth scrolling, clicks, and text entry.
2. **`search`**: Fast in-page text scanning, selector generation, and element discovery.
3. **`sandbox`**: Isolated JS computation for math, date math, or data transformation without DOM access.
4. **`read` / `write`**: Temporary agent scratchpad storage (`mem://...`) with automatic >1KB context compaction.
5. **`ask`**: Human permission gate before sensitive mutations or unresolvable ambiguities.

---

## 👁️ In-Browser Multimodal Vision Perception

The agent can "see" and understand page structure, product cards, canvas graphics, and layouts:
- **Chrome Multimodal Prompt API**: Direct zero-download image understanding in Chrome 138+.
- **DOM Hierarchy Scene Synthesis**: Non-destructive visual perception engine that builds structured scene representations from visible viewport bounding boxes.
- **Agent Spotlight**: High-visibility glowing HUD overlay that visually tracks agent focus as it interacts with web elements.

---

## 🛠️ Chrome DevTools Console Integration

The widget integrates directly with the Chrome DevTools Console:
- **`console.groupCollapsed` & `console.table`**: Every agent trajectory step is logged into collapsible, formatted tables in DevTools.
- **DevTools Companion**: Exposes `window.__G4_AGENT__` for live inspection:
  ```javascript
  // Open DevTools Console on any page with the widget:
  await __G4_AGENT__.getTraces();      // Inspect full eval history & trajectories
  await __G4_AGENT__.getLastTrace();   // View the latest turn
  await __G4_AGENT__.getMetrics();     // View real-time accuracy and pass rates
  __G4_AGENT__.inspectSpotlight();     // Select active element in Elements panel
  ```

---

## 📦 Installation & Usage

### 1. React (npm)

```bash
npm install gemma4-chat-widget
```

```tsx
import React from 'react';
import { ChatWidget } from 'gemma4-chat-widget';
import 'gemma4-chat-widget/style.css';

export default function App() {
  return (
    <div>
      <h1>My Storefront</h1>
      
      {/* Drop-in agent widget */}
      <ChatWidget
        initialTier="gemini-nano"
        defaultOpen={false}
        customTools={{
          addToCart: async ({ quantity, item }) => {
            console.log("Adding to cart:", quantity, item);
            return { success: true, count: quantity };
          },
        }}
      />
    </div>
  );
}
```

### 2. Standalone Vanilla JS / CDN

Add to any HTML page with zero build step:

```html
<!-- Stylesheet -->
<link rel="stylesheet" href="https://unpkg.com/gemma4-chat-widget/dist/style.css" />

<!-- Container -->
<div id="gemma4-widget-root"></div>

<!-- Standalone IIFE Bundle -->
<script src="https://unpkg.com/gemma4-chat-widget/dist/gemma4-agent.min.js"></script>
<script>
  window.initGemma4Widget({
    containerId: "gemma4-widget-root",
    initialTier: "gemini-nano"
  });
</script>
```

---

## 🧪 Testing & Verification

The harness has been tested against the [Giskard Conversation & Chatbot Benchmark](https://docs.giskard.ai/):

```bash
cd frontend
npm test
```

- **Visual Grounding:** Intercepts conversational visual inquiries into structured `browse.see`.
- **Sandbox Security:** Blocks constructor prototype pollution, `globalThis`, and `document.cookie` exfiltration.
- **Parameter Validation:** Validates boundaries (e.g. quantity limits, XSS-safe navigation paths).
- **Catalog Grounding:** Enforces live DOM catalog verification before permitting checkout or cart mutations.

---

## 📂 Repository Structure

```
gemma4-chat-agent/
├── frontend/                     # Core npm package (gemma4-chat-widget)
│   ├── src/                      # TypeScript sources
│   │   ├── components/           # React UI components (Widget, Header, Input, Studio)
│   │   ├── lib/                  # Agent Harness, Escalation, Vision, DOM Utils
│   │   └── index.ts              # Library barrel export
│   ├── tests/                    # Giskard benchmark test suite
│   ├── docs/                     # Static documentation & live demo build
│   └── package.json              # Package manifest
├── fine-tune/                    # Browser LoRA export & training utilities
├── .github/workflows/            # GitHub Actions CI & 2026 Trusted Publishing
├── CONTRIBUTING.md               # Contribution guidelines
├── CODE_OF_CONDUCT.md           # Contributor Covenant
├── SECURITY.md                   # Security reporting policy
└── LICENSE                       # Apache-2.0 License
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details on setting up your environment, running tests, and opening pull requests.

---

## 📄 License

[Apache License 2.0](LICENSE) © 2026 Adarrsh Paul.
