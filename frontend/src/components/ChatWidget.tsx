import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Sparkles, Info, ChevronRight, Activity } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
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
    evalMetrics,
    recentTraces,
    siteMacros,
    isJudging,
    setTier,
    handleFeedback,
    triggerEscalation,
    runBatchJudge,
    judgeSingleTrace,
    rateTrace,
  } = useChat(config);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading, activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || engineStatus !== "ready") return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleQuickVisionInspect = () => {
    if (isLoading || engineStatus !== "ready") return;
    sendMessage("Describe what is visible on this page in detail.");
  };

  const isReady = engineStatus === "ready";

  return (
    <div
      data-g4-widget="true"
      className="g4-widget-container fixed bottom-6 right-6 z-[9999] flex flex-col items-end"
    >
      {/* Chat Window */}
      {isOpen && (
        <div className="w-[440px] h-[660px] max-h-[88vh] max-w-[calc(100vw-32px)] bg-[var(--g4-bg-dark)] border border-[var(--g4-border)] rounded-2xl shadow-2xl flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Modular Header */}
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
                <div className="bg-amber-950/80 border-b border-amber-800/60 p-2.5 text-[11px] text-amber-200 flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-semibold flex items-center gap-1 text-amber-300">
                      <Info size={12} />
                      <span>Running on Fallback Local Engine</span>
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
              <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--g4-text-muted)] space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-200 text-sm">Autonomous Web Agent</h4>
                      <p className="text-xs text-gray-400 max-w-[260px] mt-1">
                        Executes actions using 5 primitives: browse, sandbox, read/write, search, and see.
                      </p>
                    </div>

                    {/* Quick Starter Prompts */}
                    <div className="w-full pt-2 space-y-1.5 text-left">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        Suggested Actions:
                      </div>
                      {[
                        "What is on this page?",
                        "Search catalog for 'smartwatch'",
                        "Add Titanium Smartwatch to cart",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => {
                            setInputValue(prompt);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-[11px] text-gray-300 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">"{prompt}"</span>
                          <ChevronRight size={12} className="text-gray-500 shrink-0" />
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
                  <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 space-y-1 animate-pulse font-mono text-[10px]">
                    <div className="text-purple-300 font-semibold flex items-center gap-1.5">
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

      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-[var(--g4-primary)] hover:bg-[var(--g4-primary-hover)] text-white rounded-2xl shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-purple-400/20"
        >
          <MessageSquare size={24} />
        </button>
      )}
    </div>
  );
}
