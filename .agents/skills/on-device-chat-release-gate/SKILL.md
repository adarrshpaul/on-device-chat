---
name: on-device-chat-release-gate
description: Staged multi-site validation and release pipeline for on-device-chat (gemma4-chat-agent). Enforces Gate 1 (local MV3 extension E2E across multiple websites using Playwright with persistent Chrome profile), Gate 2 (staging pre-release to Cloudflare Pages stg.agent.paulcreates.online and npm dist-tag next), and Gate 3 (production promotion to agent.paulcreates.online and npm dist-tag latest). Use whenever releasing, testing, publishing, or verifying on-device-chat.
---

# On-Device Chat (EdgeOperator) Release Gate Skill

This skill enforces a deterministic 3-gate release progression for `on-device-chat` (`gemma4-chat-agent`). All new features, agent primitives, or UI components must pass local multi-site extension verification before touching staging, and must pass staging smoke tests before reaching production.

---

## 🏛️ 3-Gate Progressive Pipeline

```
[ Gate 1: Local Multi-Site Extension E2E ]
  - Persistent Chromium Profile + MV3 Unpacked Extension
  - Tests: Local Demo, paulcreates.online, store.paulcreates.online, agent.paulcreates.online
  - Verifies: Zero CSS leak, Zero CSP errors, Zero host page regressions, 1 visible launcher
                         │ (Pass)
                         ▼
[ Gate 2: Staging Pre-Release (stg) ]
  - Git Push to main -> Cloudflare Pages (stg.agent.paulcreates.online)
  - npm publish --tag next (e.g. 0.3.0-next.N)
  - Remote smoke verification against live staging site
                         │ (Human Review & Green Staging)
                         ▼
[ Gate 3: Production Promotion (prod) ]
  - Tag vX.Y.Z -> Cloudflare Pages (agent.paulcreates.online)
  - npm publish --tag latest (verified SemVer promotion)
  - Automated Cloudflare Pages rollback on smoke failure
```

---

## 🔒 Invariants & Ground Rules

1. **Gate Sequence Integrity:** Never jump directly to production. Always run Gate 1 locally, then Gate 2 staging, then Gate 3 production.
2. **Fail Closed:** If Gate 1 fails on any website, stop immediately. Do not push to git or npm.
3. **Never Use Real User Profiles:** Playwright tests must always use an isolated temporary profile directory (`fs.mkdtempSync`), never the user's primary Google Chrome profile.
4. **Zero Secret Leaks:** Never commit `.env` or `.dev.vars` files. Cloudflare tokens (`CLOUDFLARE_API_TOKEN`) and Account IDs must be injected dynamically via macOS Keychain locally or GitHub Environment Secrets in CI.
5. **Radical Transparency:** If Gemini Nano / Chrome Prompt API is unavailable in headless Chromium, tests record an explicit `engine` annotation; they never mock or fake neural execution.

---

## 🛠️ Step-by-Step Gate Execution

### Gate 1: Local Multi-Site WebExtension Verification

Execute before committing or pushing changes:

```bash
cd /Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/frontend

# 1. Run full unit suites + lint + build extension + Playwright multi-site suite
npm run release:gate1

# 2. Targeted site verification (during iterative debugging)
EO_TARGETS=local npm run e2e:extension
EO_TARGETS=portfolio,store npm run e2e:extension

# 3. Headed interactive visual inspection (macOS)
HEADED=1 EO_TARGETS=agent npx playwright test --project=gate1-extension --debug
```

**Gate 1 Pass Criteria:**
* All unit and benchmark test suites pass.
* WebExtension builds with byte-for-byte SHA-256 parity in `extension/content/`.
* Manifest V3 loads cleanly in Chromium without version syntax warnings.
* All target sites load without new page errors, console errors, or CSP violations.
* Host computed styles match baseline (`styleFingerprint`), proving zero CSS bleed.
* Exactly one launcher button renders (native embed or extension, no collisions).

---

### Gate 2: Staging Pre-Release (`next` / `stg`)

Only after Gate 1 passes completely:

```bash
cd /Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/frontend

# 1. Bump version to next prerelease build
npm run release:next <build_number>

# 2. Commit and push to main (triggers CI staging deployment)
git add package.json package-lock.json
git commit -m "feat(release): cut staging prerelease v$(node -p 'require("./package.json").version')"
git push origin main

# 3. Monitor GitHub Actions release workflow
gh run list --repo adarrshpaul/on-device-chat --limit 1
gh run watch <run-id> --exit-status

# 4. Verify npm prerelease dist-tag
npm view on-device-chat dist-tags
# -> Expect 'next': '0.3.0-next.X'
# -> Expect 'latest': '0.2.0' (untouched)

# 5. Remote smoke check against live staging
npm run e2e:smoke
# with BASE_URL=https://stg.agent.paulcreates.online EXPECTED_VERSION=0.3.0-next.X
```

---

### Gate 3: Production Promotion (`latest` / `prod`)

Promote staging build to production:

```bash
cd /Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/frontend

# 1. Promote package.json to stable semver
npm run release:stable

# 2. Trigger production promotion via GitHub workflow
gh workflow run publish.yml --repo adarrshpaul/on-device-chat -f staging_run_id=<green_staging_run_id>

# 3. Verify production deployment
gh run watch <prod-run-id> --exit-status
npm view on-device-chat dist-tags
# -> Expect 'latest': '0.3.0'

# 4. Smoke check production site
curl -fsS https://agent.paulcreates.online > /dev/null
```

---

## 🚨 Fail-Safe Recovery Protocol

| Symptom | Root Cause | Immediate Action |
|:---|:---|:---|
| `Gate 1: isInitialized timeout` | `window.customElements` undefined in isolated world | Ensure `edge-operator.min.js` runs in `MAIN` world or is properly bridged with `postMessage`. |
| `Gate 1: styleFingerprint mismatch` | Tailwind v4 utility class leaked into host DOM | Scope leaking selector under `[data-eo-widget]`. Never weaken the baseline assertion. |
| `Gate 1: launcher count > 1` | Double mount on page with native widget | Update `content.js` to detect pre-existing `#edge-operator-root` and yield. |
| `Gate 2: version.mjs rejection` | Base version $\le$ npm `latest` | Bump base version in `package.json` to higher SemVer. |
| `Gate 3: Smoke test failure` | Bundle regression on production edge | Workflow automatically invokes `node scripts/release/pages-rollback.mjs <prev_id>`. Alert user immediately. |

---

## 📝 Autonomous Memory Capture

Upon completion of any gate pass or failure:
1. Append telemetry to `okf/log.md`:
   `- <ISO-TIMESTAMP>: release-gate <GATE> <PASS|FAIL> v<VERSION> sha=<SHA> - <SUMMARY>`
2. Record any newly discovered constraints in `okf/facts/`.
