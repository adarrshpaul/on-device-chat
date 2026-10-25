/**
 * Lightweight Web Client Telemetry Tracker
 * 
 * Non-blocking interaction ingestion engine modeled after the Vega System One recipe:
 * - Ingests active route, guide progression, element dwell time, and cursor coordinates.
 * - Detects micro-interaction behavior patterns ('hovering_without_clicking', 'idle_on_canvas', etc.)
 *   without blocking the 60fps main UI thread (<0.2ms event overhead).
 * - Serves compact snapshots for zero-token Edge Decision Bridge.
 */

export type UserActionPattern =
  | "hovering_without_clicking"
  | "rapid_tab_switching"
  | "idle_on_canvas"
  | "form_validation_stuck"
  | "proceeding_normally";

export interface DOMFocusState {
  element_id: string;
  selector: string;
  tag_name: string;
  hover_duration_ms: number;
  cursor_position_xy: [number, number];
  bounding_rect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface UIContextSnapshot {
  current_route: string;
  active_guide_id?: string;
  completed_steps: string[];
  dom_focus: DOMFocusState;
  user_action_pattern: UserActionPattern;
  recent_routes: string[];
  timestamp: number;
}

export type TelemetryListener = (snapshot: UIContextSnapshot) => void;

export class TelemetryTracker {
  private activeGuideId?: string;
  private completedSteps: string[] = [];
  private recentRoutes: Array<{ route: string; time: number }> = [];

  private currentHoverElement: Element | null = null;
  private hoverStartTime: number = 0;
  private currentCursorPos: [number, number] = [0, 0];
  private dwellTimerId: any = null;

  private isRunning: boolean = false;
  private listeners: Set<TelemetryListener> = new Set();

  private lastDispatchedPattern: UserActionPattern = "proceeding_normally";
  private lastDispatchedElementId: string = "";

  constructor() {
    this.recordCurrentRoute();
  }

  /**
   * Start tracking browser events passively
   */
  public start(): void {
    if (this.isRunning || typeof window === "undefined") return;
    this.isRunning = true;

    window.addEventListener("mousemove", this.handleMouseMove, { passive: true });
    window.addEventListener("click", this.handleClick, { passive: true });
    window.addEventListener("popstate", this.handleRouteChange, { passive: true });
    window.addEventListener("hashchange", this.handleRouteChange, { passive: true });

    // Periodic lightweight dwell evaluation (every 250ms)
    this.dwellTimerId = setInterval(() => {
      this.evaluateDwell();
    }, 250);
  }

  /**
   * Stop tracking and clean up listeners
   */
  public stop(): void {
    if (!this.isRunning || typeof window === "undefined") return;
    this.isRunning = false;

    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("click", this.handleClick);
    window.removeEventListener("popstate", this.handleRouteChange);
    window.removeEventListener("hashchange", this.handleRouteChange);

    if (this.dwellTimerId) {
      clearInterval(this.dwellTimerId);
      this.dwellTimerId = null;
    }
  }

  /**
   * Subscribe to state transition snapshots
   */
  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setActiveGuide(guideId: string | undefined): void {
    this.activeGuideId = guideId;
  }

  public markStepCompleted(stepId: string): void {
    if (!this.completedSteps.includes(stepId)) {
      this.completedSteps.push(stepId);
      this.notifyListeners();
    }
  }

  public resetGuide(): void {
    this.activeGuideId = undefined;
    this.completedSteps = [];
  }

  /**
   * Extract current immutable snapshot
   */
  public getSnapshot(): UIContextSnapshot {
    const now = Date.now();
    const currentRoute = typeof window !== "undefined"
      ? (window.location.pathname + window.location.hash || "/")
      : "/";

    let hoverDuration = 0;
    if (this.currentHoverElement && this.hoverStartTime > 0) {
      hoverDuration = Math.max(0, now - this.hoverStartTime);
    }

    const domFocus = this.resolveDOMFocus(this.currentHoverElement, hoverDuration);
    const pattern = this.classifyUserPattern(domFocus, hoverDuration);

    // Keep last 3 routes for quick context
    const recent = this.recentRoutes.slice(-3).map(r => r.route);

    return {
      current_route: currentRoute,
      active_guide_id: this.activeGuideId,
      completed_steps: [...this.completedSteps],
      dom_focus: domFocus,
      user_action_pattern: pattern,
      recent_routes: recent,
      timestamp: now,
    };
  }

  // --- Private Event Handlers ---

