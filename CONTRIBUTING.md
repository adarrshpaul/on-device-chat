# Contributing to Gemma 4 Chat Widget & Agent

Thank you for your interest in contributing to `gemma4-chat-widget`! We welcome bug reports, documentation improvements, feature suggestions, and code contributions.

---

## Development Setup

### Prerequisites
- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **Chrome / Chromium Browser**: Version 138+ recommended for testing on-device Gemini Nano Prompt API.

### Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/adarrshpaul/gemma4-chat-agent.git
   cd gemma4-chat-agent/frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in Chrome to test the widget with live mock storefront items.

---

## Testing & Quality Assurance

Before submitting a pull request, ensure all tests, lint checks, and builds pass cleanly:

```bash
# Run unit & Giskard adversarial benchmark tests
npm test

# Run ESLint check
npm run lint

# Run full multi-target build (ESM, CJS, Standalone IIFE, and .d.ts types)
npm run build
```

---

## Architectural Guidelines

When contributing to the Agent Harness or Escalation Manager:
1. **Architectural Honesty (No Faked Inference)**: All model outputs and escalations must represent genuine neural execution. Never simulate model capabilities with silent hardcoded templates.
2. **Context Compaction**: Any DOM observation or search result exceeding 1 KB must be compacted through `compactObservation` using `mem://...` references.
3. **DOM Isolation**: Use `smartQuerySelector` and `isWidgetElement` from `domUtils.ts` to ensure the agent never interacts with or recurses upon its own UI elements.
4. **Credential Safety**: Never commit `.env` files or API secrets.

---

## Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-enhancement
   ```
2. Commit your changes with clear, descriptive commit messages.
3. Push to your fork and submit a Pull Request to `main`.
4. Ensure CI passes all checks. A maintainer will review your contribution.
