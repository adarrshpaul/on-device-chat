/**
 * Vega System One Ambient UI Guide Overlay
 * 
 * Renders zero-latency real-time guidance directly in the viewport:
 * - Subscribes to VegaEdgeBridge directives (<50ms feedback cycle).
 * - Highlights target interactive elements with tactile neo-brutalist neon accents.
 * - Displays floating directional tooltips pointing at active coordinate boundaries.
 * - Auto-dismisses when action completes or user proceeds normally.
 */

import React, { useEffect, useState, useRef } from "react";
import { vegaEdgeBridge, VegaGuideDirective } from "../lib/vegaEdgeBridge";
import { telemetryTracker } from "../lib/telemetryTracker";
import { Zap, X, ArrowUpRight, Play } from "lucide-react";

interface OverlayPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  arrowPosition: "top" | "bottom" | "left" | "right";
}

interface VegaGuideOverlayProps {
  enabled?: boolean;
  onStartFlow?: (flowId: string) => void;
}

export const VegaGuideOverlay: React.FC<VegaGuideOverlayProps> = ({
  enabled = true,
  onStartFlow,
}) => {
  const [activeDirective, setActiveDirective] = useState<VegaGuideDirective | null>(null);
  const [targetRect, setTargetRect] = useState<OverlayPosition | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const targetElementRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!enabled) {
      setActiveDirective(null);
      setTargetRect(null);
      return;
    }

    // Start edge bridge listener
    vegaEdgeBridge.start();

    const unsubscribe = vegaEdgeBridge.onDirective((directive) => {
      if (directive.action === "WAIT") {
        setActiveDirective(null);
        setTargetRect(null);
        setIsDismissed(false);
        clearHighlight();
        return;
      }

      if (directive.action === "SHOW_STEP" && directive.target_element) {
        setIsDismissed(false);
        setActiveDirective(directive);
        locateAndHighlightTarget(directive.target_element);
      } else if (directive.action === "START_FLOW") {
        setActiveDirective(directive);
        setTargetRect(null);
      }
    });

    return () => {
      unsubscribe();
      clearHighlight();
    };
  }, [enabled]);

  // Recalculate target position on scroll/resize
  useEffect(() => {
    const handleReposition = () => {
      if (activeDirective?.target_element) {
        locateAndHighlightTarget(activeDirective.target_element, false);
      }
    };

    window.addEventListener("scroll", handleReposition, { passive: true });
    window.addEventListener("resize", handleReposition, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [activeDirective]);

  const clearHighlight = () => {
    if (targetElementRef.current) {
      targetElementRef.current.classList.remove("vega-highlight-target");
      targetElementRef.current = null;
    }
  };

  const locateAndHighlightTarget = (selector: string, applyClass: boolean = true) => {
    try {
      let el: Element | null = null;
      if (selector.startsWith("#") || selector.startsWith(".")) {
        el = document.querySelector(selector);
      } else {
        el = document.getElementById(selector) || document.querySelector(`[data-testid="${selector}"]`) || document.querySelector(selector);
      }

      if (!el) {
        setTargetRect(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setTargetRect(null);
        return;
      }

      if (applyClass) {
        clearHighlight();
        el.classList.add("vega-highlight-target");
        targetElementRef.current = el;
      }

      // Determine tooltip placement based on screen clearance
      let arrow: "top" | "bottom" | "left" | "right" = "top";
      let top = rect.bottom + 12;
      let left = Math.max(16, rect.left + rect.width / 2 - 140);

      // If too close to bottom, show above
      if (top + 120 > window.innerHeight && rect.top > 120) {
        top = Math.max(16, rect.top - 110);
        arrow = "bottom";
      }

      setTargetRect({
        top: top + window.scrollY,
        left: Math.min(left + window.scrollX, window.innerWidth - 300),
        width: rect.width,
        height: rect.height,
        arrowPosition: arrow,
      });
    } catch {
      setTargetRect(null);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    clearHighlight();
  };

  const handleActionClick = () => {
    if (activeDirective?.action === "SHOW_STEP" && targetElementRef.current) {
      (targetElementRef.current as HTMLElement).click?.();
      telemetryTracker.markStepCompleted(`step_${activeDirective.step || 1}`);
      handleDismiss();
    } else if (activeDirective?.action === "START_FLOW" && onStartFlow) {
      onStartFlow(activeDirective.flow_id || "stuck_remediation_wizard");
      handleDismiss();
    }
  };

  if (!enabled || isDismissed || !activeDirective) {
    return null;
  }

  // 1. Full Walkthrough Escalation Banner
  if (activeDirective.action === "START_FLOW") {
    return (
      <aside
        aria-label="Vega Interactive Guide Escalation"
        className="fixed bottom-24 right-6 z-[99999] max-w-sm rounded-xl border border-[#D4FF00]/40 bg-[#0c1222]/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D4FF00]/10 text-[#D4FF00] border border-[#D4FF00]/30">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4FF00] font-bold">
                Vega System 1 Assist
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {(activeDirective.confidence * 100).toFixed(0)}% conf
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-200">
              {activeDirective.reasoning || "It looks like you might be stuck. Would you like an interactive walkthrough?"}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-zinc-400 hover:text-white transition-colors"
            title="Dismiss guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={handleDismiss}
            className="rounded px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
          >
            Not now
          </button>
          <button
            onClick={handleActionClick}
            className="flex items-center gap-1.5 rounded-lg bg-[#D4FF00] px-3 py-1.5 text-xs font-bold text-black shadow-md hover:brightness-110 active:scale-95 transition-all"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Start Guided Tour
          </button>
        </div>
      </aside>
    );
  }

  // 2. Real-time Floating Tooltip Step
  if (activeDirective.action === "SHOW_STEP" && targetRect) {
    const isNeural = activeDirective.model.includes("vega-08b");

    return (
      <aside
        aria-label="Vega Real-Time Step Guidance"
        style={{
          position: "absolute",
          top: `${targetRect.top}px`,
          left: `${targetRect.left}px`,
        }}
        className="z-[99999] w-72 rounded-xl border border-[#D4FF00] bg-[#0c1222]/95 p-3.5 shadow-[0_0_30px_rgba(212,255,0,0.25)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D4FF00] text-[11px] font-extrabold text-black">
              {activeDirective.step || 1}
            </span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-200">
              Next Action
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                isNeural
                  ? "border-cyan-500/40 text-cyan-400 bg-cyan-950/40"
                  : "border-amber-500/40 text-amber-400 bg-amber-950/40"
              }`}
            >
              {isNeural ? "⚡ Vega Edge" : "⏱️ Local Reflex"}
            </span>
            <button
              onClick={handleDismiss}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Dismiss tooltip"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-zinc-200 leading-relaxed font-sans">
          Click the highlighted element to continue your flow.
        </p>

        <div className="mt-2.5 flex items-center justify-between pt-1">
          <span className="text-[10px] text-zinc-400 font-mono">
            {activeDirective.target_element}
          </span>
          <button
            onClick={handleActionClick}
            className="inline-flex items-center gap-1 rounded bg-[#D4FF00] px-2.5 py-1 text-[11px] font-bold text-black hover:brightness-110 active:scale-95 transition-all"
          >
            <span>Execute</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </aside>
    );
  }

  return null;
};
