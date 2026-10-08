---
type: fact
subject: gemma4-chat-widget
predicate: standalone_bundle_defects
object: tier1_2_unloadable_and_global_css_leak
valid_from: 2026-10-03T14:12:00Z
learned_at: 2026-10-03T14:12:00Z
trust: machine-confirmed
---

# Fact: Standalone (IIFE) bundle defects, measured 2026-10-03

1. **Tier 1/2 broken in standalone**: console on the portfolio:
   `EscalationManager init error: Neural engine failed to initialize: Failed to resolve module specifier '@huggingface/transformers'`
   at `compactEngine.ts:16` / `visionService.ts:315`. `vite.standalone.config.ts` externalizes the package and the `globals`
   shim only helps static imports, not dynamic `import()`. Engine stays at "Initializing local engine..." indefinitely
   (observed >120 s) even though HF model files were fetched (302->200). WebLLM (`engine.ts:17`) has the same pattern.
   Candidate fixes: runtime `import(/* @vite-ignore */ <pinned esm CDN url>)` for the standalone build, or ship a bundled worker chunk.
2. **CSS leak**: `dist/style.css` contains Tailwind preflight (`html,:host{font-family:...}` etc). Control-verified to change host
   typography on tailwindcss.com and nytimes.com. Candidate fix: build with `@import "tailwindcss/theme"` + `utilities` only (no preflight)
   or scope under `.g4-widget-container`.
3. **Nano gesture**: `availability === "downloadable"` requires a user gesture; init-time `create()` throws NotAllowedError.
   Playwright `page.evaluate` counts as a gesture on injected pages, so "engine ready (Gemini Nano)" there is not comparable with the
   natively-embedded portfolio run. Headless Chromium has `LanguageModel` but the Nano `ask` returned `Gemini Nano harness prediction error`.
4. Invalidates the standalone/Safari/Firefox claim in `2026-10-03-universal-web-app-compatibility.md` (Tier 1 & 2 via ONNX).
