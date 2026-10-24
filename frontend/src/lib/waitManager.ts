/**
 * Real Waits: DOM-Settle & Network Idle Wait Manager (TASK-114)
 *
 * Eliminates arbitrary sleeps (`setTimeout(..., 1000)`) in browser automation.
 * Replaces them with real physiological browser state signals:
 * 1. DOM Settle: MutationObserver quiet period (no DOM mutations for N ms).
 * 2. Network Idle:
 *    - Extension tier: CDP `Network.*` monitoring active in-flight HTTP/WebSocket requests.
 *    - Widget / Standalone tier: PerformanceObserver resource timing + active fetch tracking.
 */

declare const chrome: any;

export interface WaitOptions {
  quietPeriodMs?: number; // Time window with zero mutations (default: 200ms)
  idlePeriodMs?: number;  // Time window with zero in-flight network activity (default: 250ms)
  timeoutMs?: number;     // Maximum wait cutoff (default: 5000ms)
}

export interface WaitResult {
  settled: boolean;
  domSettled: boolean;
  networkIdle: boolean;
  durationMs: number;
  reason?: string;
}

export class WaitManager {
  private static inFlightRequests = 0;
  private static fetchInstrumented = false;

  /**
   * Initializes lightweight in-page network instrumentation for fetch / XHR if in browser.
   */
  public static instrumentPageNetwork(): void {
    if (this.fetchInstrumented || typeof window === "undefined") return;
    this.fetchInstrumented = true;

    // Track active fetch requests
    const originalFetch = window.fetch;
    if (typeof originalFetch === "function") {
      window.fetch = async (...args) => {
        this.inFlightRequests++;
        try {
          return await originalFetch(...args);
        } finally {
          this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
        }
      };
    }
  }

  /**
   * Waits for DOM mutations to cease for a designated quiet period.
   * Resolves immediately if the DOM is already idle for quietPeriodMs.
   */
  public static async waitForDomSettle(options: WaitOptions = {}): Promise<boolean> {
    const quietMs = options.quietPeriodMs ?? 200;
    const timeoutMs = options.timeoutMs ?? 5000;

    if (typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.body) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let quietTimer: any = null;
      let timeoutTimer: any = null;
      let observer: MutationObserver | null = null;

      const cleanup = (success: boolean) => {
        if (quietTimer) clearTimeout(quietTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        resolve(success);
      };

      const resetQuietTimer = () => {
        if (quietTimer) clearTimeout(quietTimer);
        quietTimer = setTimeout(() => cleanup(true), quietMs);
      };

      // Set timeout cutoff
      timeoutTimer = setTimeout(() => cleanup(false), timeoutMs);

      // Start initial quiet timer in case DOM is already settled
      resetQuietTimer();

      try {
        observer = new MutationObserver(() => {
          resetQuietTimer();
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      } catch {
        cleanup(true);
      }
    });
  }

  /**
   * Waits for active network requests to reach 0 and stay idle for idlePeriodMs.
   */
  public static async waitForNetworkIdle(options: WaitOptions = {}): Promise<boolean> {
    const idleMs = options.idlePeriodMs ?? 250;
    const timeoutMs = options.timeoutMs ?? 5000;

    // 1. Try extension CDP Network idle if extension runtime is present
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      try {
        const cdpRes = await new Promise<{ ok: boolean }>((res) => {
          chrome.runtime.sendMessage(
            { target: "background", type: "CDP_WAIT_NETWORK_IDLE", idleMs, timeoutMs },
            (response: any) => {
              if (chrome.runtime.lastError || !response?.ok) {
                res({ ok: false });
              } else {
                res({ ok: true });
              }
            }
          );
        });
        if (cdpRes.ok) return true;
      } catch {
        // Fall back to in-page monitoring
      }
    }

    // 2. In-page resource / fetch monitoring
    if (typeof window === "undefined") return true;
    this.instrumentPageNetwork();

    return new Promise<boolean>((resolve) => {
      const startTime = performance.now();
      let lastActivityTime = performance.now();

      // Check PerformanceObserver resource additions
      let perfObserver: PerformanceObserver | null = null;
      if (typeof PerformanceObserver !== "undefined") {
        try {
          perfObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              lastActivityTime = performance.now();
            }
          });
          perfObserver.observe({ entryTypes: ["resource"] });
        } catch {
          // PerformanceObserver unsupported for resource entryTypes
        }
      }

      const interval = setInterval(() => {
        const now = performance.now();
        const elapsed = now - startTime;

        if (this.inFlightRequests > 0) {
          lastActivityTime = now;
        }

        const quietTime = now - lastActivityTime;
        if (quietTime >= idleMs && this.inFlightRequests === 0) {
          clearInterval(interval);
          perfObserver?.disconnect();
          resolve(true);
        } else if (elapsed >= timeoutMs) {
          clearInterval(interval);
          perfObserver?.disconnect();
          resolve(false);
        }
      }, 50);
    });
  }

  /**
   * Universal wait: Waits for BOTH DOM to settle and Network to go idle.
   */
  public static async waitForPageReady(options: WaitOptions = {}): Promise<WaitResult> {
    const t0 = performance.now();
    const [domSettled, networkIdle] = await Promise.all([
      this.waitForDomSettle(options),
      this.waitForNetworkIdle(options),
    ]);
    const durationMs = Math.round(performance.now() - t0);

    return {
      settled: domSettled && networkIdle,
      domSettled,
      networkIdle,
      durationMs,
      reason: !domSettled
        ? "DOM mutations did not settle within timeout"
        : !networkIdle
        ? "Network activity did not settle within timeout"
        : undefined,
    };
  }
}
