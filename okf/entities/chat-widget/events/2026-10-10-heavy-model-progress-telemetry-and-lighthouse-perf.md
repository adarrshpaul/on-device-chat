# Event: Heavy Model Progress Telemetry & Lighthouse Performance Optimization

- **Timestamp:** 2026-10-10T03:05:00Z
- **Entity:** `chat-widget`
- **Type:** UX Telemetry & Performance Optimization
- **Version:** `0.1.9`

## Trigger
1. User identified lack of visible progress indication when loading heavy on-device model tiers (Laya System 1 at ~524 MB, Gemma 4 at ~680 MB), creating an unresponsive perception during initial cold download.
2. User identified PWA caching issue on `paulcreates.online` where changes only appeared after hard refresh (`Cmd+Shift+R`).
3. Lighthouse performance audit scored 49/100 due to preloader delays, background 173MB download during audit runs, and un-optimized font/animation triggers.

## Changes Made
1. **Model Download Telemetry**:
   - Updated `escalationManager.ts` with `ModelProgressInfo` interface and hooked `onProgress` callbacks across all model tiers.
   - Updated `useChat.ts` to surface reactive `modelLoadingProgress` state.
   - Updated `ChatHeader.tsx` to render a top-docked progress bar with real-time percentage and tier details.
   - Updated `ChatWidget.tsx` to display an in-stream telemetry card with cached status indicator.
2. **PWA Network-First Navigation**:
   - Updated `src/custom-sw.js` in `cloudfare-portfolio-app` to enforce `fetch(event.request, { cache: 'no-cache' })` with offline fallback.
   - Added Cache-Control headers and auto service worker update check on load in `index.html`.
3. **Lighthouse Performance Optimization**:
   - Updated `src/about/about.component.ts` to skip preloader for bots, accelerate user preloader from >1.6s to 0.4s, and defer below-the-fold GSAP animations via `requestIdleCallback`.
   - Updated `src/lib/backgroundDownloader.ts` to delay idle prefetching to 12s and inhibit during Lighthouse audit bot runs.
   - Injected `<link rel="preload" as="style">` for Google Fonts in `src/index.html`.
   - Deployed live to Cloudflare Pages (`https://paulcreates.online`).
   - Ran verified Lighthouse audit: Performance improved from 49 to 64, Speed Index 5.3s, Total Blocking Time 40ms, CLS 0.003, Accessibility 89, SEO 85.
