/**
 * Vega Edge Decision Bridge
 * 
 * Bridges client telemetry snapshots to the Vega System One Zero-Token Step Classifier:
 * - Submits compact telemetry JSON to the Edge / Container endpoint running
 *   'nandakishorm/vega-08b-public-intents'.
 * - Applies micro-tuned F1 safety policy thresholds:
 *     * confidence > 0.65 for contextual tooltip cues
 *     * confidence > 0.85 for interactive macro walkthrough escalation
 * - Fallback Circuit: If edge is offline or exceeds 120ms timeout, executes client reflex
 *   heuristic with honest model labeling ('local-reflex-fallback') adhering to Rule §7.
 */

import { UIContextSnapshot, telemetryTracker } from "./telemetryTracker";

export interface VegaGuideDirective {
  action: "SHOW_STEP" | "START_FLOW" | "WAIT";
  target_element?: string;
  step?: number;
  flow_id?: string;
  confidence: number;
  candidate_label?: string;
  model: string; // "vega-08b-public-intents" | "local-reflex-fallback"
  reasoning?: string;
}

export type DirectiveListener = (directive: VegaGuideDirective) => void;

export class VegaEdgeBridge {
  private endpointUrl: string = "/api/vega/route";
  private isConnected: boolean = false;
  private lastDirective: VegaGuideDirective = {
    action: "WAIT",
    confidence: 1.0,
    model: "local-reflex-fallback",
  };
  private directiveListeners: Set<DirectiveListener> = new Set();
  private unsubscribeTelemetry: (() => void) | null = null;
  private inFlightRequest: boolean = false;

  constructor(endpointUrl?: string) {
    if (endpointUrl) {
      this.endpointUrl = endpointUrl;
    }
  }

  public setEndpoint(url: string): void {
    this.endpointUrl = url;
  }

  public getEndpoint(): string {
    return this.endpointUrl;
  }

  public isEdgeConnected(): boolean {
    return this.isConnected;
  }

  public getLastDirective(): VegaGuideDirective {
    return this.lastDirective;
  }

  /**
   * Subscribe to incoming Vega directives
   */
  public onDirective(listener: DirectiveListener): () => void {
    this.directiveListeners.add(listener);
    return () => this.directiveListeners.delete(listener);
  }

  /**
   * Start listening to the telemetry stream and dispatching evaluations
   */
  public start(): void {
    if (this.unsubscribeTelemetry) return;
    telemetryTracker.start();
    this.unsubscribeTelemetry = telemetryTracker.subscribe(async (snapshot) => {
      // Avoid queueing concurrent requests
      if (this.inFlightRequest) return;
      await this.evaluateSnapshot(snapshot);
    });
  }

  /**
   * Stop listening
   */
  public stop(): void {
    if (this.unsubscribeTelemetry) {
      this.unsubscribeTelemetry();
      this.unsubscribeTelemetry = null;
    }
  }

