---
id: fact_claude_audit_verification_and_hardening
entity: edgeoperator_core
layer: current
valid_from: "2026-10-12T04:41:00Z"
valid_to: null
confidence: 1.0
source: "claude -p independent architectural audit & remediation"
tags: [audit, claude, rule7, rule9, d3-nano, openui, security]
---

# Fact: Claude Architectural Audit Verification & Hardening

## 1. Claude Audit Findings Summary
An independent architectural audit was conducted via `claude -p` on the candidate implementations:
1. **Candidate 1 (`open-intelligent-ui` / DIL typed stream)**:
   - **Status**: Implemented & live in chat pipeline (`useChat.ts`, `UISpecRenderer.tsx`, `escalationManager.ts`).
   - **Live DOM Verification**: `UISpecEngine.bindOrDrop()` properly rejects detached/phantom element references.
   - **Gaps Identified & Remediated**:
     - `paramForm` validation now checks individual field refs, discarding detached input bindings.
     - `executeAction` navigation now validates URL protocol to strictly enforce `http:` / `https:` (blocking `javascript:` protocol execution).
2. **Candidate 2 (`vllm-sr/d3-nano` decision scorer)**:
   - **Status**: Architectural cascade wired into `vegaEngine.ts:705` and `decisionScorerRegistry`.
   - **Rule 7 (Architectural Honesty) Rectified**: Previously, the lexical/structural fallback returned `engineUsed: "d3-nano 2B (Single-Forward-Pass Server)"` with `placement: "remote"`. This was corrected to transparently report `engineUsed: "Lexical & Structural Fallback (d3-nano endpoint pending)"` and `placement: "on-device"` whenever `window.EO_D3_ENDPOINT` is unconfigured.
   - **Semantic Random Projection Vector Upgraded**: `textToLatentVector` in `decisionScorer.ts` replaced whole-string hashing with token-level bag-of-words deterministic random projection. Words are projected into 64D unit vectors and summed, ensuring that shared tokens produce genuine positive cosine similarity rather than pseudorandom hash noise.
   - **PII Redaction Enhanced**: Redaction regex expanded to sanitize emails, phone numbers, 13-19 digit card numbers, and auth secrets before transmission.
3. **Candidate 3 (`AesCode-8B` / `GPT-X3-150M`)**:
   - **Status**: Intentionally deferred/skipped per architectural roadmap (`fact_models_and_concepts_evaluation_roadmap.md`).
   - **Claude Validation**: Claude confirmed this was the correct decision:
     - `AesCode-8B` (8B) generates raw HTML/Tailwind for new pages (EdgeOperator operates existing DOM, not writing new pages; injecting model-generated raw HTML creates high XSS liability and exceeds client memory envelope).
     - `GPT-X3-150M` is an untuned base model with non-standard architecture and poor tool-calling compared to the existing embedding router and physics verifier.

## 2. Test Verification & Live Production Deployment
- **Automated Verification**: `npm run test:uispec` passed 5/5 real browser tests with verified honest telemetry (`Lexical & Structural Fallback (d3-nano endpoint pending)`) and positive semantic margin (23.9%).
- **Cloudflare Pages Live**: Built (`npm run build:docs`) and deployed via `npx wrangler pages deploy docs --project-name=local-agent-harness --branch=main --commit-dirty=true` to `agent.paulcreates.online` (preview: `https://3927255b.local-agent-harness.pages.dev`).
