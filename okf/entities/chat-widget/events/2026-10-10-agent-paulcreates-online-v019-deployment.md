---
id: event-agent-paulcreates-online-v019-deployment-2026-10-10
entity: chat-widget
timestamp: 2026-10-10T06:44:00Z
author: assistant
type: deployment
version: 0.1.9
---

# Deployed On-Device Chat v0.1.9 to agent.paulcreates.online

## Summary
- Upgraded host site `https://agent.paulcreates.online/` from legacy `on-device-chat@0.1.6` CDN script to self-hosted v0.1.9 build.
- Copied distribution assets to `docs/assets/on-device-chat/0.1.9/` (CSS + ESM/CJS + minified standalone bundles).
- Configured `#on-device-chat-styles` link in `<head>` and deferred auto-initialization script.
- Deployed to Cloudflare Pages (`local-agent-harness`) via `npx wrangler pages deploy`.
- Verified live HTTP/2 200 responses on both markup and static asset endpoints.
