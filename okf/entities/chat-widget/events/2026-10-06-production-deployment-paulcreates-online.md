---
id: event-production-deployment-paulcreates-online-2026-10-06
entity: chat-widget
timestamp: 2026-10-06T01:38:00Z
author: assistant
type: deployment
---

# Deployed Portfolio Update with NPM Showcase to paulcreates.online

## Summary
- Built Angular portfolio application (`ng build && npm run process`) into `dist/cloudflare`.
- Deployed via `npx wrangler pages deploy dist/cloudflare --project-name=cloudfare-portfolio-app --branch=main --commit-dirty=true`.
- Verified live HTTP response on `https://paulcreates.online` (HTTP/2 200, content validated).
- Committed changes to git and pushed to `origin/main` (`github.com/adarrshpaul/cloudfare-portfolio-app.git`).
