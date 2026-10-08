---
id: fact-production-deployment-paulcreates-online-2026-10-06
entity: chat-widget
valid_from: 2026-10-06T01:38:00Z
valid_to: null
confidence: 1.0
sources:
  - https://paulcreates.online
  - https://9172bd54.cloudfare-portfolio-app-41v.pages.dev
  - cloudfare-portfolio-app/tools/copy-files.mjs
---

# Production Deployment to paulcreates.online

## 1. Deployment Details
- **Target Subdomain**: `paulcreates.online`
- **Cloudflare Pages Project**: `cloudfare-portfolio-app`
- **Deployment URL**: `https://9172bd54.cloudfare-portfolio-app-41v.pages.dev`
- **Deployment Command**: `npx wrangler pages deploy dist/cloudflare --project-name=cloudfare-portfolio-app --branch=main --commit-dirty=true`
- **Authentication**: Wrangler OAuth session (`adarrshdeveloper@gmail.com`).

## 2. Changes Live in Production
1. **Hero Section**:
   - `on-device-chat npm` badge linked to npm repository.
   - `Ask On-Device AI ⚡` button that launches the embedded on-device copilot.
2. **Projects Grid**:
   - Flagship showcase card for `on-device-chat (v0.1.7)` with copyable install command, architecture tags, and direct copilot launch trigger.
   - Companion card for `mongodb-ephemeral-server (v1.0.7)`.
3. **Embedded Copilot Bundle**:
   - Updated quiet-chrome thread-first layout.
   - Jev/Laya non-autoregressive decision head with interactive human steering pills.
   - Noul DOM evidence verification ("Zero Hallucination Shield").
   - Expandable "Why this action?" explainability ledger.
