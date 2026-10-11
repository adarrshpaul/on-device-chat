---
id: state_model_selector_badge_and_header_declutter
layer: historical
valid_from: 2026-10-12T02:30:00Z
valid_to: 2026-10-12T02:45:00Z
entity: chat-widget
---

# State: Model Selector Badge & Header De-clutter Architecture

## Active State Properties
- **Uncompromised Header Space Budget:**
  - Header width: ~380px.
  - Right-side cluster reduced from ~265px to ~160px by migrating secondary controls (Dock `ArrowLeftRight` and Ghost `Eye`/`EyeOff`) to the `•••` overflow menu.
  - Left-side cluster allocated ~220px: Brand identity (`EdgeOperator ⚡`, ~80px) and Model Pill (~90px) rendered with `shrink-0`, preventing flexbox crushing.
- **Tier Badge Icons & Identifiers (`TIER_BADGES`):**
  - Tier 1.5 (`TIER_1_5_LAYA_DECISION`): `Reflex` (`Zap`, Cyan) — Instant Actions & Workflows
  - Tier 0 (`TIER_0_GEMINI_NANO`): `Nano` (`Sparkles`, Blue) — On-Device Page Q&A
  - Tier 1 (`TIER_1_MINILM_ROUTER`): `MiniLM` (`ScanSearch`, Emerald) — Semantic Search & Indexing
  - Tier 2 (`TIER_2_SMOLLM_GENERATIVE`): `SmolLM` (`Brain`, Purple) — Local Reasoning & Drafting
  - Tier 3 (`TIER_3_GEMMA4_E2B`): `Gemma 4` (`Gem`, Rose) — Deep Analysis & Complex Code
- **Model Selector Dropdown & Escalate Relocation:**
  - Active pill features rotating chevron on open/close (`rotate-180`), subtle escalation beacon (`bg-purple-400`), and accessible attributes (`aria-haspopup="menu"`, `aria-expanded`).
  - Cognitive engine escalation toggle relocated cleanly inside the dropdown header.
  - Cleaned leading legacy emoji strings via `stripLeadingEmoji`.
- **System Verification:**
  - 100% build pass: `npm run build` (NPM library, standalone bundle, Chrome extension sync).
  - All 10 test suites passing cleanly with 0 regressions.
