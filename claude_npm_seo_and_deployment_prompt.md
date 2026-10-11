# Claude Code Consultation: EdgeOperator NPM SEO Optimization, Capabilities Showcase & Real Website Deployment

We have built **EdgeOperator** (`on-device-chat` on npm, version `0.2.0`), a local-first, on-device AI web operator that runs 100% in-browser across:
- **Chrome Gemini Nano** (0 MB download via window.ai / Prompt API)
- **Vega Decision Engine** (<5ms reflex)
- **MiniLM-L6-v2 WebGPU** (~15MB Transformers.js)
- **SmolLM2-135M / Gemma 4** (WebLLM WebGPU)

### Recent Innovations Added to the Harness:
1. **Dynamic Form & Input Synthesis**: Scans live DOM forms, extracts fields, datalists, and submit buttons into instant 1-click automations (`⚡ Build steps`).
2. **Point-and-Click Element Picker (`⌖`)**: Interactive crosshair with live hover highlights that captures verified CSS selectors directly from the page.
3. **Repeated Clicks Coalescing & Sequential Execution (`×N`)**:
   - Rapid repeated clicks (e.g. clicking "Add to Cart" 3 times) coalesce into a single step with `repeatCount: 3` and `repeatIntervalMs: 400`.
   - UI Stepper: `↻ Repeat [−] 3 [+] times · every 400 ms`.
   - Resilient SPA re-acquisition: dynamically handles transient `aria-busy="true"`, button disabling, and React DOM node replacements between repeated clicks.
4. **'Teach 1 → Batch N' Parameterized Macro Automation**:
   - Records one demonstration on an entity (e.g., Row 1 of an inventory table or device list).
   - Auto-extracts sibling entities from table rows or grids into a parameterized template (`{{entity_selector}}`, `{{entity_name}}`).
   - Human confirmation gate to selectively approve/exclude items.
   - Sequential batch execution with error boundary isolation.
5. **Canvas & WebGL Game Autopilot**:
   - Physics-aware trajectory forecasting and dynamic HUD docking without hardcoded selectors (Rule 9).
6. **Triple-Distribution Delivery**:
   - NPM library: ESM (`dist/index.js`), CJS (`dist/index.cjs`), TypeScript typings (`dist/index.d.ts`).
   - Standalone browser bundle: `dist/edge-operator.min.js` (and `on-device-chat.min.js`) via `<script data-auto-init>`.
   - Chrome MV3 Extension: `extension/` with 100% sync parity.

---

### Questions for Claude Code:

1. **NPM SEO & Package Description Optimization**:
   - What is the most compelling, high-converting, SEO-optimized `description` and `keywords` list for `package.json` to rank high on npm, Google, and GitHub for developers searching for in-browser AI agents, Chrome Gemini Nano copilot widgets, web automation tools, and local-first AI?
   - How should we structure the `README.md` to instantly showcase its killer capabilities (zero token costs, 100% privacy, repeat clicks e-commerce automation, form builder, Web Component drop-in)?

2. **Real Website Showcase & Deployment Strategy**:
   - We deploy to Cloudflare Pages (`agent.paulcreates.online`, `paulcreates.online`, `store.paulcreates.online`).
   - How should we configure the live demonstration page on `agent.paulcreates.online` (or `store.paulcreates.online`) so visitors can immediately test and experience:
     a) The on-device chat widget with Chrome Gemini Nano / fallback tiers.
     b) The Workflow Studio with dynamic form formulation.
     c) The repeated clicks ("Add to Cart" 3 times) workflow execution.
     d) The element picker crosshair.
   - Provide concrete HTML/JS showcase patterns and Wrangler deployment instructions.

3. **Production Verification & Testing Strategy**:
   - How should we conduct an end-to-end automated smoke and capability test against the live production deployment to ensure zero regressions in the field?
