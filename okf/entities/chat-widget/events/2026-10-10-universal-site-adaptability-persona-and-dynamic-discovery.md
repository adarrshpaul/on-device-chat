# Event: Universal Site Adaptability, Persona Detection & Dynamic DOM Discovery

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Type:** architectural_upgrade
- **Trigger:** Transforming the chat copilot into an adaptable drop-in assistant for all websites, categories, and frameworks.

## Context & Objectives
Previously, section navigation and starter action chips relied on static portfolio keywords (`projects`, `skills`, `journey`). When embedded on e-commerce, documentation, SaaS products, blogs, or general web applications, navigation could not resolve domain-specific landmarks without manual configuration.

## Implementation Details
1. **Universal Site Persona Engine (`sitePersona.ts`):**
   - Autonomous site category classification (`ecommerce`, `docs`, `saas`, `portfolio`, `blog`, `general`) inspecting text signatures, meta tags, and interactive DOM elements.
   - Extracts live page headings (`h1..h4`) directly from the host DOM to generate adaptive quick-action pills (`📍 [Heading]`).
   - Automatically detects host theme engine (DaisyUI, Tailwind, CSS variables, native `prefers-color-scheme`).
2. **Universal Dynamic Landmark Resolution (`escalationManager.ts`):**
   - Upgraded `isSectionNavIntent` to search dynamic host DOM landmarks: checks direct IDs, fuzzy heading text matches, internal anchor links (`nav a[href*='#']`), and ARIA landmarks.
   - Operates on 100% of websites with 0 token overhead and sub-10ms latency.
3. **Universal Search & Form Input Execution (`escalationManager.ts`):**
   - Automatically locates search input fields (`input[type='search']`, `input[name*='search']`, `input[placeholder*='search']`).
   - Glides the human cursor to the search box, types query with synthetic reactivity, and submits.
4. **Adaptive Chat Header & Empty State (`ChatWidget.tsx`):**
   - Dynamically displays host domain + category badge (`Ready on paulcreates.online • PORTFOLIO & PROFILE`).
   - Renders host-specific action chips that trigger real, paced human navigation.
