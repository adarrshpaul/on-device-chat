---
fact_id: 2026-10-06-portfolio-npm-showcase-draft
entity: chat-widget
valid_from: 2026-10-06T01:10:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Profile Website Open Source & NPM Libraries Showcase Draft

## Summary
The main profile website (`cloudfare-portfolio-app` at `paulcreates.online` / `127.0.0.1:4300`) was upgraded to prominently showcase published NPM libraries (`on-device-chat@0.1.7` and `mongodb-ephemeral-server@1.0.7`), integrating interactive copilot triggers across the Hero and Projects sections.

## Components & Implementations
1. **Hero Bio & Interactive Trigger**:
   - Bio text updated with linked `on-device-chat npm` author tag.
   - Added interactive `Ask On-Device AI ⚡` button that programmatically expands the client copilot (`openAiAssistant()`).
2. **Projects Section Flagship Showcase**:
   - `on-device-chat` (v0.1.7): Spanning 2 grid columns with package badges (`v0.1.7`, `Open Source`, `Apache-2.0`, `Zero Data Exfiltration`), one-click copy install command (`npm i on-device-chat`), CDN embed code, architecture tags (`Chrome Gemini Nano`, `Transformers.js`, `WASM/WebGPU`, `React 18`, `Shadow DOM`), direct links to NPM Registry, GitHub, and Live Docs, and a "Try Live Copilot on this page" trigger.
   - `mongodb-ephemeral-server` (v1.0.7): In-memory unit testing utility card with NPM link.
3. **Verification**:
   - Built with Angular CLI (100% passed).
   - Rendered on live dev server `http://127.0.0.1:4300`.
   - Verified that both the Hero button and the Projects card button successfully open the quiet-chrome copilot.
   - Captured visual artifacts for user review prior to Cloudflare Pages deployment.