  private handleMouseMove = (e: MouseEvent) => {
    this.currentCursorPos = [e.clientX, e.clientY];

    // Throttle target inspection
    const target = e.target as Element | null;
    if (target !== this.currentHoverElement) {
      this.currentHoverElement = target;
      this.hoverStartTime = Date.now();
    }
  };

  private handleClick = (_e: MouseEvent) => {
    // Reset hover timer on click as user performed an action
    this.hoverStartTime = Date.now();
  };

  private handleRouteChange = () => {
    this.recordCurrentRoute();
    this.notifyListeners();
  };

  private recordCurrentRoute(): void {
    if (typeof window === "undefined") return;
    const current = window.location.pathname + window.location.hash || "/";
    const now = Date.now();
    this.recentRoutes.push({ route: current, time: now });
    // Keep window of last 10
    if (this.recentRoutes.length > 10) {
      this.recentRoutes.shift();
    }
  }

  private evaluateDwell(): void {
    if (!this.isRunning) return;
    const snapshot = this.getSnapshot();

    // Trigger notification when:
    // 1. Behavior pattern changes (e.g. from normal to hovering_without_clicking)
    // 2. Focused element changes
    // 3. Hover duration crossed the 1200ms threshold
    const patternChanged = snapshot.user_action_pattern !== this.lastDispatchedPattern;
    const elementChanged = snapshot.dom_focus.element_id !== this.lastDispatchedElementId;
    const crossedDwellThreshold =
      snapshot.dom_focus.hover_duration_ms >= 1200 &&
      this.lastDispatchedPattern !== "hovering_without_clicking" &&
      this.lastDispatchedPattern !== "idle_on_canvas";

    if (patternChanged || (elementChanged && snapshot.dom_focus.hover_duration_ms > 400) || crossedDwellThreshold) {
      this.lastDispatchedPattern = snapshot.user_action_pattern;
      this.lastDispatchedElementId = snapshot.dom_focus.element_id;
      this.notifyListeners();
    }
  }

  private resolveDOMFocus(el: Element | null, hoverDuration: number): DOMFocusState {
    if (!el || typeof window === "undefined") {
      return {
        element_id: "",
        selector: "",
        tag_name: "",
        hover_duration_ms: hoverDuration,
        cursor_position_xy: this.currentCursorPos,
      };
    }

    const id = el.id || el.getAttribute("data-testid") || el.getAttribute("name") || "";
    const tagName = el.tagName.toLowerCase();

    // Generate compact selector
    let selector = tagName;
    if (el.id) {
      selector = `#${el.id}`;
    } else if (el.classList && el.classList.length > 0) {
      const firstClass = Array.from(el.classList).find(c => !c.startsWith("hover:") && !c.includes("["));
      if (firstClass) selector = `${tagName}.${firstClass}`;
    }

    let rect: { top: number; left: number; width: number; height: number } | undefined;
    try {
      const r = el.getBoundingClientRect();
      rect = {
        top: Math.round(r.top),
        left: Math.round(r.left),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    } catch {
      // ignore
    }

    return {
      element_id: id,
      selector,
      tag_name: tagName,
      hover_duration_ms: hoverDuration,
      cursor_position_xy: this.currentCursorPos,
      bounding_rect: rect,
    };
  }

  private classifyUserPattern(focus: DOMFocusState, hoverDuration: number): UserActionPattern {
    const now = Date.now();

    // Check rapid route oscillations in last 5 seconds
    const recent5s = this.recentRoutes.filter(r => now - r.time < 5000);
    if (recent5s.length >= 4) {
      return "rapid_tab_switching";
    }

    // Check canvas hover
    if (focus.tag_name === "canvas" || focus.selector.includes("canvas") || focus.element_id.includes("canvas")) {
      if (hoverDuration > 1000) {
        return "idle_on_canvas";
      }
    }

    // Check form validation stuck
    if (typeof document !== "undefined" && document.activeElement) {
      const active = document.activeElement as HTMLElement;
      if (
        (active.tagName === "INPUT" || active.tagName === "SELECT") &&
        (active.classList.contains("invalid") || (active as HTMLInputElement).validity?.valid === false)
      ) {
        return "form_validation_stuck";
      }
    }

    // Check dwell without clicking (>1200ms)
    if (hoverDuration >= 1200 && focus.element_id) {
      return "hovering_without_clicking";
    }

    return "proceeding_normally";
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("[TelemetryTracker] Listener error:", err);
      }
    }
  }
}

// Global singleton instance
export const telemetryTracker = new TelemetryTracker();
