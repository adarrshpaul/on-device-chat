---
id: fact_chat_assistant_live_openui_enhancements
subject: agent.paulcreates.online-chat-assistant-openui-verification
predicate: live-openui-dil-components-and-d3nano-choice-scoring
valid_from: 2026-10-12T04:30:00Z
valid_to: null
confidence: 1.0
source: playwright-live-browser-verification-and-cf-pages-deploy
---

# Fact: Live Chat Assistant OpenUI & D3-Nano Verification

1. **Why the User Previously Didn't See Changes**:
   - Production Cloudflare Pages (`agent.paulcreates.online`) had an outdated build (`03:21`) that preceded the OpenUI/D3-Nano engine implementation.
   - The large ONNX wasm binary (`ort-wasm-simd-threaded.asyncify-CxOG5pUO.wasm`, 25.6 MiB) previously exceeded Cloudflare Pages' 25 MiB single-file limit, silently preventing automatic deployment. We unbundled the heavy wasm (delegated to on-demand CDN fetch) and executed a clean deployment via `npx wrangler pages deploy docs`.
   - In `escalationManager.ts`, the Form Synthesis and Action Confirmation card emission was restricted to `TIER_1_5_LAYA_DECISION` and multi-step execution wiped `this.lastUiSpecs` on step 1. We hoisted form synthesis and action confirmation to Tier 1 MiniLM and guarded `this.lastUiSpecs` so multi-step executions retain interactive cards.

2. **Verified Live Capabilities on `https://agent.paulcreates.online`**:
   - **Dynamic Quick Action Chips**: Upon opening the chat copilot, the assistant dynamically scans the host page DOM and presents contextual pills:
     - `📝 Formulate Form` (dynamically discovered from the page's shipping form).
     - `🛒 Add to Cart (×3)` (dynamically discovered from the e-commerce catalog).
   - **OpenUI DIL Form Synthesis (`paramForm`)**:
     - When the user asks to "formulate form", EdgeOperator scans the DOM form and renders an interactive OpenUI card inside the chat bubble with live form inputs, datalists, and submit button:
       - Recipient Name (`#ship-name`)
       - Destination City (`#ship-city` with datalist)
       - Shipping Method (`#ship-method` select)
       - Tamper-evident seal toggle (`#ship-gift`)
       - Submit (`Confirm Shipping Order`) button
   - **D3-Nano / Vega Choice Scoring (`choices`)**:
     - When the user queries an action with multiple candidates (e.g., "add headphones x3"), EdgeOperator uses System 1 choice scoring (d3-nano single-forward pass / Vega Hamiltonian affinity) to compute confidence distributions:
       - `add headphones — Add to Cart (90%)`
       - `🛒 1. Repeated Clicks & SPA Resilience (5%)`
       - `add watch — Add to Cart (3%)`
       - `add keyboard — Add to Cart (3%)`
     - Clicking the top pill immediately executes the action with human gaze tracking and repeat loop (`ActionDispatcher.click` ×3), updating the live cart from 0 to 3 ($599.97).
