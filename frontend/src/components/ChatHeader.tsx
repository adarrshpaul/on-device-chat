import React, { useState } from "react";
import {
  X,
  ChevronDown,
  Minus,
  ArrowLeft,
  ArrowUp,
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
import { TIER_BADGES, stripLeadingEmoji } from "./tierBadges";

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

  const badge = TIER_BADGES[currentTierInfo.tier] || TIER_BADGES[ModelTier.TIER_0_GEMINI_NANO];
  const TierIcon = badge.icon;
  const iconBtn =
    "g4-header-btn w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors cursor-pointer shrink-0";
  const menuItem =
    "w-full text-left px-2.5 py-1.5 rounded-[6px] text-gray-200 hover:text-white hover:bg-white/5 flex items-center justify-between cursor-pointer transition-colors";

  return (
    <div className="bg-[var(--g4-bg-panel)] px-3 h-[52px] min-h-[48px] pt-[max(0.625rem,env(safe-area-inset-top))] border-b border-[var(--g4-border)] flex items-center justify-between relative select-none touch-none shrink-0 flex-nowrap gap-2">
      {/* Left: Brand Identity + Distinct Model Selector Pill */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          className="flex items-center gap-1.5 min-w-0 cursor-help shrink-0"
          title={`EdgeOperator · 100% on-device · ${currentTierInfo.size}`}
        >
          <span className="relative w-6 h-6 rounded-[7px] bg-[var(--g4-primary)] flex items-center justify-center shrink-0">
            <Zap size={13} className="text-white fill-white" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0d121f]" />
          </span>
          <span className="font-semibold text-white text-[13px] tracking-tight whitespace-nowrap hidden sm:inline">
            EdgeOperator
          </span>
        </div>

        {/* Distinct Model Selector Pill (Guaranteed shrink-0, never crushed) */}
        <button
          type="button"
          onClick={() => {
            setShowOverflowMenu(false);
            onToggleTierMenu();
          }}
          aria-haspopup="menu"
          aria-expanded={showTierMenu}
          aria-label={`Active model: ${badge.label}. Change model`}
          title={`${stripLeadingEmoji(currentTierInfo.name)} · ${currentTierInfo.size}`}
          className={`tier-selector-pill relative shrink-0 h-7 pl-2 pr-1.5 rounded-full border flex items-center gap-1.5 text-[11.5px] font-semibold whitespace-nowrap cursor-pointer transition-all active:scale-95 shadow-sm ${
            showTierMenu ? "open" : ""
          }`}
        >
          <TierIcon size={13} className={`${badge.iconClass} shrink-0`} />
          <span>{badge.label}</span>
          <ChevronDown
            size={12}
            className={`opacity-70 shrink-0 transition-transform duration-150 ${showTierMenu ? "rotate-180" : ""}`}
          />
          {canEscalate && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-[#0d121f]"
              title="Escalation available"
            />
          )}
        </button>
      </div>

      {/* Right: Workflows USP Button + Overflow Menu + Window Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onTabChange("workflows")}
          className="g4-header-workflows-btn h-7 px-2 text-[11px] font-semibold rounded-full cursor-pointer transition-all flex items-center gap-1 whitespace-nowrap active:scale-95 shadow-sm"
          title="Open Workflows & Automations Studio"
          aria-label="Open Workflows"
        >
          <Zap size={11} className="fill-amber-300 text-amber-300" />
          {!isRecordingMacro && <span className="hidden xs:inline">Workflows</span>}
        </button>

        {isRecordingMacro && (
          <button
            onClick={onStopMacroRecording}
            className="h-7 px-2 rounded-full flex items-center gap-1.5 bg-red-500/20 text-red-200 border border-red-500/40 text-[11px] font-semibold cursor-pointer hover:bg-red-500/30 transition-colors animate-pulse"
            title="Recording Macro... Click to Finish"
            aria-label="Finish macro recording"
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>REC</span>
          </button>
        )}

        {/* Overflow Menu Button */}
        <div className="relative">
          <button
            onClick={() => {
              if (showTierMenu) onToggleTierMenu();
              setShowOverflowMenu(!showOverflowMenu);
            }}
            className={`${iconBtn} ${showOverflowMenu ? "bg-white/10 text-white" : ""}`}
            title="More views & settings"
            aria-label="More views and settings"
            aria-haspopup="menu"
            aria-expanded={showOverflowMenu}
          >
            <MoreHorizontal size={15} />
          </button>

          {/* Overflow Popover Menu */}
          {showOverflowMenu && (
            <div className="absolute right-0 top-9 w-56 bg-[#0c101d] border border-white/10 rounded-[8px] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-[12px]">
              <button
                onClick={() => {
                  setShowOverflowMenu(false);
                  onTabChange("navigator");
                }}
                className={menuItem}
              >
                <div className="flex items-center gap-2">
                  <Compass size={13} className="text-emerald-400" />
                  <span>AI Navigation Hub</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowOverflowMenu(false);
                  onTabChange("history");
                }}
                className={menuItem}
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
                className={menuItem}
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
                  if (isRecordingMacro) {
                    onStopMacroRecording?.();
                  } else {
                    onStartMacroRecording?.();
                  }
                }}
                className={menuItem}
              >
                <div className="flex items-center gap-2">
                  <CircleDot size={13} className={isRecordingMacro ? "text-red-400 animate-pulse" : "text-purple-400"} />
                  <span>{isRecordingMacro ? "Stop Recording Macro" : "Teach 1 → Batch N Macro"}</span>
                </div>
                <span className="text-[9px] font-mono px-1 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30">
                  {isRecordingMacro ? "REC" : "Auto"}
                </span>
              </button>

              {/* Window Management Section (Moved from top header to eliminate horizontal clutter) */}
              {(onToggleDock || onToggleGhost) && (
                <>
                  <div className="my-1 border-t border-white/5" />
                  <div className="px-2.5 pt-1 pb-0.5 text-[9.5px] uppercase tracking-wider font-bold text-gray-500">
                    Window Controls
                  </div>
                  {onToggleDock && (
                    <button
                      onClick={() => {
                        setShowOverflowMenu(false);
                        onToggleDock();
                      }}
                      className={menuItem}
                    >
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight size={13} className="text-gray-400" />
                        <span>{dockPosition === "left" ? "Dock to Right" : "Dock to Left"}</span>
                      </div>
                    </button>
                  )}
                  {onToggleGhost && (
                    <button
                      onClick={() => {
                        setShowOverflowMenu(false);
                        onToggleGhost();
                      }}
                      className={menuItem}
                    >
                      <div className="flex items-center gap-2">
                        {isGhostMode ? <EyeOff size={13} className="text-cyan-400" /> : <Eye size={13} className="text-gray-400" />}
                        <span>Ghost Mode (Transparent)</span>
                      </div>
                      <span className={`text-[9px] font-mono px-1 rounded border ${
                        isGhostMode ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "text-gray-500 border-white/10"
                      }`}>
                        {isGhostMode ? "ON" : "OFF"}
                      </span>
                    </button>
                  )}
                </>
              )}

              <div className="my-1 border-t border-white/5" />
              <div className="px-2.5 py-1 text-[10px] text-gray-500 flex items-center gap-1.5 font-mono">
                <ShieldCheck size={11} className="text-emerald-400/80" />
                <span>100% On-Device · Zero Exfiltration</span>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Expand / Collapse */}
        {onToggleMobileExpand && (
          <button
            onClick={onToggleMobileExpand}
            className={`${iconBtn} sm:hidden`}
            title={isMobileExpanded ? "Half Height (Show Game)" : "Expand Full Height"}
            aria-label="Toggle Height"
          >
            {isMobileExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}

        {/* Window Minimize */}
        {onToggleCompact && (
          <button
            onClick={onToggleCompact}
            className={iconBtn}
            title="Minimize to Picture-in-Picture Mini HUD"
            aria-label="Minimize"
          >
            <Minus size={13} />
          </button>
        )}

        {/* Window Close */}
        <button
          onClick={onClose}
          className={iconBtn}
          title="Close EdgeOperator"
          aria-label="Close EdgeOperator"
        >
          <X size={15} />
        </button>
      </div>

      {/* Cognitive Engine & Task Focus Dropdown */}
      {showTierMenu && (
        <div
          role="menu"
          className="absolute top-[48px] left-2 right-2 bg-[#090d18] border border-white/12 rounded-[10px] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[420px] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-2 py-1 mb-1.5 border-b border-white/8">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Model & Cognitive Engine
            </span>
            {canEscalate ? (
              <button
                onClick={() => {
                  onEscalate();
                  onToggleTierMenu();
                }}
                className="text-[10px] font-semibold text-purple-300 hover:text-purple-200 px-1.5 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                title="Escalate to more capable tier"
              >
                <ArrowUp size={10} />
                <span>Escalate Tier</span>
              </button>
            ) : (
              <span className="text-[10px] text-cyan-400 font-mono">
                Auto-Routing Active
              </span>
            )}
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
              const b = TIER_BADGES[tierKey];
              const Icon = b.icon;
              const isSelected = tierKey === currentTierInfo.tier;
              return (
                <button
                  key={tierKey}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onSelectTier(tierKey);
                    onToggleTierMenu();
                  }}
                  className={`w-full text-left p-2.5 rounded-[9px] transition-all flex flex-col gap-1 cursor-pointer ${
                    isSelected
                      ? "tier-menu-item-selected"
                      : "tier-menu-item"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon size={14} className={`${b.iconClass} shrink-0`} />
                      <span className="text-xs font-bold text-white shrink-0">{b.label}</span>
                      <span className="text-[11px] text-gray-300 font-medium truncate">{stripLeadingEmoji(t.name)}</span>
                      {t.isRecommended && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-400/50 shrink-0">
                          1st Choice
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-300 font-mono font-semibold shrink-0">
                      {t.speedProfile || t.size}
                    </span>
                  </div>
                  {t.specialty && (
                    <p className="text-[11px] text-gray-300 leading-snug line-clamp-2 pl-[22px]">
                      {t.specialty}
                    </p>
                  )}
                  {t.bestFor && (
                    <div className="text-[10px] text-purple-300 font-mono font-semibold pl-[22px] flex items-center gap-1">
                      <span className="text-gray-400 font-sans">Best for:</span>
                      <span className="truncate text-purple-200">{t.bestFor}</span>
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
