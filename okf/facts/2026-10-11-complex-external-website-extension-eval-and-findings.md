# OKF Fact: Empirical Evaluation of Chrome Extension on Complex Real-World E-Commerce Sites

- **Date**: 2026-10-11T13:18:00Z
- **Author**: Antigravity Pair Programming Agent
- **Entity**: `browser-extension`
- **Layer**: `current`
- **Status**: `verified`

## 1. Context & Motivation
- **Objective**: Stress-test the Chrome Developer Extension (`extension/`) and npm core engine (`on-device-chat`) on complex, unfamiliar, third-party web applications rather than local testbeds.
- **Target Environments**:
  1. **Books to Scrape (`https://books.toscrape.com/`)**: Server-rendered multi-page e-commerce storefront with categories, star ratings, pagination, and HTML `<form>` action submissions.
  2. **SauceDemo (`https://www.saucedemo.com/`)**: Dynamic React single-page application with credentials authentication, inventory sorting, add-to-cart mutations, and client-side routing (`/inventory.html`).

## 2. Key Empirical Findings & Architectural Gaps Discovered
1. **Entity Container Discovery Gaps (Fixed)**:
   - *Problem*: Initial `findEntityContainer` only looked for rigid selectors (`tr`, `li`, `article`, `.card`), failing on e-commerce structures like SauceDemo's `.inventory_item`.
   - *Problem*: Initial `findSiblingEntities` only inspected `root.parentElement`. On Books to Scrape (`<ol class="row"> > <li> > <article class="product_pod">`), inspecting `<li>.children` yielded only 1 book instead of 20.
   - *Solution Implemented*:
     - Expanded `findEntityContainer` to support `.inventory_item`, `.product_pod`, `.product-card`, `[class*='product_item']`, `[class*='item-card']`.
     - Implemented multi-level ancestor crawl (`while (listContainer && listContainer !== document.body)`) in `findSiblingEntities`, scanning upward until finding the ancestor holding multiple sibling items.
     - Result on SauceDemo: Discovered all 6 items (`Select All (6)`) and enabled 1-click batch cart automation.

2. **Server-Side Form Submissions vs. Client-Side DOM Mutations**:
   - *Discovery*: On static server-rendered stores (`books.toscrape.com`), action buttons ("Add to basket") are HTML `<form method="post">` triggers causing standard page navigations.
   - *Discovery*: On dynamic SPAs (`saucedemo.com`), action buttons mutate client-side state without reloading the document.
   - *Implication*: Macro recorder cleanly captures client-side button clicks, input mutations, and DOM state deltas. For form-based multi-page transitions, cross-page session storage persistence is required.

3. **Autonomous Dynamic Workflow Generation**:
   - On Books to Scrape: Agent dynamically grounded to `books.toscrape.com` and synthesized `Explore All products (AI Predicted 99%)`.
   - On SauceDemo: Agent adapted to the login route (`/`), persisted across the SPA redirect to `/inventory.html`, and synthesized `Explore Swag Labs (AI Predicted 100%)`.

4. **Style Integrity**:
   - The widget and floating launcher mounted with zero layout shifts or visual distortion across both third-party sites.
   - Preserving selector prefixing (`.g4-*`) and ensuring strict CSS scoping guarantees immunity against external Bootstrap and Tailwind collisions.

## 3. Visual Artifacts
- [`complex_bts_page_with_launcher.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/complex_bts_page_with_launcher.png)
- [`complex_bts_chat_opened.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/complex_bts_chat_opened.png)
- [`complex_bts_macro_active.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/complex_bts_macro_active.png)
- [`complex_saucedemo_login.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/complex_saucedemo_login.png)
- [`complex_saucedemo_inventory_with_launcher.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/complex_saucedemo_inventory_with_launcher.png)
- [`complex_saucedemo_chat_opened.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/complex_saucedemo_chat_opened.png)
- [`complex_saucedemo_batch_confirmation.png`](file:///Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/complex_saucedemo_batch_confirmation.png)
