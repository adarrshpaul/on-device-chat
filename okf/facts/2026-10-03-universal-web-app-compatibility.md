---
type: fact
subject: gemma4-chat-widget
predicate: universal_web_app_compatibility
object: multi_target_distribution_verified
valid_from: 2026-10-03T05:31:00Z
learned_at: 2026-10-03T05:31:00Z
trust: machine-confirmed
---

# Fact: Universal Web Application Compatibility Matrix

The widget now ships with dual-target distribution to support any web application:

1. **Modern Bundlers & React Frameworks (Next.js, Remix, Vite, CRA)**:
   - Output: `dist/index.js` (ESM 128 kB) & `dist/index.cjs` (CJS 89 kB)
   - React & ReactDOM externalized as `peerDependencies` (prevents hook collisions).
   - SSR Safe: `typeof window !== 'undefined'` guards prevent Node.js / React Server Component crashes.
   - TypeScript: Full `.d.ts` declarations emitted in `dist/`.

2. **Vanilla JS / CMS / Non-Node Stacks (WordPress, Shopify, Webflow, PHP, Rails)**:
   - Output: `dist/gemma4-agent.min.js` (IIFE 291 kB gzipped, self-contained).
   - Embeddable via single `<script>` tag without npm or bundler setup.
   - Attaches `Gemma4Agent` to `window`.

3. **Browser & Hardware Fallback**:
   - Tier 0: Chrome Built-in Gemini Nano (0 MB, fastest).
   - Tier 1 & 2: MiniLM & SmolLM2 via ONNX WebAssembly (runs in Safari, Firefox, Edge, Mobile).
   - Tier 3: Gemma 4 via E2B sandbox / Gemini API (fallback for low-power devices).
