---
id: fact_root_cause_wrangler_cache_domain_collision_remediated_20261024
subject: Cloudflare Pages Domain Cross-Contamination & Subdomain Resolution
predicate: purged_rogue_wrangler_cache_and_restored_strict_subdomain_isolation
timestamp: 2026-10-24T18:20:00+05:30
valid_from: 2026-10-24T18:20:00+05:30
valid_to: infinity
source: forensic_audit_and_live_production_remediation
tags: [cloudflare-pages, wrangler-cache, domain-separation, process-automation-hub, local-agent-harness, verified]
---

# Fact: Root Cause of Cross-Subdomain Collision & Permanent Remediation

## 1. Forensic Root Cause
1. **Committed Rogue Wrangler Cache**: In commit `acdafc9`, `.wrangler/cache/pages.json` had been tracked into git inside `~/foundry/` with `"project_name": "local-agent-harness"`.
2. **Silent Project Hijack**: Whenever any agent or script executed `npx wrangler pages deploy docs --project-name=process-automation-hub` from `~/foundry/`, Wrangler silently read `.wrangler/cache/pages.json` and overrode the target project, deploying `~/foundry/docs` to `local-agent-harness` (`agent.paulcreates.online`).
3. **HTML Overwrite**: `~/foundry/docs/index.html` had been temporarily overwritten with EdgeOperator, which was then deployed across projects, leaving both `automation.paulcreates.online` and `agent.paulcreates.online` displaying the identical page.

## 2. Permanent Fixes Enacted
1. **Purged Rogue Cache**: Removed `.wrangler/cache/pages.json` and `.wrangler/cache/wrangler-account.json` from git tracking via `git rm --cached -r .wrangler`, and added `.wrangler/` to `~/foundry/.gitignore`.
2. **Restored Process Automation Hub**: Restored `~/foundry/docs/index.html` to the full 11,580-line sovereign Process Automation Hub (`f0a46e7` / `b863037f`).
3. **Clean Explicit Deployments**:
   - `process-automation-hub` deployed from `~/foundry/docs` (Commit `96e6d0a`).
   - `local-agent-harness` deployed from `~/foundry/gemma4-chat-agent/frontend/docs` (Deployment `f6eb0422`).

## 3. Empirical Live Production Verification (Automated Assertion)
- `https://automation.paulcreates.online/`: `<title>Process Automation Hub — Sovereign Industrial AI & Deterministic Edge Digital Twins</title>` (Contains Process Automation Hub; excludes EdgeOperator).
- `https://agent.paulcreates.online/`: `<title>EdgeOperator — On-Device AI Agent & Workflow Operator</title>` (Contains EdgeOperator; excludes Process Automation Hub).
- Zero shared files, zero cross-contamination, 100% domain isolation verified.
