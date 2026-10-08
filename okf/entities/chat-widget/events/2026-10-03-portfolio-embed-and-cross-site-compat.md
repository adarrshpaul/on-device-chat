---
type: event
subject: chat-widget
occurred_at: 2026-10-03T14:10:00Z
learned_at: 2026-10-03T14:12:00Z
trust: machine-confirmed
---

# Event: Embedded in portfolio + first cross-site compatibility run

- Vendored on-device-chat@0.1.6 (`on-device-chat.min.js`, `style.css`, LICENSE) into
  `/Users/adarrsh/code/web-apps/cloudfare-portfolio-app/src/assets/on-device-chat/0.1.6/`.
- `src/index.html`: pre-registered `<link id="on-device-chat-styles">` (widget then skips its jsDelivr CSS injection)
  + `<script defer ... data-auto-init data-open="false">`. Not yet deployed (deploy: `npm run build && npx wrangler pages deploy`).
- Only `defaultOpen` and `mode` from `init()` are honored by `ChatWidget`; `systemPrompt` / `tools` / `onToolCall` in `Gemma4Config` are NOT wired through the standalone path.
- New harness: `frontend/tests/site_compat.mjs` (Playwright; flags `--ask`, `--control`, `--sites=`; env `ENGINE_WAIT_MS`, `PLAYWRIGHT_MODULE`).
  Playwright lives at `~/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright`.
- Results (headless Chromium, 14 sites, desktop 1440x900 + mobile 390x844): mounted/reachable/opens/fits-in-mobile 14/14.
  nytimes.com returned HTTP 403 to headless (page under test was a bot wall, not the real site).
- Control run (no widget) showed zero host font drift on tailwindcss.com and nytimes.com, while injection showed font drift => widget-caused.

## Defects found (see fact 2026-10-03-standalone-bundle-defects.md)
1. Standalone bundle cannot load Tier 1/2 (bare `import('@huggingface/transformers')`).
2. Shipped `style.css` contains unscoped Tailwind preflight (leaks into host pages).
3. Gemini Nano needs a user gesture to download (`NotAllowedError`) and the widget escalates instead of retrying on click.
4. No real model answered a page question in any run; harness `ask` returned only the escalation notice.