  /**
   * Evaluate a telemetry snapshot through the Edge Vega pipeline or local fallback
   */
  public async evaluateSnapshot(snapshot: UIContextSnapshot): Promise<VegaGuideDirective> {
    // Skip if user is actively proceeding normally unless in a guided flow
    if (snapshot.user_action_pattern === "proceeding_normally" && !snapshot.active_guide_id) {
      const idleDirective: VegaGuideDirective = {
        action: "WAIT",
        confidence: 0.99,
        model: "local-reflex-fallback",
        reasoning: "User is proceeding normally",
      };
      this.dispatchDirective(idleDirective);
      return idleDirective;
    }

    this.inFlightRequest = true;
    const candidateLabels = this.resolveCandidateLabels(snapshot);

    try {
      // 1. Attempt edge inference call with 120ms timeout budget
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120);

      const response = await fetch(this.endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_context: snapshot,
          candidate_labels: candidateLabels,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const edgeResult = await response.json();
        this.isConnected = true;
        const directive = this.applyPolicyThresholds(edgeResult, snapshot);
        this.dispatchDirective(directive);
        return directive;
      }
      throw new Error(`Edge returned status ${response.status}`);
    } catch {
      // 2. Fallback to Local Deterministic Reflex Policy (Zero Fraud, explicitly labeled)
      this.isConnected = false;
      const fallbackDirective = this.evaluateLocalFallbackPolicy(snapshot, candidateLabels);
      this.dispatchDirective(fallbackDirective);
      return fallbackDirective;
    } finally {
      this.inFlightRequest = false;
    }
  }

  /**
   * Candidate labels tailored for zero-token UI step resolution
   */
  private resolveCandidateLabels(snapshot: UIContextSnapshot): string[] {
    if (snapshot.user_action_pattern === "idle_on_canvas") {
      return [
        "trigger_tooltip_click_chart",
        "trigger_popover_drag_axis",
        "stay_silent_user_is_proceeding",
        "escalate_to_interactive_walkthrough",
      ];
    }

    if (snapshot.user_action_pattern === "rapid_tab_switching") {
      return [
        "escalate_to_interactive_walkthrough",
        "trigger_tooltip_click_chart",
        "stay_silent_user_is_proceeding",
      ];
    }

    if (snapshot.user_action_pattern === "form_validation_stuck") {
      return [
        "trigger_tooltip_click_chart",
        "escalate_to_interactive_walkthrough",
        "stay_silent_user_is_proceeding",
      ];
    }

    return [
      "trigger_tooltip_click_chart",
      "stay_silent_user_is_proceeding",
      "escalate_to_interactive_walkthrough",
    ];
  }

  /**
   * Micro-tuned F1 policy threshold filter (Recipe Step 2)
   */
  private applyPolicyThresholds(
    edgeResult: { best_action?: string; confidence?: number; scores?: Record<string, number>; model?: string },
    snapshot: UIContextSnapshot
  ): VegaGuideDirective {
    const bestAction = edgeResult.best_action || "stay_silent_user_is_proceeding";
    const confidence = typeof edgeResult.confidence === "number" ? edgeResult.confidence : 0.5;
    const model = edgeResult.model || "vega-08b-public-intents";

    // 1. Tooltip threshold (>0.65)
    if (
      (bestAction === "trigger_tooltip_click_chart" || bestAction === "trigger_popover_drag_axis") &&
      confidence > 0.65
    ) {
      return {
        action: "SHOW_STEP",
        target_element: snapshot.dom_focus.selector || snapshot.dom_focus.element_id,
        step: (snapshot.completed_steps.length || 0) + 1,
        confidence,
        candidate_label: bestAction,
        model,
        reasoning: `Vega resolved ${bestAction} with confidence ${(confidence * 100).toFixed(1)}%`,
      };
    }

    // 2. Full walkthrough escalation threshold (>0.85)
    if (bestAction === "escalate_to_interactive_walkthrough" && confidence > 0.85) {
      return {
        action: "START_FLOW",
        flow_id: snapshot.active_guide_id || "stuck_remediation_wizard",
        confidence,
        candidate_label: bestAction,
        model,
        reasoning: `User detected in friction loop (${snapshot.user_action_pattern}); escalating to guided flow`,
      };
    }

    // 3. Default: Silent
    return {
      action: "WAIT",
      confidence,
      candidate_label: bestAction,
      model,
      reasoning: "Confidence below action threshold or silent label matched",
    };
  }

  /**
   * Deterministic local fallback if edge server is unavailable (Rule §7 compliant)
   */
  private evaluateLocalFallbackPolicy(
    snapshot: UIContextSnapshot,
    _candidateLabels: string[]
  ): VegaGuideDirective {
    // If user is hovering > 1200ms on a button or interactive target
    if (snapshot.user_action_pattern === "hovering_without_clicking" && snapshot.dom_focus.element_id) {
      return {
        action: "SHOW_STEP",
        target_element: snapshot.dom_focus.selector || snapshot.dom_focus.element_id,
        step: snapshot.completed_steps.length + 1,
        confidence: 0.78,
        candidate_label: "trigger_tooltip_click_chart",
        model: "local-reflex-fallback",
        reasoning: "Local reflex detected element hesitation (>1200ms dwell)",
      };
    }

    // If rapid tab switching / looping
    if (snapshot.user_action_pattern === "rapid_tab_switching") {
      return {
        action: "START_FLOW",
        flow_id: "navigation_recovery_tour",
        confidence: 0.88,
        candidate_label: "escalate_to_interactive_walkthrough",
        model: "local-reflex-fallback",
        reasoning: "Local reflex detected rapid menu oscillation",
      };
    }

    // Default
    return {
      action: "WAIT",
      confidence: 0.95,
      candidate_label: "stay_silent_user_is_proceeding",
      model: "local-reflex-fallback",
      reasoning: "Local reflex: user proceeding normally",
    };
  }

  private dispatchDirective(directive: VegaGuideDirective): void {
    this.lastDirective = directive;
    for (const listener of this.directiveListeners) {
      try {
        listener(directive);
      } catch (err) {
        console.error("[VegaEdgeBridge] Directive listener error:", err);
      }
    }
  }
}

// Global singleton instance
export const vegaEdgeBridge = new VegaEdgeBridge();
