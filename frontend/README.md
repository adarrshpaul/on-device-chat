# Gemma 4 & Chrome AI Web Agent Chat Widget (`gemma4-chat-widget`)

> On-device AI chat widget and autonomous browser agent powered by Chrome Built-in Gemini Nano, Gemma 4, SmolLM2, and MiniLM.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/gemma4-chat-widget.svg)](https://www.npmjs.com/package/gemma4-chat-widget)

---

## ✨ Features

- **Chrome Built-in AI First**: Leverages native on-device Gemini Nano (0 MB download, 0 prompt token latency) via the Chrome Prompt API.
- **Autonomous Multi-Tier Escalation**: Seamlessly cascades to MiniLM Router (~15 MB ONNX), SmolLM2-135M (~80 MB Q4 ONNX), and Gemma 4 via E2B sandbox if needed.
- **The Five Canonical Primitives**: Autonomous in-page web agent harness supporting `browse` (inspect, click, type), `search`, `sandbox`, `read`/`write`, and `ask`.
- **Chrome AI Expert Judge & Evals Studio**: Integrated evaluation suite computing Cohen's Kappa ($\kappa$), F1, and step-level rubric grading.
- **Deterministic Macro Compilation**: Compiles human-approved (👍) agent trajectories into 0-token instant playback macros.
- **Dual Consumption**: Use directly as a standard React component or mount imperatively in vanilla JavaScript/HTML.

---

## 📦 Installation

```bash
npm install gemma4-chat-widget
```

Ensure peer dependencies are installed if using React:
```bash
npm install react react-dom
```

---

## 🚀 Usage

### 1. As a React Component

```tsx
import React from 'react';
import { ChatWidget } from 'gemma4-chat-widget';
import 'gemma4-chat-widget/style.css';

export default function App() {
  return (
    <div>
      <h1>My Application</h1>
      
      {/* Floating on-device AI assistant */}
      <ChatWidget
        config={{
          systemPrompt: 'You are an autonomous assistant helping users navigate this store.',
          onToolCall: async (name, args) => {
            console.log('Agent executed host tool:', name, args);
            return { success: true };
          },
        }}
      />
    </div>
  );
}
```

### 2. Vanilla JavaScript / HTML (Imperative Mount)

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/gemma4-chat-widget/dist/style.css" />
</head>
<body>
  <div id="agent-root"></div>

  <script type="module">
    import Gemma4Agent from 'gemma4-chat-widget';

    Gemma4Agent.init({
      containerId: 'agent-root',
      systemPrompt: 'You are an in-browser assistant.',
    });
  </script>
</body>
</html>
```

---

## 🛠️ TypeScript Support

Full TypeScript definitions are included out of the box:

```typescript
import type { 
  Gemma4Config, 
  ChatWidgetProps, 
  ToolDefinition, 
  ModelTier 
} from 'gemma4-chat-widget';
```

---

## 📄 License

Apache-2.0
