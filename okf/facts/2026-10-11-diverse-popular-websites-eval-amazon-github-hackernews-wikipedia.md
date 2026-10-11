# OKF Fact: Diverse High-Traffic Web Application Stress Testing (Amazon, GitHub, Hacker News, Wikipedia)

- **Date**: 2026-10-11T13:40:00Z
- **Author**: Antigravity Pair Programming Agent
- **Entity**: `browser-extension`
- **Layer**: `current`
- **Status**: `verified`

## 1. Context & Benchmark Scope
- **Motivation**: Evaluate the Chrome Developer Extension (`extension/`) and npm package (`on-device-chat`) across diverse, high-traffic production websites representing disparate architectural archetypes:
  1. **Amazon** (`https://www.amazon.com/s?k=wireless+earbuds`): Complex e-commerce portal with high z-index sticky navigation bars and search grids.
  2. **GitHub** (`https://github.com/trending`): Developer platform with nested repository cards, Turbo PJAX transitions, and dark/light themes.
  3. **Hacker News** (`https://news.ycombinator.com/`): Legacy nested `<table>` markup without modern CSS classes.
  4. **Wikipedia** (`https://en.wikipedia.org/wiki/Artificial_intelligence`): Content-dense reference portal with table-of-contents navigation and vector skin headers.

## 2. Issues Discovered & Engineering Fixes Implemented
1. **Header Element Overlap in Chat Widget (`ChatHeader.tsx`)**:
   - *Issue*: In the 440px chat window, having `AI Copilot` title + long model tier name ("Semantic Search & Indexing") + `⚡ Workflows` + desktop `Record Macro` + window control buttons caused items to exceed 490px, leading to visual text overlap on desktop viewports.
   - *Fix*: Streamlined `ChatHeader.tsx`:
     - Applied `flex-1 min-w-0 overflow-hidden` to the left brand container.
     - Constrained model tier name button with `max-w-[110px] truncate`.
     - Removed redundant desktop `Record Macro` text button from the header (it is already available in the `•••` overflow menu and the suggested workflow chips below). Pinned `Finish Macro` only when active recording is underway.
     - Verified clean layout with >100px breathing room across all tested websites.

2. **Entity Recognition Across Major Web Platforms (`batchEngine.ts`, `macroRecorder.ts`)**:
   - *Issue*: E-commerce search results (Amazon) and developer repo lists (GitHub) use custom data attributes and component classes that were missing from `cardSelectors`.
   - *Fix*: Added platform-specific container selectors:
     - Amazon: `[data-component-type='s-search-result']`, `.s-result-item[data-asin]`, `.s-result-item`.
     - GitHub: `article.Box-row`, `.Box-row`.
     - Hacker News: `tr.athing`, `.athing`.
   - Enhanced heading & title extraction to query `[data-cy='title-recipe']`, `.titleline`, `h2 a`, `a`.
   - Enhanced price/status extraction to query `.a-price`, `.score`, `.badge`.

## 3. Empirical Test Results (100% Pass)
| Platform | Page Type | Floating Launcher | Chat Widget | Header Clean | Entities Detected | Errors |
|---|---|---|---|---|---|---|
| **Wikipedia** | Reference / TOC | Visible ✅ | Opened ✅ | Clean ✅ (>110px gap) | Section landmarks | None |
| **GitHub** | Developer Repo List | Visible ✅ | Opened ✅ | Clean ✅ (>100px gap) | **13 Repositories** | None |
| **Hacker News** | Legacy HTML Table | Visible ✅ | Opened ✅ | Clean ✅ (>120px gap) | **30 Stories** | None |
| **Amazon** | Mega E-Commerce | Visible ✅ | Opened ✅ | Clean ✅ (>120px gap) | **23 Products** | None |

## 4. Visual Evidence Artifacts
- [`diverse_amazon_chat_opened_v2.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/diverse_amazon_chat_opened_v2.png)
- [`diverse_github_chat_opened_v2.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/diverse_github_chat_opened_v2.png)
- [`diverse_wikipedia_chat_opened_v2.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/diverse_wikipedia_chat_opened_v2.png)
- [`diverse_hackernews_chat_opened_v2.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/diverse_hackernews_chat_opened_v2.png)
