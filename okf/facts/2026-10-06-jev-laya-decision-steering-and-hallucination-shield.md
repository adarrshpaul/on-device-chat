---
id: fact-jev-laya-decision-steering-and-hallucination-shield-2026-10-06
entity: chat-widget
valid_from: 2026-10-06T01:20:00Z
valid_to: null
confidence: 1.0
sources:
  - https://github.com/wuyoscar/jev-skill
  - frontend/src/lib/layaEngine.ts
  - frontend/src/components/DecisionCard.tsx
  - frontend/src/lib/types.ts
---

# Jev-Style Laya Decision Steering & Zero-Hallucination Shield

## 1. Context & Motivation
Analyzed `https://github.com/wuyoscar/jev-skill`, which codifies non-autoregressive decision models (Choice, Noul, Score) for autonomous agent execution. In conventional web assistants, autoregressive LLMs hallucinate by generating imaginary selectors, clicking buttons that don't exist, and fabricating completion claims.

## 2. Technical Implementation
Integrated Jev non-autoregressive decision patterns via the open-source Laya engine in `on-device-chat`:
1. **Interactive Steering Pills (`Choice`)**:
   - Instead of autonomous unguided guessing, Laya computes calibrated probabilities and margins across legal candidate actions.
   - When confidence is ambiguous (< 0.68) or margin is tight (< 0.15), the UI surfaces prominent interactive choice pills (`[Site Tour]`, `[Toggle Theme]`, `[Go to Section]`).
   - The user can click any pill to steer or override the agent instantly with 1 tap.
2. **Hallucination Shield (`Noul` Evidence Gate)**:
   - Before executing or claiming action completion, Laya executes a Noul verification check against the live DOM via `smartQuerySelector`.
   - Returns calibrated $P(\text{true})$ (e.g. 0.98 if element is verified on active viewport, 0.04 if absent).
   - Displayed as a clean green badge: `🛡️ Zero Hallucination Shield: Verified`.
3. **"Why this action?" Explainability Ledger**:
   - An expandable inspector reveals human-readable rationale, evaluated alternatives, margin (+81%), and latency (12ms, 0 prompt tokens).
4. **Zero Cloud Exfiltration**:
   - 100% on-device client-side execution using modern client-side architectures.
