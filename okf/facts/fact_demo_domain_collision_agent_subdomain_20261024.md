---
type: fact
valid_from: 2026-10-24
learned_at: 2026-10-24T12:20:00Z
layer: current
trust: verified
author: claude-code
---

# Fact: agent.paulcreates.online does not serve the on-device-chat demo

- `package.json` `homepage` and README demo badge/links for every published `on-device-chat` version (0.1.0 → 0.4.0-next.1) point to https://agent.paulcreates.online.
- That domain is bound to CF Pages project `local-agent-harness`, deployed from `~/foundry/docs` (Process Automation Hub + `/aasx`). Production deployments from 4 days ago and the latest one (7a1481d4, by Antigravity at ~17:42) all serve "Process Automation Hub". So this is a long-standing mapping collision. The latest deploy did not cause it.
- The EdgeOperator demo builds to `frontend/docs` (`npm run build:docs`, `vite.demo.config.ts`), and no CF Pages project serves it.
- `automation.paulcreates.online` (project `process-automation-hub`) already serves the same Process Automation Hub. `aasx.paulcreates.online` already serves AASX.
- `frontend/README.md` still pins CDN snippets to `on-device-chat@0.2.0` and `EdgeOperator.version // "0.2.0"`. npm READMEs are immutable per version, so fixing the npm page needs a new version (e.g. 0.4.0-next.2).
- The `CLOUDFLARE_API_TOKEN` in Keychain gets auth error 10000 on Pages project list. The wrangler OAuth login works.

Options awaiting the user's decision: (A) give the on-device-chat demo its own new Pages project and subdomain, then repoint homepage/README; (B) repoint agent.paulcreates.online to the demo, which fixes links in all published versions but changes the global deployment map and breaks agent.paulcreates.online/aasx.
