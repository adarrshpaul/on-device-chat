# Event: Cloudflare Deployment Token Scope & npm Auth Audit

- **Date:** 2026-10-03
- **Entity:** `chat-widget`
- **Type:** Deployment & Infrastructure Diagnostics
- **Status:** Complete

## 1. Context & Diagnostics
- **Cloudflare Pages Deployment:**
  - Ran `npx wrangler pages deploy docs --project-name=local-agent-harness --branch=main --commit-dirty=true` using Account ID `ebf0716aaf7b7e368ca35db4189729a8`.
  - Discovered that the current `CLOUDFLARE_API_TOKEN` stored in macOS Keychain has active credentials, but permissions are strictly limited to zone DNS (`#dns_records:edit`, `#dns_records:read`, `#zone:read`).
  - Missing required account scope `Cloudflare Pages: Edit` (code 10000 authentication error when accessing `/accounts/<id>/pages/projects/local-agent-harness`).
- **OAuth Callback Exposure:**
  - An interactive OAuth callback URL containing an authorization code was pasted in chat, triggering immediate revocation alert protocol per Rule 4.
- **npm Registry Authentication:**
  - `npm whoami` confirmed unauthenticated status (`ENEEDAUTH`).
  - Package `gemma4-chat-widget@0.1.0` dry run passed with 0 errors (tarball: 865 kB, unpacked: 4.0 MB). Awaiting user `npm login` or automation token.

## 2. Remediation Path
1. User revokes/cleans exposed OAuth state.
2. User generates a Cloudflare API Token with `Cloudflare Pages: Edit` template (or `All accounts - Pages:Edit`) and stores it securely in macOS Keychain under `CLOUDFLARE_API_TOKEN`.
3. User runs `npm login` in their local terminal to authorize publishing `gemma4-chat-widget`.
