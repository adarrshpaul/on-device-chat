---
id: event-jev-laya-decision-steering-and-hallucination-shield-2026-10-06
entity: chat-widget
timestamp: 2026-10-06T01:21:00Z
author: assistant
type: enhancement
---

# Upgraded Laya Decision Engine & DecisionCard with Jev-Skill Architecture

## Summary
Studied `https://github.com/wuyoscar/jev-skill` and implemented non-autoregressive decision patterns in `on-device-chat` via the open-source Laya engine:
- Added interactive Choice pills allowing the user to steer or override decisions with a single tap.
- Added Noul DOM evidence verification ("Zero Hallucination Shield"), confirming elements exist on the live page before taking actions.
- Added "Why this action?" explainability ledger with calibrated probabilities and margins.
- Verified in Playwright against `cloudfare-portfolio-app` on port 4300 with visual screenshots.

## Impact
- Files modified: `frontend/src/lib/types.ts`, `frontend/src/lib/layaEngine.ts`, `frontend/src/lib/escalationManager.ts`, `frontend/src/lib/agentHarness.ts`, `frontend/src/components/DecisionCard.tsx`.
- Bundle rebuilt and synced to `cloudfare-portfolio-app` (`src/assets/on-device-chat/0.1.7/` and `dist/cloudflare/assets/on-device-chat/0.1.7/`).
- User empowerment elevated: user feels in total control, protected from hallucinations, with instant 1-click steering.
