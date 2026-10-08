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
} from "lucide-react";
import { ModelTier, TierInfo, TIER_METADATA } from "../lib/escalationManager";

export type WidgetTab = "chat" | "navigator" | "history" | "evals";

interface ChatHeaderProps {
  currentTierInfo: TierInfo;
  activeTab: WidgetTab;
  recentTracesCount: number;
  sessionsCount?: number;
  canEscalate?: boolean;
  showTierMenu: boolean;
  onToggleTierMenu: () => void;
  onSelectTier: (tier: ModelTier) => void;
  onEscalate: () => void;
  onClose: () => void;
  onTabChange: (tab: WidgetTab) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentTierInfo,
  activeTab,
  recentTracesCount,
  sessionsCount = 0,
  canEscalate = false,
  showTierMenu,
  onToggleTierMenu,
  onSelectTier,
  onEscalate,
  onClose,
  onTabChange,
}) => {
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  // When inside a secondary view (Nav Hub, History, Judge), show a dedicated clean back bar
  if (activeTab !== "chat") {
    const titles: Record<WidgetTab, string> = {
      chat: "Chat",
      navigator: "AI Navigation Hub",
      history: "Session History",
      evals: "Judge & Evals Studio",
    };

    return (
      <div className="bg-[var(--g4-bg-panel)] px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] border-b border-[var(--g4-border)] flex items-center justify-between select-none touch-none shrink-0 flex-nowrap">
        <button
          onClick={() => onTabChange("chat")}
          className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white font-medium py-1 px-1.5 rounded-[6px] hover:bg-white/5 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={13} className="text-gray-400" />
          <span>Back to Chat</span>
        </button>

        <span className="text-xs font-semibold text-white tracking-tight truncate px-2">
          {titles[activeTab]}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--g4-bg-panel)] px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] border-b border-[var(--g4-border)] flex items-center justify-between relative select-none touch-none shrink-0 flex-nowrap gap-1">
      {/* Left: Status beacon + Copilot Title + Model Text Dropdown */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink flex-nowrap">
        <span
          className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 cursor-help transition-transform hover:scale-125"
          title={`On-device · ${currentTierInfo.name} (${currentTierInfo.size})`}
        />

        <span className="font-semibold text-white text-[13px] sm:text-sm tracking-tight leading-none whitespace-nowrap shrink-0">
          AI Copilot
        </span>

        <button
          onClick={() => {
            setShowOverflowMenu(false);
            onToggleTierMenu();
          }}
          className="text-[11px] sm:text-[12px] text-gray-400 hover:text-gray-200 flex items-center gap-0.5 cursor-pointer py-0.5 px-1 rounded-[4px] hover:bg-white/5 transition-colors min-w-0 shrink"
          title="Select model tier"
        >
          <span className="truncate max-w-[85px] sm:max-w-[130px]">{currentTierInfo.name}</span>
          <ChevronDown size={11} className="text-gray-400 shrink-0" />
        </button>
      </div>

      {/* Right: Escalate text button + Overflow Menu + Window Controls */}
      <div className="flex items-center gap-1 shrink-0 flex-nowrap">
        {canEscalate && (
          <button
            onClick={onEscalate}
            className="text-[10px] sm:text-[11px] text-purple-400 hover:text-purple-300 font-medium px-1.5 py-0.5 rounded-[4px] hover:bg-purple-500/10 cursor-pointer transition-colors whitespace-nowrap"
            title="Escalate to more capable tier"
          >
            Escalate
          </button>
        )}

        {/* Overflow Menu Button */}
        <div className="relative">
          <button
            onClick={() => {
              if (showTierMenu) onToggleTierMenu();
              setShowOverflowMenu(!showOverflowMenu);
            }}
            className={`text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer ${
              showOverflowMenu ? "bg-white/10 text-white" : ""
            }`}
            title="More views & settings"
          >
            <MoreHorizontal size={14} />
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

              <div className="my-1 border-t border-white/5" />

              <div className="px-2.5 py-1 text-[10px] text-gray-500 flex items-center gap-1.5 font-mono">
                <ShieldCheck size={11} className="text-emerald-400/80" />
                <span>100% On-Device · Zero Exfiltration</span>
              </div>
            </div>
          )}
        </div>

        {/* Window controls */}
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/5 hidden sm:flex items-center justify-center transition-colors cursor-pointer"
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white w-7 h-7 sm:w-6 sm:h-6 rounded-[6px] hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* Model Tier Selector Dropdown */}
      {showTierMenu && (
        <div className="absolute top-[42px] left-3 right-3 bg-[#0c101d] border border-white/10 rounded-[8px] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="text-[10px] uppercase font-semibold text-gray-500 px-2 py-1 tracking-wider">
            Model Tier
          </div>
          {Object.keys(TIER_METADATA).map((rawKey) => {
            const tierKey = Number(rawKey) as ModelTier;
            const t = TIER_METADATA[tierKey];
            const isSelected = tierKey === currentTierInfo.tier;
            return (
              <button
                key={rawKey}
                onClick={() => {
                  onSelectTier(tierKey);
                  onToggleTierMenu();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-[6px] transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-purple-900/30 text-white"
                    : "hover:bg-white/5 text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isSelected ? "bg-purple-400" : "bg-gray-600"
                    }`}
                  />
                  <span className="text-xs font-medium truncate">{t.name}</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono ml-2 shrink-0">
                  {t.size}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
