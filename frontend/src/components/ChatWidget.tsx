import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Info, ChevronRight, Activity, Eye, Terminal, Zap } from "lucide-react";
import { Gemma4Config } from "../main";
import { useChat } from "../hooks/useChat";
import MessageBubble from "./MessageBubble";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { EvalsStudio } from "./EvalsStudio";

export interface ChatWidgetProps {
  config?: Gemma4Config;
}

export default function ChatWidget({ config = {} }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(config.defaultOpen ?? false);
  const [inputValue, setInputValue] = useState("");
  const [showTierMenu, setShowTierMenu] = useState(false);
  const [showNanoHelp, setShowNanoHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "evals">("chat");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const {
    messages,
    isLoading,
    sendMessage,
    engineStatus,
    currentTierInfo,
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
  } = useChat(config);

  const handleQuickVisionInspect = () => {
    sendMessage("Inspect and describe what is visible on this page in detail.");
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      className="g4-widget-container fixed bottom-6 right-6 z-[999999] flex flex-col items-end pointer-events-auto"
    >
      {/* Expanded Chat & Evals Window */}
      {isOpen && (
        <div className="w-[440px] h-[650px] max-h-[88vh] max-w-[calc(100vw-32px)] g4-window-card rounded-2xl shadow-2xl flex flex-col mb-3 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <ChatHeader
            currentTierInfo={currentTierInfo}
            activeTab={activeTab}
            recentTracesCount={recentTraces.length}
            showTierMenu={showTierMenu}
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
              <div className="g4-messages-container text-xs">
                {messages.length === 0 ? (
                  <div className="g4-empty-hero">
                    <div className="relative">
                      <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/10">
                        <Sparkles size={26} />
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0b0f19] shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                    </div>

                    <div>
                      <h4 className="font-semibold text-white text-sm tracking-tight">
                        How can I assist you on this page?
                      </h4>
                      <p className="text-[11px] text-gray-400 max-w-[270px] mt-1 leading-relaxed">
                        Autonomous local agent running 100% in your browser. Inspects elements, executes tools, and reasons with zero cloud latency.
                      </p>
                    </div>

                    {/* Context-Adaptive Starter Cards */}
                    <div className="g4-cards-grid text-left">
                      {[
                        {
                          icon: <Eye size={15} className="text-indigo-400" />,
                          title: "Inspect Visible Page",
                          desc: "Scan and summarize interactive elements on screen",
                          prompt: "What is on this page?",
                        },
                        {
                          icon: <Terminal size={15} className="text-emerald-400" />,
                          title: "Explain Content & Code",
                          desc: "Analyze specifications, logic, and data shown here",
                          prompt: "Explain what this page is doing and its key data.",
                        },
                        {
                          icon: <Zap size={15} className="text-amber-400" />,
                          title: "Execute Page Action",
                          desc: "Trigger actions, interact with controls, or search",
                          prompt: "What actions can you perform on this page?",
                        },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInputValue(item.prompt)}
                          className="g4-suggestion-card w-full text-left p-2.5 rounded-xl flex items-center gap-3 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs text-gray-200 group-hover:text-white transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              {item.desc}
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-gray-600 group-hover:text-indigo-400 transition-colors shrink-0" />
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
                    />
                  ))
                )}

                {/* In-Flight Agent Steps Tracker */}
                {isLoading && activeSteps.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-1 animate-pulse font-mono text-[10px]">
                    <div className="text-indigo-300 font-semibold flex items-center gap-1.5">
                      <Activity size={11} className="animate-spin" />
                      <span>Autonomous Execution (Step {activeSteps.length}):</span>
                    </div>
                    {activeSteps.slice(-2).map((s, idx) => (
                      <div key={idx} className="text-gray-300 truncate">
                        • {s.tool}: {s.observationSummary.slice(0, 80)}
                      </div>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Modular Input Form */}
              <ChatInput
                inputValue={inputValue}
                isReady={isReady}
                isLoading={isLoading}
                currentTierInfo={currentTierInfo}
                onInputChange={setInputValue}
                onSubmit={handleSubmit}
                onQuickVisionInspect={handleQuickVisionInspect}
              />
            </>
          )}

          {/* Tab 2: Chrome AI Expert Judge & Evals Studio */}
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
        </div>
      )}

      {/* Floating Toggle Button (when closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative group p-3.5 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl shadow-2xl flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/20 shadow-indigo-500/30"
          title="Open On-Device AI Assistant"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <span className="font-semibold text-xs pr-1 tracking-tight">AI Assistant</span>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0b0f19] shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
        </button>
      )}
    </div>
  );
}
