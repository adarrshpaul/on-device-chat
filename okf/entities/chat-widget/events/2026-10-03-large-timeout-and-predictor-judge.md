---
type: event
timestamp: 2026-10-03T04:31:00Z
entity: chat-widget
---

# Event: Configured Generous 5-Minute Timeout & Multi-Engine Judge Predictor

- **User Directives**: Remove short timeouts; local LLM invocations can be slow during model weights loading, WebGPU buffer allocation, and shader compilation. Set generous timeout to 5 minutes (300,000ms).
- **Expanded Evaluation Pipeline**:
  - Implemented 5-minute (`300_000ms`) allowance for Chrome Built-in AI (`window.ai.languageModel` / `window.LanguageModel`).
  - Added multi-engine fallback predictor: if Chrome Gemini Nano is unavailable or unparseable, `expertJudge.judgeTrace` seamlessly invokes the active local model (e.g. SmolLM2, Gemma 4, MiniLM) via `predictForJudge` from `escalationManager`.
  - Added robust regex JSON parser `parseJudgeJson`: extracts `{ ... "label" ... }` cleanly even if the model prefixes markdown code blocks, conversational greetings, or thoughts.
- **Verification**: Verified production build (`npm run build` exited 0) and live server at `http://localhost:5173/`.
