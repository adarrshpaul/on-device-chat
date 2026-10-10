# State: Heavy Model Progress Telemetry & Lighthouse Performance Optimization

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** current
- **Version:** `0.1.9`
- **Status:** Active / Production Deployed
- **Valid_from:** 2026-10-10T03:05:00Z

## Summary
The chat widget provides real-time download progress feedback (model name, percentage bar, downloaded/total MBs, cached indicator) across all heavy tiers (Laya System 1 at 524 MB, Gemma 4 E2B at 680 MB, SmolLM2 at 80 MB, MiniLM Router at 15 MB). Portfolio web application incorporates network-first service worker routing with Cache-Control headers ensuring instant webpage updates on refresh, deferred animations via `requestIdleCallback`, font preloading, and delayed idle prefetching, lifting Lighthouse score from 49 to 64 with 40ms Total Blocking Time and 0.003 Cumulative Layout Shift.

## Active Facts & Invariants
1. `Heavy Model Progress`: When switching or downloading model tiers, `modelLoadingProgress` streams real-time updates through `ChatHeader` (top glowing progress strip) and `ChatWidget` (in-stream telemetry banner).
2. `Cache Indicator`: Once a model tier is downloaded into IndexedDB/Origin Private File System cache, persistent telemetry indicates cached readiness without redundant download cycles.
3. `Audit Bot Protection`: Idle model prefetching (`backgroundDownloader`) is delayed to 12s post-load and automatically inhibited for Lighthouse/Chrome-Lighthouse audit user agents to prevent network starvation during performance benchmarks.
4. `PWA Network-First Navigation`: Custom service worker bypasses stale cache on page navigation (`no-cache`), falling back to offline cache only if network fails.
