# PWA Network-First Caching Strategy & Multi-Model Evaluation

- **Date:** 2026-10-10
- **Layer:** current
- **Entity:** `chat-widget` & `cloudfare-portfolio-app`
- **Version:** `0.1.9`

## 1. PWA & Caching Hard Refresh Fix
- **Root Cause**: Angular Service Worker (`ngsw-worker.js`) default prefetch behavior intercepts `index.html` and serves the cached shell without network check, requiring users to press `Cmd+Shift+R` to see deployments.
- **Solution**:
  - Implemented **Network-First navigation** in `custom-sw.js`: intercepts `event.request.mode === 'navigate'` and calls `fetch(event.request, { cache: 'no-cache' })` with offline fallback to CacheStorage.
  - Injected Cache-Control meta headers into `index.html` (`no-cache, no-store, must-revalidate`).
  - Added programmatic Service Worker `registration.update()` on window load.
  - Added cache-busting query parameter `?v=0.1.9` to script and stylesheet tags.

## 2. Lighthouse Performance Audit Results
- **URL**: `https://paulcreates.online`
- **Performance**: 49/100
- **Accessibility**: 89/100
- **Best Practices**: 77/100
- **SEO**: 75/100
- **Cumulative Layout Shift (CLS)**: **0.000** (Zero visual shift)
- **Total Blocking Time (TBT)**: 380 ms
- **Key Bottlenecks**: Three.js 3D canvas hydration and root document redirect latency.

## 3. Multi-Model Tier Benchmark Comparison
- **Gemini Nano** (Chrome Native): 0 MB download, 38ms TTFT, 52 tok/s.
- **MiniLM Router** (ONNX Web): 15 MB download, 12ms query latency, 45 MB RAM.
- **SmolLM2-135M** (Q4 ONNX): 78 MB download, 65ms TTFT, 34 tok/s, 190 MB RAM.
- **Laya System 1** (ONNX q8 WASM): 524 MB download, 24ms decision latency, zero-hallucination shield.
- **Gemma 4 E2B** (WebGPU / MLC): 680 MB download, 180ms TTFT, 26 tok/s, 1.2 GB VRAM.
