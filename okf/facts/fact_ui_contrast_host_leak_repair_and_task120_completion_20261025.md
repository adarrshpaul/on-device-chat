---
id: fact_ui_contrast_host_leak_repair_and_task120_completion_20261025
entity: on-device-chat
title: Complete UI Host Leak Immunity, WCAG AAA Contrast Elevation, and TASK-120 Benchmark Completion
date: 2026-10-25
author: Antigravity Assistant
layer: current
status: verified
tags: [ui, contrast, wcag, css-isolation, benchmarks, task-120, cloudflare-pages]
---

# Fact: UI Host Leak Immunity, WCAG AAA Contrast Elevation, and TASK-120 Benchmark Completion

## 1. UI Contrast & Adversarial Host CSS Immunity
- **Root Cause Analysis**:
  - In user CMS/host environments with rules like `button { background-color: #ffffff !important; }`, unstyled or selector-excluded buttons inside the widget leaked white backgrounds with white text.
  - The yellow bolt emoji `⚡` rendered on `#D4FF00` (Electric Lime) or Stark White cards had an unacceptable contrast ratio of ~1.3:1.
  - Semi-transparent step badges (`bg-black/15`) appeared muddy olive on neon lime backgrounds.
- **Architectural Solution**:
  - Implemented explicit component classes in `frontend/src/index.css` with guaranteed `!important` backgrounds:
    - `.tier-menu-item`: Solid dark `#0c1222 !important`, border `#ffffff1f !important`, text `#f8fafc !important` (16.5:1 contrast).
    - `.tier-menu-item-selected`: `#121e3d !important`, cyan border `#38bdf8 !important`.
    - `.g4-header-btn`: Clean obsidian transparent hover glass, zero border leak.
    - `.g4-bubble-action-btn`, `.g4-mic-btn`, `.g4-send-btn-disabled`, `.g4-scroll-chevron`.
    - Made `.g4-window-card` solid obsidian `#090d18 !important` (eliminating background text bleed).
  - Integrated `stripLeadingEmoji` across `ChatWidget.tsx` Hero cards and Quick Routines carousel, removing yellow emoji clashes while retaining black play action badges.
  - Upgraded step badges on high-key cards to solid pitch black (`bg-black text-white font-mono font-bold`) achieving **21:1 contrast (WCAG AAA)**.
- **Automated Physical Verification**:
  - Validated via Playwright with hostile CSS injection:
    - `tier_menu_repaired.png`: Unselected items remain `rgb(12, 18, 34)` with `rgb(248, 250, 252)` text.
    - `quick_routines_discovered_contrast.png`: Crisp black text on lime/white with pitch-black step pills.
  - All 18 frontend test suites in `npm test` passed with 0 errors.

## 2. Live Cloudflare Pages Deployment
- Built production docs site: `npm run build:docs`.
- Deployed cleanly to `local-agent-harness` on Cloudflare Pages via OAuth:
  `npx wrangler pages deploy docs --project-name=local-agent-harness --branch=main --commit-dirty=true`
- Live verification: `https://agent.paulcreates.online` returned HTTP/2 200.

## 3. TASK-120 Empirical Benchmark Completion
- Completed paired A/B empirical evaluation across all 10 real-world automation tasks (books_category, books_next_page, login, checkbox, dropdown, number_input, todo_add, shadow_read, iframe_type, dynamic_wait).
- Re-ran the incomplete tasks (shadow_read, iframe_type, dynamic_wait, todo_add) using identical remote model inference with zero infrastructure errors.
- **Final Results**:
  - Version A (0.3.0 baseline): 29/45 valid runs passed (64.4%), 5 false completions, median 3 model calls.
  - Version B (0.4.0): 32/46 valid runs passed (69.6%), 3 false completions, median 2 model calls.
  - Version 0.4.0 achieved 100% pass rate (3/3 valid reps) on `dynamic_wait` compared to 20% (1/5) in 0.3.0 due to adaptive DOM polling.
- Committed full test traces and results to `benchmarks/harness_ab/` at commit `341668b`.
