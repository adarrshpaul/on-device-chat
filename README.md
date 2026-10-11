# On-Device Chat (`on-device-chat`)

[![npm version](https://img.shields.io/npm/v/on-device-chat.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/on-device-chat)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Benchmarks: 100% Passed](https://img.shields.io/badge/Benchmarks-100%25%20Passed-brightgreen?style=flat-square)](https://agent.paulcreates.online)
[![Extension: MV3](https://img.shields.io/badge/Chrome_Extension-MV3_Ready-purple?style=flat-square&logo=google-chrome)](https://github.com/adarrshpaul/on-device-chat)
[![Live Demo](https://img.shields.io/badge/Demo-agent.paulcreates.online-6366f1?style=flat-square)](https://agent.paulcreates.online)

A local-first, on-device AI chat widget, autonomous browser agent, and Chrome Developer Extension running entirely inside the user's browser. Built with **Chrome Built-in Gemini Nano** (0 MB), **Vega Decision Engine** (Conformal Gating & Physics), **MiniLM WebGPU**, and **WebLLM**. Zero cloud API costs, zero data exfiltration, universal CSS isolation, and full deterministic web navigation.

---

## 🚀 What's New in v0.2.0

- **Chrome Developer Extension (Manifest V3)**: Packaged MV3 extension (`extension/`) with background service worker, action popup, Alt+Shift+A hotkey, context menus, and 100% bit-parity sync with the npm bundle.
- **Universal Cross-Application CSS Isolation**: Impenetrable scoped resets (`!important`), inline defensive inputs, and `z-index: 2147483647` protecting against hostile host stylesheets (Amazon, Wikipedia, Bootstrap).
- **100% Dynamic DOM-Grounded Synthesis (Rule 9)**: Zero hardcoded starter workflows. All actions, landmark tours, and automations are dynamically discovered from live DOM nodes and `<canvas>` entities in real time.
- **Canvas Game Autopilot & Zero-Occlusion HUD**: Dynamic left/right auto-docking preserving game viewports (e.g. Basketball Bash with `margin-left: 435px`), with Mini HUD (52px bar) and Ghost Transparency mode (35% opacity).
- **"Teach 1 → Batch N" Macro Automation**: Record repetitive human browser actions on 1 row and replay them deterministically across N rows with human-in-the-loop safety gating.
- **Omni-Storage Error Defense**: All storage singletons (`localStorage`, `sessionStorage`, `indexedDB`) wrapped in synchronous `try / catch` blocks with seamless in-memory fallbacks on restricted origins.

---

## 🏛️ Multi-Model Escalation & Specialty Matrix

Rather than forcing users to download heavy gigabyte-scale models upfront, `on-device-chat` cascades dynamically through four local tiers:

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
npm install on-device-chat
```

```tsx
import React from 'react';
import { ChatWidget } from 'on-device-chat';
import 'on-device-chat/style.css';

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

### 2. Standalone Zero-Config CDN (jsDelivr)

Add to any website with **just 1 line of HTML** — zero build step, zero dependencies, automatic stylesheet injection:

```html
<!-- 1-line instant drop-in: automatically injects CSS and mounts floating chat -->
<script src="https://cdn.jsdelivr.net/npm/on-device-chat" data-auto-init></script>
```

Or configure programmatically:

```html
<!-- Load standalone bundle -->
<script src="https://cdn.jsdelivr.net/npm/on-device-chat"></script>

<script>
  // Mount anywhere on the page or as a floating widget
  OnDeviceChat.init({
    mode: 'gemini-nano', // 'gemini-nano' | 'compact' | 'gemini-api'
    containerId: 'my-chat-root' // optional: target custom container or omit for floating pill
  });
</script>
```

You can also target specific versions or pin the CSS explicitly:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/on-device-chat@0.1.1/dist/style.css">
<script src="https://cdn.jsdelivr.net/npm/on-device-chat@0.1.1/dist/on-device-chat.min.js"></script>
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
