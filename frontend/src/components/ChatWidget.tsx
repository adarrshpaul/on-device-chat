import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Info, Plus, Trash2, Clock } from "lucide-react";
import { Gemma4Config } from "../main";
import { useChat } from "../hooks/useChat";
import MessageBubble from "./MessageBubble";
import { ChatHeader, WidgetTab } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { EvalsStudio } from "./EvalsStudio";
import { NavigationHub } from "./NavigationHub";

export interface ChatWidgetProps {
  config?: Gemma4Config;
}

export default function ChatWidget({ config = {} }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(config.defaultOpen ?? false);
  const [inputValue, setInputValue] = useState("");
  const [showTierMenu, setShowTierMenu] = useState(false);
  const [showNanoHelp, setShowNanoHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<WidgetTab>("chat");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

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
  } = useChat(config);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBottomChip, setShowScrollBottomChip] = useState(false);

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

  // Complete scroll isolation: stops mouse wheel & touch gestures from bleeding through to host page
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !isOpen) return;

    // Lock body scroll on mobile while open so host page behind modal cannot scroll
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    let prevBodyOverflow = "";
    if (isMobile) {
      prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    const findScrollContainer = (target: HTMLElement | null): HTMLElement | null => {
      let current = target;
      while (current && current !== el) {
        if (current.scrollHeight > current.clientHeight) {
          const cls = current.className || "";
          if (
            typeof cls === "string" &&
            (cls.includes("overflow-y-auto") ||
              cls.includes("overflow-y-scroll") ||
              cls.includes("g4-messages-container") ||
              cls.includes("sessions-list"))
          ) {
            return current;
          }
        }
        current = current.parentElement;
      }
      return el.querySelector<HTMLElement>(
        ".g4-messages-container, .overflow-y-auto, [class*='overflow-y-auto']"
      );
    };

    const handleWheel = (e: WheelEvent) => {
      // Prevent wheel event from escaping to host window
      e.preventDefault();
      e.stopPropagation();

      const scrollable = findScrollContainer(e.target as HTMLElement | null);
      if (scrollable) {
        const { scrollTop, scrollHeight, clientHeight } = scrollable;
        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll > 0) {
          scrollable.scrollTop = Math.max(0, Math.min(maxScroll, scrollTop + e.deltaY));
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // If user is dragging on non-scrollable chrome (header/footer), block background pull/bounce
      const scrollable = findScrollContainer(e.target as HTMLElement | null);
      if (!scrollable) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      if (isMobile) {
        document.body.style.overflow = prevBodyOverflow;
      }
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchmove", handleTouchMove);
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
  useEffect(() => {
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
      data-g4-widget="true"
      className={`g4-widget-container fixed z-[999999] pointer-events-auto transition-all ${
        isOpen
          ? "g4-is-open inset-0 sm:inset-auto sm:bottom-6 sm:right-6 flex flex-col items-end"
          : "bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col items-end"
      }`}
    >
      {/* Expanded Chat & Evals Window */}
      {isOpen && (
        <div
          ref={cardRef}
          style={viewportHeight ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` } : undefined}
          className="w-full h-[100dvh] max-h-[100dvh] sm:w-[440px] sm:h-[650px] sm:max-h-[88vh] sm:max-w-[calc(100vw-32px)] g4-window-card rounded-none sm:rounded-[8px] shadow-2xl flex flex-col sm:mb-3 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 overscroll-contain relative"
        >
          {/* Header */}
          <ChatHeader
            currentTierInfo={currentTierInfo}
            activeTab={activeTab}
            recentTracesCount={recentTraces.length}
            sessionsCount={sessionsList.length}
            canEscalate={canEscalate}
            showTierMenu={showTierMenu}
            loadingProgress={modelLoadingProgress}
            onToggleTierMenu={() => setShowTierMenu(!showTierMenu)}
            onSelectTier={(tier) => {
              setTier(tier);
              setShowTierMenu(false);
            }}
            onEscalate={triggerEscalation}
            onClose={() => setIsOpen(false)}
            onTabChange={(tab) => setActiveTab(tab)}
          />

          {/* Tab 1: Agent Chat */}
          {activeTab === "chat" && (
            <>
              {/* Heavy Model Download Progress Banner */}
              {modelLoadingProgress?.active && (
                <div className="bg-[#0b1022] border-b border-indigo-500/40 p-3 text-xs text-indigo-200 flex flex-col gap-1.5 animate-in fade-in duration-150 select-none">
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
                      {Math.round(modelLoadingProgress.percent)}%
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
                  <div className="flex flex-col gap-3 py-4 px-1 text-left select-none">
                    {/* Page context pill */}
                    <div className="flex items-center gap-2 text-[12px] text-gray-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-gray-200 font-semibold">Ready on</span>
                      <span className="text-purple-300 truncate max-w-[240px] font-mono text-[11px]">
                        {typeof window !== "undefined"
                          ? (window.location.hostname + (window.location.pathname !== "/" ? window.location.pathname : "")).replace(/^www\./, "")
                          : "current page"}
                      </span>
                    </div>

                    {/* Standard Section 5 & 7: Capability in one sentence */}
                    <p className="text-[14px] text-gray-200 leading-relaxed font-normal">
                      I can navigate this site, summarize pages, explain code, and trigger on-page actions.
                    </p>

                    {/* Standard Section 5 & 7: Limit in one sentence */}
                    <p className="text-[12px] text-gray-400 leading-normal">
                      I cannot submit forms or perform actions without your explicit confirmation.
                    </p>

                    {/* Standard Section 2.2: 4 action chips (36-44px tall touch targets, 8px gap) */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {[
                        "Summarize this page",
                        "Navigate site sections",
                        "Explain page architecture",
                        "Find contact & links",
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setInputValue(chip);
                            sendMessage(chip);
                          }}
                          className="min-h-[40px] px-3.5 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-purple-600/20 hover:border-purple-500/50 text-[13px] text-gray-200 hover:text-white transition-all cursor-pointer text-left flex items-center justify-center font-medium shadow-sm active:scale-98"
                        >
                          {chip}
                        </button>
                      ))}
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
                    />
                  ))
                )}

                {/* In-Flight Streaming & Steps Indicator */}
                {isLoading && (
                  <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px] py-1 select-none">
                    <span className="inline-block w-1.5 h-3.5 bg-purple-400 animate-pulse" />
                    <span>Thinking...</span>
                    {activeSteps.length > 0 && (
                      <span className="text-gray-500 truncate max-w-[220px]">
                        (step {activeSteps.length}: {activeSteps[activeSteps.length - 1].tool})
                      </span>
                    )}
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
        </div>
      )}

      {/* Floating Toggle Button (when closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="g4-launcher-button relative group text-white rounded-[8px] flex items-center gap-2 cursor-pointer"
          title="Open On-Device AI Assistant"
        >
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            <Sparkles size={15} />
          </div>
          <span className="font-semibold text-xs pr-1 tracking-tight">AI Assistant</span>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0b0f19] shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
        </button>
      )}
    </div>
  );
}
