import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Info,
  Plus,
  Trash2,
  Clock,
  Zap,
  Play,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CircleDot,
  ArrowLeftRight,
  Maximize2,
  X,
  ListTodo,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Gemma4Config } from "../main";
import { useChat } from "../hooks/useChat";
import MessageBubble from "./MessageBubble";
import { ChatHeader, WidgetTab } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { EvalsStudio } from "./EvalsStudio";
import { NavigationHub } from "./NavigationHub";
import { WorkflowStudio } from "./WorkflowStudio";
import { workflowStore } from "../lib/workflowStore";
import { WebWorkflow, ModelTier } from "../lib/types";
import { detectSitePersona, SitePersona } from "../lib/sitePersona";
import { WorkflowPredictor, PredictedWorkflowCandidate } from "../lib/workflowPredictor";

import { NavPersistenceManager } from "../lib/navPersistence";
import { CanvasGameController } from "../lib/canvasGameController";
import { SafetyConfirmationCard } from "./SafetyConfirmationCard";
import { ThinkingAccordion } from "./ThinkingAccordion";

export interface ChatWidgetProps {
  config?: Gemma4Config;
}

export default function ChatWidget({ config = {} }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return (config.defaultOpen ?? false) || Boolean(NavPersistenceManager.getPendingTask());
    } catch {
      return config.defaultOpen ?? false;
    }
  });
  const [dockPosition, setDockPosition] = useState<"left" | "right">(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem("eo_dock_position") || window.localStorage.getItem("g4_dock_position");
        if (saved === "left" || saved === "right") return saved;
      }
    } catch {}
    return "right";
  });
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const [isGhostMode, setIsGhostMode] = useState<boolean>(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState("");
  const [showTierMenu, setShowTierMenu] = useState(false);
  const [showNanoHelp, setShowNanoHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<WidgetTab>("chat");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [quickWorkflows, setQuickWorkflows] = useState<WebWorkflow[]>([]);
  const [predictedWorkflows, setPredictedWorkflows] = useState<PredictedWorkflowCandidate[]>([]);
  const [sitePersona, setSitePersona] = useState<SitePersona>(() => detectSitePersona());
  const [showPermissionBanner, setShowPermissionBanner] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return (window.localStorage.getItem("eo_ondevice_model_permission") || window.localStorage.getItem("g4_ondevice_model_permission")) === null;
      }
    } catch {}
    return false;
  });

  // Canvas collision detection: If a canvas exists in the right or center on desktop, auto-dock to left
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("eo_dock_position") || localStorage.getItem("g4_dock_position");
      if (!saved) {
        const canvas = document.querySelector("canvas");
        if (canvas && window.innerWidth >= 800) {
          const rect = canvas.getBoundingClientRect();
          if (rect.right > window.innerWidth - 460) {
            setDockPosition("left");
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Programmatic API events: EdgeOperator.open({ panel: 'workflows' | 'chat' }) / EdgeOperator.close()
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setIsOpen(true);
      if (detail.panel === "workflows") {
        setActiveTab("workflows");
      } else if (detail.panel === "chat") {
        setActiveTab("chat");
      }
    };
    const handleClose = () => {
      setIsOpen(false);
    };

    window.addEventListener("eo:open", handleOpen);
    window.addEventListener("edgeoperator:open", handleOpen);
    window.addEventListener("eo:close", handleClose);
    window.addEventListener("edgeoperator:close", handleClose);

    return () => {
      window.removeEventListener("eo:open", handleOpen);
      window.removeEventListener("edgeoperator:open", handleOpen);
      window.removeEventListener("eo:close", handleClose);
      window.removeEventListener("edgeoperator:close", handleClose);
    };
  }, []);

  const toggleDock = useCallback(() => {
    setDockPosition((prev) => {
      const next = prev === "right" ? "left" : "right";
      try {
        localStorage.setItem("eo_dock_position", next);
        localStorage.setItem("g4_dock_position", next);
      } catch {}
      return next;
    });
  }, []);

  // Unified, deduplicated workflow suggestions list guaranteed to always be available
  const displayWorkflows = React.useMemo(() => {
    const list: Array<{ workflow: WebWorkflow; confidence?: number; isPredicted?: boolean; rationale?: string }> = [];
    const seenNames = new Set<string>();

    // 1. Add Predicted Workflows (highest priority with Vega scoring)
    for (const pred of predictedWorkflows) {
      const clean = pred.workflow.name.toLowerCase().replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").trim();
      if (!seenNames.has(clean)) {
        seenNames.add(clean);
        list.push({
          workflow: pred.workflow,
          confidence: pred.confidence,
          isPredicted: true,
          rationale: pred.rationale,
        });
      }
    }

    // 2. Add Stored / Synthesized Quick Workflows
    for (const wf of quickWorkflows) {
      const clean = wf.name.toLowerCase().replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").trim();
      if (!seenNames.has(clean)) {
        seenNames.add(clean);
        list.push({ workflow: wf, isPredicted: false });
      }
    }

    return list;
  }, [predictedWorkflows, quickWorkflows]);

  useEffect(() => {
    if (isOpen) {
      setSitePersona(detectSitePersona());
    }
  }, [isOpen]);

  const {
    messages,
    isLoading,
    stopGeneration,
    canEscalate,
    sendMessage,
    engineStatus,
    currentTierInfo,
    modelLoadingProgress,
    nanoSupported,
    activeSteps,
    activeThinking,
    setTier,
    triggerEscalation,
    handleFeedback,
    // Evals & Macros
    evalMetrics,
    recentTraces,
    siteMacros,
    isJudging,
    judgeSingleTrace,
    runBatchJudge,
    rateTrace,
    // Session history
    currentSessionId,
    sessionsList,
    createNewSession,
    switchSession,
    deleteSession,
    executeDirectAction,
    runSavedWorkflow,
    executeBatchProposal,
    cancelBatchProposal,
    isRecordingMacro,
    startMacroRecording,
    stopMacroRecording,
    currentPlan,
    approvePlan,
    rejectPlan,
    pendingSafetyConfirmation,
    approveSafetyAction,
    rejectSafetyAction,
  } = useChat(config);

  const loadQuickWorkflows = async () => {
    const list = await workflowStore.getWorkflowsForOrigin();
    setQuickWorkflows(list);
    try {
      const preds = await WorkflowPredictor.predictWorkflows(3);
      setPredictedWorkflows(preds);
    } catch (err) {
      console.warn("[ChatWidget] Error predicting workflows:", err);
    }
  };

  useEffect(() => {
    loadQuickWorkflows();
  }, [isOpen]);

  // OpenHarness Pattern: Watchdog auto-clears stuck in-flight action state after 25s
  useEffect(() => {
    if (!isLoading) return;
    const watchdog = setTimeout(() => {
      console.warn("[ChatWidget] In-flight execution watchdog triggered (25s timeout). Calling stopGeneration.");
      stopGeneration();
    }, 25000);
    return () => clearTimeout(watchdog);
  }, [isLoading, stopGeneration]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBottomChip, setShowScrollBottomChip] = useState(false);
  const workflowsBarRef = useRef<HTMLDivElement>(null);
  const workflowsScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingWfRef = useRef(false);
  const startXWfRef = useRef(0);
  const scrollLeftWfRef = useRef(0);
  const hasMovedWfRef = useRef(false);
  const [canScrollWfLeft, setCanScrollWfLeft] = useState(false);
  const [canScrollWfRight, setCanScrollWfRight] = useState(false);
  const [hasWfOverflow, setHasWfOverflow] = useState(false);

  const updateWfScrollBounds = useCallback(() => {
    const el = workflowsScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const hasOverflow = maxScroll > 4;
    setHasWfOverflow(hasOverflow);
    setCanScrollWfLeft(el.scrollLeft > 2);
    setCanScrollWfRight(el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const el = workflowsScrollRef.current;
    if (!el) return;
    updateWfScrollBounds();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateWfScrollBounds();
      });
      ro.observe(el);
    }

    const onResize = () => updateWfScrollBounds();
    window.addEventListener("resize", onResize);
    const timer = setTimeout(updateWfScrollBounds, 60);

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
      ro?.disconnect();
    };
  }, [quickWorkflows.length, isOpen, updateWfScrollBounds]);

  // Dedicated Workflows Bar Wheel Event Listener: hardware 120fps trackpad physics + mouse wheel horizontal translation
  useEffect(() => {
    const bar = workflowsBarRef.current;
    const track = workflowsScrollRef.current;
    if (!bar || !track || !isOpen) return;

    const handleBarWheel = (e: WheelEvent) => {
      // Isolate wheel events within the workflow bar so messages container never scrolls
      e.stopPropagation();

      // Trackpad horizontal swipe:
      if (Math.abs(e.deltaX) > 0) {
        // If over the track itself, do not preventDefault: let the browser's native GPU compositor scroll at 120fps with full inertia!
        if (track.contains(e.target as Node)) {
          return;
        }
        // If hovering over chevrons, label, or padding, scroll track directly:
        e.preventDefault();
        track.scrollLeft += e.deltaX;
        updateWfScrollBounds();
        return;
      }

      // Vertical mouse wheel or vertical trackpad flick over the horizontal bar:
      if (e.deltaY !== 0) {
        e.preventDefault();
        track.scrollLeft += e.deltaY;
        updateWfScrollBounds();
        return;
      }
    };

    bar.addEventListener("wheel", handleBarWheel, { passive: false });
    return () => {
      bar.removeEventListener("wheel", handleBarWheel);
    };
  }, [quickWorkflows.length, isOpen, updateWfScrollBounds]);

  const handlePointerDownWf = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = workflowsScrollRef.current;
    if (!el) return;
    isDraggingWfRef.current = true;
    startXWfRef.current = e.clientX;
    scrollLeftWfRef.current = el.scrollLeft;
    hasMovedWfRef.current = false;
  };

  const handlePointerMoveWf = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWfRef.current) return;
    const el = workflowsScrollRef.current;
    if (!el) return;
    const dx = e.clientX - startXWfRef.current;
    if (Math.abs(dx) > 5) {
      if (!hasMovedWfRef.current) {
        hasMovedWfRef.current = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
      el.scrollLeft = scrollLeftWfRef.current - dx;
      updateWfScrollBounds();
    }
  };

  const handlePointerUpWf = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingWfRef.current) {
      isDraggingWfRef.current = false;
      try {
        if (workflowsScrollRef.current?.hasPointerCapture(e.pointerId)) {
          workflowsScrollRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {}
      if (hasMovedWfRef.current) {
        setTimeout(() => {
          hasMovedWfRef.current = false;
        }, 80);
      }
    }
  };

  const handlePointerCancelWf = () => {
    isDraggingWfRef.current = false;
    hasMovedWfRef.current = false;
  };

  // Dynamic visualViewport tracking for seamless mobile keyboard docking (Standard 2.2)
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const updateViewport = () => {
      if (window.innerWidth < 640) {
        setViewportHeight(window.visualViewport ? window.visualViewport.height : window.innerHeight);
      } else {
        setViewportHeight(null);
      }
    };
    updateViewport();
    const vv = window.visualViewport;
    vv.addEventListener("resize", updateViewport);
    vv.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      vv.removeEventListener("resize", updateViewport);
      vv.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [isOpen]);

  // Scroll isolation: prevent wheel & touch gestures from escaping to host page without breaking native momentum
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !isOpen) return;

    // Stop wheel events from bubbling up to window (where Lenis smooth scroller or window listeners reside)
    const handleCardWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    const handleCardTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
    };

    el.addEventListener("wheel", handleCardWheel, { passive: true });
    el.addEventListener("touchmove", handleCardTouchMove, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleCardWheel);
      el.removeEventListener("touchmove", handleCardTouchMove);
    };
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 72;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setShowScrollBottomChip(false);
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (!messagesEndRef.current) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current.scrollIntoView({
      behavior: smooth && !prefersReducedMotion ? "smooth" : "auto",
    });
    setIsNearBottom(true);
    setShowScrollBottomChip(false);
  };

  // Standard 2.3: Stream to newest message ONLY when already at bottom.
  // If user scrolled up, do not yank down; show "New message ↓" chip instead.
  // When messages are empty, preserve top position so hero workflows are fully visible.
  useEffect(() => {
    if (messages.length === 0) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = 0;
      }
      return;
    }
    if (isNearBottom) {
      scrollToBottom(true);
    } else {
      setShowScrollBottomChip(true);
    }
  }, [messages, activeSteps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const isReady = engineStatus === "ready";

  return (
    <div
      data-eo-widget="true"
      data-g4-widget="true"
      className={`eo-widget-container g4-widget-container fixed z-[2147483647] pointer-events-auto transition-all ${
        isOpen
          ? isCompactMode
            ? dockPosition === "left"
              ? "bottom-4 left-4 sm:bottom-6 sm:left-6 flex flex-col items-start"
              : "bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col items-end"
            : dockPosition === "left"
            ? "eo-is-open g4-is-open bottom-0 left-0 right-0 sm:inset-auto sm:bottom-6 sm:left-6 flex flex-col items-start"
            : "eo-is-open g4-is-open bottom-0 left-0 right-0 sm:inset-auto sm:bottom-6 sm:right-6 flex flex-col items-end"
          : dockPosition === "left"
          ? "bottom-4 left-4 sm:bottom-6 sm:left-6 flex flex-col items-start"
          : "bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col items-end"
      }`}
    >
      {/* Picture-in-Picture Mini HUD (Compact mode for games & canvas apps) */}
      {isOpen && isCompactMode && (
        <div
          className="w-[calc(100vw-32px)] max-w-[360px] h-[52px] g4-window-card rounded-[12px] shadow-2xl px-3 flex items-center justify-between text-xs text-white overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 select-none border border-white/10"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-white text-[12px] truncate leading-tight">
                {isLoading ? "⚡ EdgeOperator Executing..." : "🏀 EdgeOperator Active"}
              </span>
              <span className="text-[10px] text-gray-400 truncate leading-tight">
                {currentTierInfo.name} · Game & Canvas Visible
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleDock}
              className="text-gray-400 hover:text-white w-7 h-7 rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title={dockPosition === "left" ? "Dock Right" : "Dock Left"}
              aria-label="Switch Dock Position"
            >
              <ArrowLeftRight size={13} />
            </button>
            <button
              onClick={() => setIsCompactMode(false)}
              className="text-gray-400 hover:text-white w-7 h-7 rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title="Expand Full Chat"
              aria-label="Expand Full Chat"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white w-7 h-7 rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title="Close Assistant"
              aria-label="Close Assistant"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Expanded Chat & Evals Window */}
      {isOpen && !isCompactMode && (
        <div
          ref={cardRef}
          style={
            viewportHeight && !isMobileExpanded
              ? { height: `${Math.min(viewportHeight * 0.75, 650)}px`, maxHeight: `${viewportHeight}px` }
              : undefined
          }
          className={`w-full ${
            isMobileExpanded ? "h-[92dvh] max-h-[92dvh]" : "h-[75dvh] max-h-[85dvh]"
          } sm:w-[440px] sm:h-[650px] sm:max-h-[88vh] sm:max-w-[calc(100vw-32px)] g4-window-card rounded-t-[14px] sm:rounded-[8px] shadow-2xl flex flex-col sm:mb-3 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 overscroll-contain relative ${
            isGhostMode ? "opacity-35 hover:opacity-100 transition-opacity duration-300" : ""
          }`}
        >
          {/* Header */}
          <ChatHeader
            currentTierInfo={currentTierInfo}
            activeTab={activeTab}
            recentTracesCount={recentTraces.length}
            sessionsCount={sessionsList.length}
            canEscalate={canEscalate}
            showTierMenu={showTierMenu}
            dockPosition={dockPosition}
            isGhostMode={isGhostMode}
            isMobileExpanded={isMobileExpanded}
            onToggleTierMenu={() => setShowTierMenu(!showTierMenu)}
            onSelectTier={(tier) => {
              setTier(tier);
              setShowTierMenu(false);
            }}
            onEscalate={triggerEscalation}
            onClose={() => setIsOpen(false)}
            onTabChange={(tab) => setActiveTab(tab)}
            isRecordingMacro={isRecordingMacro}
            onStartMacroRecording={startMacroRecording}
            onStopMacroRecording={stopMacroRecording}
            onToggleDock={toggleDock}
            onToggleCompact={() => setIsCompactMode(true)}
            onToggleGhost={() => setIsGhostMode(!isGhostMode)}
            onToggleMobileExpand={() => setIsMobileExpanded(!isMobileExpanded)}
          />

          {/* Heavy Model Download Progress Banner (in normal document flow, 0 overlap) */}
          {modelLoadingProgress?.active && (
            <div className="bg-[#0b1022] border-b border-indigo-500/40 p-2.5 text-xs text-indigo-200 flex flex-col gap-1.5 animate-in fade-in duration-150 select-none shrink-0 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium min-w-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                  <span className="text-white font-semibold truncate">
                    Downloading {modelLoadingProgress.modelName}
                  </span>
                  <span className="text-[11px] text-indigo-300/80 font-mono shrink-0">
                    ({modelLoadingProgress.size})
                  </span>
                </div>
                <span className="font-mono text-indigo-300 font-bold shrink-0 ml-2">
                  {Math.min(100, Math.max(0, Math.round(modelLoadingProgress.percent)))}%
                </span>
              </div>
              <div className="w-full bg-gray-900/90 rounded-full h-1.5 overflow-hidden border border-white/10">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${Math.max(4, Math.min(100, modelLoadingProgress.percent))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span className="truncate">{modelLoadingProgress.text}</span>
                <span className="shrink-0 text-gray-500 ml-2">Persistent Cache</span>
              </div>
            </div>
          )}

          {/* Tab 1: Agent Chat */}
          {activeTab === "chat" && (
            <>

              {/* Nano Help Banner (if Chrome AI unavailable) */}
              {!nanoSupported && showNanoHelp && (
                <div className="bg-amber-950/70 border-b border-amber-800/50 p-2.5 text-[11px] text-amber-200 flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-semibold flex items-center gap-1 text-amber-300">
                      <Info size={12} />
                      <span>Running on Client-Side Fallback Engine</span>
                    </div>
                    <p className="text-amber-200/80 leading-tight">
                      To run with 0 MB download on Chrome Gemini Nano, enable flags at{" "}
                      <code className="bg-black/40 px-1 rounded text-[10px]">
                        chrome://flags/#prompt-api-for-gemini-nano
                      </code>
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNanoHelp(false)}
                    className="text-amber-400 hover:text-white text-xs cursor-pointer p-0.5"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Messages Area */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="g4-messages-container text-xs overscroll-contain relative"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col gap-3 py-3 px-1 text-left select-none">
                    {/* Page context pill with site category badge */}
                    <div className="flex items-center justify-between text-[12px] text-gray-400 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-gray-200 font-semibold">Active on</span>
                        <span className="text-purple-300 truncate max-w-[150px] font-mono text-[11px]">
                          {sitePersona.domain}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/20 font-medium">
                          {sitePersona.categoryLabel}
                        </span>
                      </div>
                    </div>

                    {/* Feature Card: Autonomous Workflow Engine & One-Time Setup */}
                    {showPermissionBanner && (
                      <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-gray-200 flex items-center justify-between gap-2.5 animate-in fade-in">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-[#D4FF00] shrink-0" />
                          <span className="text-[11px] text-gray-200 truncate">
                            Enable 1-click on-device workflow engine (0 cloud tokens)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={async () => {
                              try {
                                localStorage.setItem("eo_ondevice_model_permission", "granted");
                                localStorage.setItem("g4_ondevice_model_permission", "granted");
                              } catch {}
                              setShowPermissionBanner(false);
                              setTier(ModelTier.TIER_1_MINILM_ROUTER);
                              await loadQuickWorkflows();
                            }}
                            className="px-2.5 py-1 rounded-md bg-[#D4FF00] text-black font-extrabold text-[10px] cursor-pointer shadow-sm active:scale-95"
                          >
                            Enable
                          </button>
                          <button
                            onClick={() => {
                              try {
                                localStorage.setItem("eo_ondevice_model_permission", "declined");
                                localStorage.setItem("g4_ondevice_model_permission", "declined");
                              } catch {}
                              setShowPermissionBanner(false);
                            }}
                            className="text-[10px] text-gray-400 hover:text-white px-1.5 py-1 cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PROMINENT WORKFLOW SUGGESTIONS - UNMISSABLE NEO-BRUTALIST HERO SHOWCASE */}
                    <div className="mt-1 flex flex-col gap-3">
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <h2 className="text-[20px] font-black text-white tracking-tight leading-tight">
                            What do you want to automate <span className="text-[#C084FC] font-serif italic underline decoration-wavy decoration-[#D4FF00]">today?</span>
                          </h2>
                          <p className="text-[11.5px] text-gray-300 mt-0.5 font-normal">
                            1-click on-device browser routines physically discovered on this page.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-[#D4FF00] text-black shadow-sm uppercase tracking-wider">
                            {displayWorkflows.length} ready
                          </span>
                        </div>
                      </div>

                      {/* Prominent Tactile Workflow Cards Deck */}
                      <div className="grid grid-cols-1 gap-2.5">
                        {displayWorkflows.length === 0 ? (
                          <div className="p-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] text-center flex flex-col items-center gap-2">
                            <div className="w-9 h-9 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                              <Sparkles size={16} />
                            </div>
                            <div className="text-[13px] font-bold text-white">
                              No Pre-built Workflows for This View
                            </div>
                            <p className="text-[11px] text-gray-300 max-w-[280px]">
                              Record any custom workflow in seconds, or use Teach 1 → Batch N to automate tasks on this page.
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => startMacroRecording()}
                                className="px-3 py-1.5 rounded-xl neo-btn-lime-hero flex items-center gap-1 cursor-pointer transition-all active:scale-95 text-[11px]"
                              >
                                <CircleDot size={11} className="stroke-[3]" />
                                <span>Teach 1 → Batch N</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveTab("workflows")}
                                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-[11px] border border-white/15 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Plus size={11} />
                                <span>Create Custom</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          displayWorkflows.map((item, idx) => {
                            // Cycle through high-energy tactile theme cards
                            const themeIndex = idx % 4;
                            const cardClass = [
                              "neo-card-lime",
                              "neo-card-white",
                              "neo-card-purple",
                              "neo-card-pink"
                            ][themeIndex];
                            const isDark = themeIndex === 2 || themeIndex === 3;

                            return (
                              <div
                                key={item.workflow.id}
                                onClick={() => runSavedWorkflow(item.workflow)}
                                className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer group active:translate-x-[1px] active:translate-y-[1px] select-none ${cardClass}`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <Zap size={16} className={themeIndex === 0 ? "fill-[#D4FF00] text-[#D4FF00]" : "fill-white text-white"} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-[13.5px] font-black tracking-tight leading-snug truncate ${isDark ? "text-white" : "text-black"}`}>
                                        {item.workflow.name}
                                      </span>
                                      {item.isPredicted && (
                                        <span className="text-[9px] font-black font-mono px-1.5 py-0.2 rounded-full bg-black text-[#D4FF00] uppercase tracking-wider shrink-0">
                                          Verified
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-[11px] truncate max-w-[210px] sm:max-w-[250px] font-medium mt-0.5 ${isDark ? "text-white/80" : "text-black/75"}`}>
                                      {item.workflow.description}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full ${isDark ? "bg-white/20 text-white" : "bg-black/10 text-black"}`}>
                                    {item.workflow.steps.length} {item.workflow.steps.length === 1 ? "step" : "steps"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      runSavedWorkflow(item.workflow);
                                    }}
                                    className={isDark ? "neo-btn-run-light" : "neo-btn-run"}
                                    title="Run Routine"
                                  >
                                    <Play size={10} className="fill-current" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Sub-actions Row */}
                      <div className="flex items-center justify-between pt-1 px-0.5">
                        <button
                          type="button"
                          onClick={() => startMacroRecording()}
                          className="text-[11px] text-gray-300 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                          title="Teach 1 item, batch replay across N items"
                        >
                          <CircleDot size={12} className="text-[#D4FF00]" />
                          <span>Teach 1 → Batch N</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("workflows")}
                          className="text-[11px] text-[#D4FF00] hover:text-white flex items-center gap-1 font-bold cursor-pointer transition-colors"
                        >
                          <span>Open Studio →</span>
                        </button>
                      </div>
                    </div>

                    {/* Conversational Action Chips */}
                    <div className="pt-2">
                      <div className="text-[11px] text-gray-400 font-medium mb-1.5">Or ask a question:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {sitePersona.primaryActionPills.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => {
                              setInputValue(chip);
                              sendMessage(chip);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-purple-600/20 hover:border-purple-500/50 text-[11px] text-gray-300 hover:text-white transition-all cursor-pointer text-left flex items-center gap-1 shadow-sm active:scale-98"
                          >
                            <span>{chip}</span>
                            <ArrowRight size={10} className="text-gray-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      onFeedback={handleFeedback}
                      onEscalate={triggerEscalation}
                      onSelectOption={(optionLabel) => sendMessage(optionLabel)}
                      onExecuteAction={(actionName, payload) => {
                        if (actionName === "stop_game") {
                          CanvasGameController.stop();
                        } else if (actionName === "run_workflow" && payload?.workflowId) {
                          runSavedWorkflow(payload.workflowId as string);
                        } else {
                          executeDirectAction(actionName, payload);
                        }
                      }}
                      onApproveBatch={executeBatchProposal}
                      onCancelBatch={cancelBatchProposal}
                      onSaveToWorkflow={async (title, action, target) => {
                        const newWf: WebWorkflow = {
                          id: `wf_${Date.now()}`,
                          name: `⚡ ${title}`,
                          description: `Repeat ${action} on ${target || "element"}`,
                          siteOrigin: "*",
                          steps: [{ id: "s1", title, action: (action as any) || "teleport", target, delayMs: 300, status: "idle" }],
                          executionCount: 0,
                          createdAt: Date.now(),
                        };
                        await workflowStore.saveWorkflow(newWf);
                        await loadQuickWorkflows();
                        setActiveTab("workflows");
                      }}
                    />
                  ))
                )}

                {/* Harness-Held Task Checklist (TASK-116) */}
                {currentPlan && currentPlan.tasks.length > 0 && (
                  <div className="mb-2 p-2.5 rounded-lg bg-black/60 border border-purple-500/30 backdrop-blur-md shadow-lg text-[11px] font-sans">
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/10">
                      <div className="flex items-center gap-1.5 text-purple-300 font-semibold truncate">
                        <ListTodo size={13} className="text-purple-400 shrink-0" />
                        <span className="truncate">Plan: {currentPlan.goal}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono shrink-0">
                        {currentPlan.tasks.filter((t) => t.status === "completed").length}/{currentPlan.tasks.length}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {currentPlan.tasks.map((task, idx) => (
                        <div key={task.id} className="flex items-center gap-2 text-gray-300">
                          {task.status === "completed" ? (
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          ) : task.status === "in_progress" ? (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                          ) : task.status === "blocked" ? (
                            <AlertCircle size={13} className="text-red-400 shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full border border-gray-500 shrink-0" />
                          )}
                          <span
                            className={`truncate ${
                              task.status === "completed"
                                ? "line-through text-gray-500"
                                : task.status === "in_progress"
                                ? "text-cyan-200 font-medium"
                                : ""
                            }`}
                          >
                            {idx + 1}. {task.title}
                          </span>
                          {task.note && (
                            <span className="text-[9px] text-gray-500 italic truncate max-w-[120px]">
                              ({task.note})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {!currentPlan.approved && (
                      <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-300 font-medium">User plan approval required</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={approvePlan}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium transition-all cursor-pointer"
                          >
                            Approve & Run
                          </button>
                          <button
                            type="button"
                            onClick={rejectPlan}
                            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 text-[10px] font-medium transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* In-Flight Streaming & Steps Indicator */}
                {isLoading && (
                  <div className="flex items-center justify-between gap-2 py-1 select-none w-full">
                    <ThinkingAccordion
                      plan={currentPlan}
                      stepTrace={activeSteps}
                      thinking={activeThinking}
                      isLive={true}
                    />
                    <button
                      type="button"
                      onClick={() => stopGeneration()}
                      className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 cursor-pointer transition-all active:scale-95 shrink-0"
                      title="Stop in-flight execution"
                      aria-label="Stop in-flight execution"
                    >
                      Stop
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Standard Section 2.3: Floating "New message ↓" chip when user has scrolled up */}
              {showScrollBottomChip && (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-purple-600/95 hover:bg-purple-500 text-white text-[12px] font-medium shadow-xl flex items-center gap-1.5 backdrop-blur-md border border-white/20 transition-all cursor-pointer animate-in fade-in"
                  aria-label="Scroll to new messages"
                >
                  <span>New message</span>
                  <span>↓</span>
                </button>
              )}

              {/* Neo-Brutalist Tactile Workflows Carousel with Human Ergonomics */}
              {quickWorkflows.length > 0 && (
                <div
                  ref={workflowsBarRef}
                  className="px-3 pt-2.5 pb-2 bg-[#090d18] border-t border-white/10 shrink-0 select-none space-y-1.5"
                >
                  {/* Clean Header Bar */}
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#D4FF00] text-black shadow-sm">
                        <Zap size={10} className="fill-black stroke-black" />
                      </span>
                      <span className="text-[11px] font-black tracking-wider uppercase text-white">
                        Quick Routines
                      </span>
                      <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-gray-300">
                        {quickWorkflows.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasWfOverflow && (
                        <div className="flex items-center gap-1 mr-1">
                          <button
                            type="button"
                            disabled={!canScrollWfLeft}
                            onClick={() => {
                              workflowsScrollRef.current?.scrollBy({ left: -160, behavior: "smooth" });
                            }}
                            className={`w-5 h-5 rounded-md bg-white/10 text-white flex items-center justify-center transition-all ${
                              !canScrollWfLeft ? "opacity-20 cursor-default" : "opacity-80 hover:opacity-100 hover:bg-white/20 cursor-pointer active:scale-90"
                            }`}
                            aria-label="Previous workflows"
                          >
                            <ChevronLeft size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={!canScrollWfRight}
                            onClick={() => {
                              workflowsScrollRef.current?.scrollBy({ left: 160, behavior: "smooth" });
                            }}
                            className={`w-5 h-5 rounded-md bg-white/10 text-white flex items-center justify-center transition-all ${
                              !canScrollWfRight ? "opacity-20 cursor-default" : "opacity-80 hover:opacity-100 hover:bg-white/20 cursor-pointer active:scale-90"
                            }`}
                            aria-label="Next workflows"
                          >
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (hasMovedWfRef.current) return;
                          setActiveTab("workflows");
                        }}
                        className="text-[10px] font-black text-[#D4FF00] hover:text-white flex items-center gap-0.5 cursor-pointer uppercase tracking-wider transition-colors"
                        title="Open Workflows Studio"
                      >
                        <Plus size={11} className="stroke-[3]" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Tactile Cards Carousel */}
                  <div
                    ref={workflowsScrollRef}
                    onScroll={updateWfScrollBounds}
                    onPointerDown={handlePointerDownWf}
                    onPointerMove={handlePointerMoveWf}
                    onPointerUp={handlePointerUpWf}
                    onPointerCancel={handlePointerCancelWf}
                    className="flex items-center gap-2 overflow-x-auto no-scrollbar g4-workflows-scroll cursor-grab active:cursor-grabbing select-none py-1 px-0.5"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {quickWorkflows.map((wf, idx) => {
                      // Cycle through vibrant neo-brutalist theme palettes
                      const themeIndex = idx % 4;
                      const pillClass = [
                        "neo-pill-lime",
                        "neo-pill-white",
                        "neo-pill-purple",
                        "neo-pill-pink",
                      ][themeIndex];

                      const isLight = themeIndex === 0 || themeIndex === 1;

                      return (
                        <button
                          key={wf.id}
                          type="button"
                          onClick={() => {
                            if (hasMovedWfRef.current) return;
                            runSavedWorkflow(wf);
                          }}
                          className={`h-[40px] rounded-xl flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${pillClass}`}
                          title={wf.description}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            isLight ? "bg-black text-white" : "bg-white text-black"
                          }`}>
                            <Play size={8} className="fill-current ml-0.5" />
                          </span>
                          <span className="font-extrabold text-[12px] truncate max-w-[150px] tracking-tight">
                            {wf.name}
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                            isLight ? "bg-black/15 text-black" : "bg-white/20 text-white"
                          }`}>
                            {wf.steps.length} {wf.steps.length === 1 ? "step" : "steps"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Safety Gate Confirmation Dialog (TASK-112 / TASK-117) */}
              {pendingSafetyConfirmation && (
                <SafetyConfirmationCard
                  classification={pendingSafetyConfirmation.classification}
                  onApprove={approveSafetyAction}
                  onReject={rejectSafetyAction}
                />
              )}

              {/* Anchor Composer */}
              <ChatInput
                inputValue={inputValue}
                isReady={isReady}
                isLoading={isLoading}
                currentTierInfo={currentTierInfo}
                onInputChange={setInputValue}
                onSubmit={handleSubmit}
                onStop={stopGeneration}
              />
            </>
          )}

          {/* Tab 2: AI Website Navigation & Engram Hub */}
          {activeTab === "navigator" && (
            <NavigationHub
              onNavigateToChatWithPrompt={(prompt) => {
                setActiveTab("chat");
                sendMessage(prompt);
              }}
            />
          )}

          {/* Tab 3: Chrome AI Expert Judge & Evals Studio */}
          {activeTab === "evals" && (
            <EvalsStudio
              evalMetrics={evalMetrics}
              recentTraces={recentTraces}
              siteMacros={siteMacros}
              isJudging={isJudging}
              expandedTraceId={expandedTraceId}
              showGuide={showGuide}
              onToggleGuide={() => setShowGuide(!showGuide)}
              onRunBatchJudge={runBatchJudge}
              onJudgeSingleTrace={judgeSingleTrace}
              onRateTrace={rateTrace}
              onToggleExpandTrace={(id) =>
                setExpandedTraceId(expandedTraceId === id ? null : id)
              }
            />
          )}

          {/* Tab 3: Persistent Session History */}
          {activeTab === "history" && (
            <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-black/20 text-xs overscroll-contain touch-pan-y">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                <div>
                  <h4 className="font-semibold text-white text-sm">Session History</h4>
                  <p className="text-[10px] text-gray-400">On-device IndexedDB conversation archives</p>
                </div>
                <button
                  onClick={() => {
                    createNewSession();
                    setActiveTab("chat");
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 cursor-pointer text-xs shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
                >
                  <Plus size={13} />
                  <span>New Chat</span>
                </button>
              </div>

              {sessionsList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
                  <Clock size={28} className="text-gray-500 opacity-60" />
                  <p className="text-xs">No saved chat sessions yet.</p>
                  <p className="text-[10px] text-gray-500">Conversations are automatically archived here after each prompt.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessionsList.map((s) => {
                    const isCurrent = s.id === currentSessionId;
                    const dateStr = new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={s.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-indigo-950/40 border-indigo-500/40 text-white"
                            : "bg-white/5 border-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                        onClick={() => {
                          switchSession(s.id);
                          setActiveTab("chat");
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs truncate flex items-center gap-1.5">
                            {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                            <span>{s.title}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                            <span>{s.messages?.length || 0} messages</span>
                            <span>•</span>
                            <span>{dateStr}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(s.id);
                          }}
                          className="text-gray-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Workflows & Automations Studio */}
          {activeTab === "workflows" && (
            <WorkflowStudio
              onBackToChat={() => setActiveTab("chat")}
              onWorkflowExecuted={loadQuickWorkflows}
            />
          )}
        </div>
      )}

      {/* Floating Toggle Button (when closed) */}
      {!isOpen && (
        <button
          id="g4-floating-launcher"
          data-eo-launcher="true"
          onClick={() => {
            setIsOpen(true);
            setIsCompactMode(false);
          }}
          className="eo-launcher-button g4-launcher-button relative group text-white rounded-[8px] flex items-center gap-2 cursor-pointer"
          title="Open EdgeOperator"
        >
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            <Sparkles size={15} />
          </div>
          <span className="font-semibold text-xs pr-1 tracking-tight">EdgeOperator</span>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0b0f19] shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
        </button>
      )}
    </div>
  );
}
