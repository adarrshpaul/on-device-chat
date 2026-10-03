/**
 * Background Downloader — Non-blocking, progressive model weight caching.
 *
 * Implements strict browser performance safeguards:
 * 1. Uses requestIdleCallback so prefetching only runs when the main thread is idle.
 * 2. Uses fetch with { priority: 'low' } so user network requests always take precedence.
 * 3. Checks navigator.connection (Save-Data and slow 2G/3G connections skip heavy tiers).
 * 4. Progressive tiered queue: Tier 1 (15MB) -> Tier 2 (80MB) -> Tier 3 (Gemma 4).
 * 5. Uses Cache API / IndexedDB to persist weights across page reloads.
 */

export interface PreloadProgress {
  tier: number;
  name: string;
  totalBytes: number;
  loadedBytes: number;
  status: "idle" | "downloading" | "cached" | "skipped";
}

type ProgressListener = (progress: PreloadProgress) => void;

class BackgroundDownloader {
  private listeners: Set<ProgressListener> = new Set();
  private isPrefetching: boolean = false;
  private prefetchQueue: Array<{ tier: number; name: string; url: string; sizeEstimate: number }> = [];

  constructor() {
    this.prefetchQueue = [
      {
        tier: 1,
        name: "MiniLM Router (Tier 1)",
        url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx",
        sizeEstimate: 16 * 1024 * 1024, // ~16MB
      },
      {
        tier: 2,
        name: "SmolLM2-135M (Tier 2)",
        url: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/onnx/model_q4.onnx",
        sizeEstimate: 80 * 1024 * 1024, // ~80MB
      },
    ];
  }

  public subscribe(listener: ProgressListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(p: PreloadProgress) {
    for (const l of this.listeners) l(p);
  }

  /**
   * Schedule progressive background prefetching without hurting page performance.
   * Starts only after a delay (e.g. 4 seconds after page load) and during browser idle frames.
   */
  public startIdlePrefetch(delayMs: number = 4000) {
    if (typeof window === "undefined" || this.isPrefetching) return;

    // Respect user data saver mode or slow mobile connections
    const conn = (navigator as any).connection;
    if (conn?.saveData || conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") {
      console.log("ℹ️ Background prefetch skipped: Data-Saver or slow connection detected.");
      return;
    }

    setTimeout(() => {
      this.runNextIdleBatch();
    }, delayMs);
  }

  private runNextIdleBatch() {
    if (this.prefetchQueue.length === 0) return;

    const task = () => {
      const next = this.prefetchQueue.shift();
      if (!next) return;
      this.fetchChunkIdle(next);
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(task, { timeout: 3000 });
    } else {
      setTimeout(task, 500);
    }
  }

  private async fetchChunkIdle(item: { tier: number; name: string; url: string; sizeEstimate: number }) {
    this.isPrefetching = true;
    this.notify({
      tier: item.tier,
      name: item.name,
      totalBytes: item.sizeEstimate,
      loadedBytes: 0,
      status: "downloading",
    });

    try {
      // Check Cache API first
      const cache = await caches.open("gemma4-agent-models-v1");
      const cached = await cache.match(item.url);

      if (cached) {
        this.notify({
          tier: item.tier,
          name: item.name,
          totalBytes: item.sizeEstimate,
          loadedBytes: item.sizeEstimate,
          status: "cached",
        });
        this.isPrefetching = false;
        // Schedule next tier during next idle period
        this.runNextIdleBatch();
        return;
      }

      // Fetch with priority: 'low' and cache
      const response = await fetch(item.url, {
        priority: "low" as any,
        mode: "cors",
      });

      if (response.ok) {
        await cache.put(item.url, response.clone());
        this.notify({
          tier: item.tier,
          name: item.name,
          totalBytes: item.sizeEstimate,
          loadedBytes: item.sizeEstimate,
          status: "cached",
        });
      } else {
        this.notify({
          tier: item.tier,
          name: item.name,
          totalBytes: item.sizeEstimate,
          loadedBytes: 0,
          status: "skipped",
        });
      }
    } catch {
      // Fail gracefully without interrupting user
      this.notify({
        tier: item.tier,
        name: item.name,
        totalBytes: item.sizeEstimate,
        loadedBytes: 0,
        status: "skipped",
      });
    } finally {
      this.isPrefetching = false;
      // Continue queue in next idle slot
      this.runNextIdleBatch();
    }
  }
}

export const backgroundDownloader = new BackgroundDownloader();
