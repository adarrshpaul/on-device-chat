import React, { useState } from "react";
import {
  X,
  ChevronDown,
  Minus,
  ArrowLeft,
  MoreHorizontal,
  Compass,
  History,
  Award,
  ShieldCheck,
  Zap,
  CircleDot,
  ArrowLeftRight,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { ModelTier, TierInfo, TIER_METADATA } from "../lib/escalationManager";

export type WidgetTab = "chat" | "navigator" | "history" | "evals" | "workflows";

interface ChatHeaderProps {
  currentTierInfo: TierInfo;
  activeTab: WidgetTab;
  recentTracesCount: number;
  sessionsCount?: number;
  canEscalate?: boolean;
  showTierMenu: boolean;
  isRecordingMacro?: boolean;
  dockPosition?: "left" | "right";
  isGhostMode?: boolean;
  isMobileExpanded?: boolean;
  onToggleTierMenu: () => void;
  onSelectTier: (tier: ModelTier) => void;
  onEscalate: () => void;
  onClose: () => void;
  onTabChange: (tab: WidgetTab) => void;
  onStartMacroRecording?: () => void;
  onStopMacroRecording?: () => void;
  onToggleDock?: () => void;
  onToggleCompact?: () => void;
  onToggleGhost?: () => void;
  onToggleMobileExpand?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentTierInfo,
  activeTab,
  recentTracesCount,
  sessionsCount = 0,
  canEscalate = false,
  showTierMenu,
  isRecordingMacro = false,
  dockPosition = "right",
  isGhostMode = false,
  isMobileExpanded = false,
  onToggleTierMenu,
  onSelectTier,
  onEscalate,
  onClose,
  onTabChange,
  onStartMacroRecording,
  onStopMacroRecording,
  onToggleDock,
  onToggleCompact,
  onToggleGhost,
  onToggleMobileExpand,
}) => {
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  // When inside a secondary view (Nav Hub, History, Judge, Workflows), show a dedicated clean back bar
  if (activeTab !== "chat") {
    const titles: Record<WidgetTab, string> = {
      chat: "Chat",
      navigator: "AI Navigation Hub",
      history: "Session History",
      evals: "Judge & Evals Studio",
      workflows: "Workflows & Automations",
    };

    return (
      <div className="bg-[var(--g4-bg-panel)] px-4 h-[52px] min-h-[48px] pt-[max(0.625rem,env(safe-area-inset-top))] border-b border-[var(--g4-border)] flex items-center justify-between select-none touch-none shrink-0 flex-nowrap">
        <button
          onClick={() => onTabChange("chat")}
          className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white font-medium min-h-[40px] px-2 rounded-[6px] hover:bg-white/5 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={14} className="text-gray-400" />
          <span>Back to Chat</span>
        </button>

        <span className="text-xs font-semibold text-white tracking-tight truncate px-2">
          {titles[activeTab]}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleCompact && (
            <button
              onClick={onToggleCompact}
              className="text-gray-400 hover:text-white w-[36px] h-[36px] rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title="Minimize to Picture-in-Picture Mini HUD"
              aria-label="Minimize"
            >
              <Minus size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white w-[36px] h-[36px] rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--g4-bg-panel)] px-4 h-[52px] min-h-[48px] pt-[max(0.625rem,env(safe-area-inset-top))] border-b border-[var(--g4-border)] flex items-center justify-between relative select-none touch-none shrink-0 flex-nowrap gap-2">
      {/* Left: Status beacon + Copilot Title + Model Text Dropdown */}
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <span
          className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 cursor-help transition-transform hover:scale-125"
          title={`On-device · ${currentTierInfo.name} (${currentTierInfo.size})`}
        />

        <span className="font-semibold text-white text-[13px] tracking-tight leading-none whitespace-nowrap shrink-0">
          EdgeOperator ⚡
        </span>

        <button
          onClick={() => {
            setShowOverflowMenu(false);
            onToggleTierMenu();
          }}
          className="text-[11.5px] text-gray-400 hover:text-gray-200 flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-[6px] hover:bg-white/5 transition-colors min-w-0 truncate max-w-[110px]"
          title="Select cognitive engine & task focus"
          aria-label="Select cognitive engine & task focus"
        >
          <span className="truncate">{currentTierInfo.name}</span>
          <ChevronDown size={11} className="text-gray-400 shrink-0" />
        </button>
      </div>

      {/* Right: Workflows USP Button + Escalate + Overflow Menu + Window Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onTabChange("workflows")}
          className="text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 font-semibold px-2 py-1 rounded-[6px] cursor-pointer transition-all flex items-center gap-1 whitespace-nowrap active:scale-95 shadow-sm"
          title="Open Workflows & Automations Studio"
          aria-label="Open Workflows"
        >
          <Zap size={11} className="fill-amber-300 text-amber-300" />
          <span>Workflows</span>
        </button>

        {canEscalate && (
          <button
            onClick={onEscalate}
            className="text-[11px] text-purple-400 hover:text-purple-300 font-medium px-2 py-1 rounded-[6px] hover:bg-purple-500/10 cursor-pointer transition-colors whitespace-nowrap"
            title="Escalate to more capable tier"
            aria-label="Escalate to more capable tier"
          >
            Escalate
          </button>
        )}

        {isRecordingMacro && (
          <button
            onClick={onStopMacroRecording}
            className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-red-500/20 text-red-300 border border-red-500/40 text-[11px] font-semibold animate-pulse cursor-pointer hover:bg-red-500/30 transition-all shadow-sm"
            title="Recording Macro... Click to Finish"
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Finish Macro</span>
          </button>
        )}

        {/* Overflow Menu Button */}
        <div className="relative">
          <button
            onClick={() => {
              if (showTierMenu) onToggleTierMenu();
              setShowOverflowMenu(!showOverflowMenu);
            }}
            className={`text-gray-400 hover:text-white w-[40px] h-[40px] min-w-[40px] min-h-[40px] rounded-[8px] hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer ${
              showOverflowMenu ? "bg-white/10 text-white" : ""
            }`}
            title="More views & settings"
            aria-label="More views and settings"
          >
            <MoreHorizontal size={16} />
          </button>

          {/* Overflow Popover Menu */}
          {showOverflowMenu && (
            <div className="absolute right-0 top-8 w-52 bg-[#0c101d] border border-white/10 rounded-[8px] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-[12px]">
              <button
                onClick={() => {
                  setShowOverflowMenu(false);
                  onTabChange("navigator");
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-gray-200 hover:text-white hover:bg-white/5 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Compass size={13} className="text-emerald-400" />
                <span>AI Navigation Hub</span>
              </button>

              <button
                onClick={() => {
                  setShowOverflowMenu(false);
                  onTabChange("history");
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-gray-200 hover:text-white hover:bg-white/5 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <History size={13} className="text-cyan-400" />
                  <span>Session History</span>
                </div>
                {sessionsCount > 0 && (
                  <span className="text-[10px] text-gray-400 font-mono">
                    {sessionsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setShowOverflowMenu(false);
                  onTabChange("evals");
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-gray-200 hover:text-white hover:bg-white/5 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Award size={13} className="text-purple-400" />
                  <span>Judge & Evals</span>
                </div>
                {recentTracesCount > 0 && (
                  <span className="text-[10px] text-purple-300 font-mono">
                    {recentTracesCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setShowOverflowMenu(false);
                  onTabChange("workflows");
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-gray-200 hover:text-white hover:bg-white/5 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-amber-400" />
                  <span>Workflows & Automations</span>
                </div>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30">
                  Studio
                </span>
              </button>

              <button
                onClick={() => {
                  setShowOverflowMenu(false);
                  if (isRecordingMacro) {
                    onStopMacroRecording?.();
                  } else {
                    onStartMacroRecording?.();
                  }
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-gray-200 hover:text-white hover:bg-white/5 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CircleDot size={13} className={isRecordingMacro ? "text-red-400 animate-pulse" : "text-purple-400"} />
                  <span>{isRecordingMacro ? "Stop Recording Macro" : "Teach 1 → Batch N Macro"}</span>
                </div>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30">
                  {isRecordingMacro ? "REC" : "Auto"}
                </span>
              </button>

              <div className="my-1 border-t border-white/5" />

              <div className="px-2.5 py-1 text-[10px] text-gray-500 flex items-center gap-1.5 font-mono">
                <ShieldCheck size={11} className="text-emerald-400/80" />
                <span>100% On-Device · Zero Exfiltration</span>
              </div>
            </div>
          )}
        </div>

        {/* Window & Dock controls */}
        {onToggleDock && (
          <button
            onClick={onToggleDock}
            className="text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title={dockPosition === "left" ? "Dock to Right" : "Dock to Left (Frees up Canvas)"}
            aria-label="Switch Dock Position"
          >
            <ArrowLeftRight size={13} />
          </button>
        )}

        {onToggleGhost && (
          <button
            onClick={onToggleGhost}
            className={`text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer ${
              isGhostMode ? "text-cyan-400 bg-cyan-500/20" : ""
            }`}
            title={isGhostMode ? "Ghost Mode ON (Semi-transparent)" : "Ghost Mode (See game underneath)"}
            aria-label="Toggle Ghost Transparency"
          >
            {isGhostMode ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}

        {onToggleMobileExpand && (
          <button
            onClick={onToggleMobileExpand}
            className="text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/10 sm:hidden flex items-center justify-center transition-colors cursor-pointer"
            title={isMobileExpanded ? "Half Height (Show Game)" : "Expand Full Height"}
            aria-label="Toggle Height"
          >
            {isMobileExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}

        {onToggleCompact && (
          <button
            onClick={onToggleCompact}
            className="text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="Minimize to Picture-in-Picture Mini HUD"
            aria-label="Minimize"
          >
            <Minus size={13} />
          </button>
        )}

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          title="Close EdgeOperator"
          aria-label="Close EdgeOperator"
        >
          <X size={15} />
        </button>
      </div>

      {/* Cognitive Engine & Task Focus Dropdown */}
      {showTierMenu && (
        <div className="absolute top-[48px] left-2 right-2 bg-[#090d18] border border-white/12 rounded-[10px] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[420px] overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1 mb-1.5 border-b border-white/8">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Cognitive Engine & Task Specialty
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">
              Auto-Routing Active
            </span>
          </div>
          <div className="space-y-1">
            {[
              ModelTier.TIER_1_5_LAYA_DECISION,
              ModelTier.TIER_0_GEMINI_NANO,
              ModelTier.TIER_1_MINILM_ROUTER,
              ModelTier.TIER_2_SMOLLM_GENERATIVE,
              ModelTier.TIER_3_GEMMA4_E2B,
            ].map((tierKey) => {
              const t = TIER_METADATA[tierKey];
              const isSelected = tierKey === currentTierInfo.tier;
              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => {
                    onSelectTier(tierKey);
                    onToggleTierMenu();
                  }}
                  className={`w-full text-left p-2 rounded-[8px] transition-all flex flex-col gap-0.5 cursor-pointer border ${
                    isSelected
                      ? "bg-purple-950/40 border-purple-500/50 shadow-md text-white"
                      : "hover:bg-white/5 border-transparent text-gray-300 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSelected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-gray-600"
                        }`}
                      />
                      <span className="text-xs font-semibold truncate text-white">{t.name}</span>
                      {t.isRecommended && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shrink-0">
                          1st Choice
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono shrink-0">
                      {t.speedProfile || t.size}
                    </span>
                  </div>
                  {t.specialty && (
                    <p className="text-[11px] text-gray-400 leading-snug line-clamp-2 pl-3.5">
                      {t.specialty}
                    </p>
                  )}
                  {t.bestFor && (
                    <div className="text-[10px] text-purple-300/80 font-mono pl-3.5 flex items-center gap-1">
                      <span className="text-gray-500 font-sans">Best for:</span>
                      <span className="truncate">{t.bestFor}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
