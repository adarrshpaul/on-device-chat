---
entity: chat-widget
event: giskard-adversarial-hardening
date: 2026-10-03T13:45:00+05:30
author: Antigravity
---

# Giskard LLM & Chatbot Benchmark Adversarial Hardening

## Context & Motivation
Following the Giskard benchmark methodology (`https://docs.giskard.ai/start/glossary/llm-benchmarks/conversation-and-chatbot`), evaluated the web agent and harness against five vulnerability dimensions:
1. Security & Sandbox Escapes (Prototype pollution, global leakages, process/network access).
2. Tool Parameter Abuse & Sycophancy (Negative values, overflow, NaN, malicious URL protocols).
3. Misinformation & Hallucination (Addition of Information / ordering non-existent inventory).
4. Multi-turn Conversational Coherence & Visual Perception Interception ("What is on this page?").
5. Architectural Honesty & Progressive Tier Isolation (Eliminating silent fallbacks between tiers).

## Changes & Hardening Implemented
1. **Decision Parser & Visual Interception (`harnessDecisionParser.ts`)**:
   - Expanded regex from `what's on this page` to `/^(can you see|what do you see|what('s|\s+is)\s+on\s+(this|the)\s+page|what('s|\s+is)\s+on\s+(the\s+)?screen|describe\s+(the|this)\s+(page|screen)|what\s+products\s+are\s+on\s+this\s+page)/i`.
   - Intercepts conversational preambles on visual questions, auto-routing directly to `browse(action="see")`.

2. **Semantic Routing & Argument Extraction Hardening (`compactEngine.ts`)**:
   - Raised confidence gating threshold from `0.28` to `0.45`.
   - Added intent validation: `navigateTo` only triggers if explicit navigation verbs (`navigate`, `go to`, `visit`, `open`, `switch to`) or valid path slugs (`/cart`, `/products`, etc.) are present.
   - Informational questions (`what`, `why`, `how`, `show me`, `describe`) are strictly blocked from triggering state-mutating tool calls like `navigateTo` or `addToCart`.
   - Isolated Tier 2 autoregressive generation so `generateResponse` calls `generateText` on SmolLM2 directly without router preemption.

3. **Tier Isolation & Zero Deceptive Fallbacks (`escalationManager.ts`)**:
   - Eliminated silent fallback to Tier 1 MiniLM Router when Tiers 2 or 3 are selected.
   - If SmolLM2 or Gemma 4 are loading weights into WebGPU, reports transparent loading status instead of executing false tool calls.
   - Enforced strict architectural honesty complying with Global Mandate Rule 7.

4. **Security Sandbox Hardening (`agentHarness.ts`)**:
   - Added proactive regex token scanning in `primitiveSandbox`: strictly blocks `window`, `document`, `globalThis`, `self`, `top`, `parent`, `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, `localStorage`, `sessionStorage`, `indexedDB`, `cookieStore`, `constructor`, `__proto__`, `prototype`, `Function`, `eval`, `import`, `process`, `.cookie`, and `.location`.
   - Scoped `sandboxFn` with shadowed globals (`const window = undefined, document = undefined, ...`) and invoked via `(function() { return (code); }).call(null)`.

5. **Tool Parameter & Catalog Verification (`agentHarness.ts`)**:
   - `addToCart`: Clamps and validates positive integer `1 <= qty <= 100`. Rejects negatives, NaN, and overflow.
   - `navigateTo`: Rejects `javascript:`, `data:`, `<script>`, and non-relative long strings.
   - Catalog Grounding Check: Differentiates generic category nouns (`watch`, `keyboard`) from specific brand/model terms (`Rolex Submariner`, `flying carpets`). Rejects orders for products not present on the host page DOM.

## Verification
- Automated stress-test suite `tests/giskard_stress_test.mjs` executed 23 adversarial tests across all 5 benchmark categories: **23/23 PASSED (100%)**.
- Full multi-target production build (`npm run build` producing ESM, CJS, and Standalone IIFE) compiled with 0 errors.
