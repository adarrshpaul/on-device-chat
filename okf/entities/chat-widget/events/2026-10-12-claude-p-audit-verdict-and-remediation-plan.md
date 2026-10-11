---
id: event_claude_p_audit_verdict_and_remediation_plan
timestamp: 2026-10-12T02:10:00Z
entity: chat-widget
type: external-llm-audit
---

# Event: Claude Code (`claude -p`) Adversarial Harness Audit & P0 Vulnerability Disclosure

## 1. Executive Verdict & Quality Score
- **External Score Awarded:** **26 / 100**
- **Core Verdict:** In default configuration, EdgeOperator is a rule-based expert system that labels its output as AI decisions.
- **Root Architecture Flaw:** Multi-step looping is broken for real LLMs (Tier 2/3 returns `{final: lastObservation}` on step 1), while default tier uses regex fast-paths and synthetic `DecisionTrace` literals.

## 2. P0 Critical Vulnerabilities Disclosed by Claude
1. **Teach 1 → Batch N Semantic Collapse:** `MacroParameterizer.parameterizeSteps` rewrites all non-templated targets to `{{entity_selector}}` (`batchEngine.ts:252`), turning sub-control clicks into clicks on the whole `<tr>`.
2. **Commit Without Confirmation via Download Fast-Path:** Input `"save configuration"` triggers `isDownloadIntent` (`^(download|save|get|fetch)`), clicking switch commit buttons without human confirmation.
3. **Regex False Positive Misroutes:**
   - `"what day is the firmware update"` toggles theme to light mode via `\b(light|day)\b`.
   - `"top 5 ports by errors"` scrolls to top of page via `^(...|top|...)\b`.
4. **Side Effects Inside Predictor:** `predictText` executes clicks directly; `sampleBestOfN` with $k=2$ triggers duplicate mutations.
5. **Air-Gap Leak:** `backgroundDownloader.startIdlePrefetch` fetches from `huggingface.co` 12s after load, and runtimes load from `jsdelivr`/`esm.run`.
6. **XSS / Prompt Injection to Action Dispatch:** Unsanitized `marked()` with `dangerouslySetInnerHTML` in `MessageBubble.tsx` allows malicious device descriptions to execute `action:` links.
7. **Frameset & Native Alert Blindness:** Missing `all_frames: true` in `manifest.json`; native `window.confirm()` on switch WBM blocks the JS thread and hangs the agent.
8. **Navigation State Loop:** `saveTask` always writes `stepIndex: 1, trajectory: []`, causing continuous restart loops on page reloads.

## 3. Immediate Action Plan
- Remove fabricated telemetry and literal `confidence` / `margin` records.
- Purge simulated Box-Muller physics from Vega and placeholder Laya fallback.
- Decouple predictor from execution side effects.
- Sanitize markdown with DOMPurify and secure `action:` links.
- Enforce strict offline air-gap mode (`EO_AIRGAP=true`).
- Implement Plan → Diff → Confirm → Commit → Read-back architecture for industrial switches.
