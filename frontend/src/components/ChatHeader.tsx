import React from "react";
import { ArrowUpRight, X, ChevronDown, Award, Sparkles, Minus, MessageSquare } from "lucide-react";
import { ModelTier, TierInfo, TIER_METADATA } from "../lib/escalationManager";

interface ChatHeaderProps {
  currentTierInfo: TierInfo;
  activeTab: "chat" | "evals";
  recentTracesCount: number;
  showTierMenu: boolean;
  onToggleTierMenu: () => void;
  onSelectTier: (tier: ModelTier) => void;
  onEscalate: () => void;
  onClose: () => void;
  onTabChange: (tab: "chat" | "evals") => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentTierInfo,
  activeTab,
  recentTracesCount,
  showTierMenu,
  onToggleTierMenu,
  onSelectTier,
  onEscalate,
  onClose,
  onTabChange,
}) => {
  return (
    <div className="bg-[var(--g4-bg-panel)] px-4 py-3 border-b border-[var(--g4-border)] flex flex-col gap-2.5 relative select-none">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white m-0 text-sm leading-none tracking-tight">
                On-Device AI
              </h3>
              <button
                onClick={onToggleTierMenu}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 cursor-pointer transition-all hover:scale-105"
                title="Select execution tier"
              >
                <span>{currentTierInfo.name}</span>
                <ChevronDown size={10} className="text-indigo-400" />
              </button>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="truncate">
                {currentTierInfo.size} • 100% Client-Side
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEscalate}
            className="text-[10px] text-indigo-300 hover:text-white px-2 py-1 rounded-md bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-700/40 flex items-center gap-1 cursor-pointer transition-all"
            title="Escalate to higher capability model"
          >
            <ArrowUpRight size={11} />
            <span className="font-medium">Escalate</span>
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
            title="Minimize Assistant"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
            title="Close Assistant"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Navigation Segmented Control: Chat vs Evals */}
      <div className="grid grid-cols-2 p-0.5 bg-black/40 rounded-lg border border-white/5 text-[11px]">
        <button
          onClick={() => onTabChange("chat")}
          className={`py-1.5 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "chat"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <MessageSquare size={13} />
          <span>Chat Copilot</span>
        </button>
        <button
          onClick={() => onTabChange("evals")}
          className={`py-1.5 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "evals"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <Award size={13} />
          <span>Judge & Evals</span>
          {recentTracesCount > 0 && (
            <span className="px-1.5 py-0.2 bg-black/40 text-[9px] rounded-full text-purple-200 font-bold">
              {recentTracesCount}
            </span>
          )}
        </button>
      </div>

      {/* Dropdown Tier Selector */}
      {showTierMenu && (
        <div className="absolute top-[52px] left-4 right-4 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] uppercase font-bold text-gray-400 px-2 py-1 tracking-wider">
            Execution Tiers (Cascade Hierarchy)
          </div>
          {(Object.keys(TIER_METADATA) as unknown as ModelTier[]).map((tierKey) => {
            const t = TIER_METADATA[tierKey];
            const isSelected = tierKey === currentTierInfo.tier;
            return (
              <button
                key={tierKey}
                onClick={() => onSelectTier(tierKey)}
                className={`w-full text-left p-2 rounded-lg transition-colors flex items-start gap-2.5 cursor-pointer ${
                  isSelected ? "bg-indigo-600/20 border border-indigo-500/40" : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isSelected ? "bg-indigo-400" : "bg-gray-600"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white truncate">{t.name}</span>
                    <span className="text-[10px] text-indigo-300 font-mono">{t.size}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
