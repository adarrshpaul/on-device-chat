import React from "react";
import { ArrowUpRight, X, ChevronDown, Award } from "lucide-react";
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
    <div className="bg-[var(--g4-bg-panel)] px-4 py-3 border-b border-[var(--g4-border)] flex flex-col gap-2 relative">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--g4-primary)] to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
            AI
          </div>
          <div>
            <h3 className="font-semibold text-[var(--g4-text-main)] m-0 text-sm leading-tight flex items-center gap-1.5">
              Harness Web Agent
              <button
                onClick={onToggleTierMenu}
                className={`text-[9px] font-medium px-2 py-0.5 rounded border ${currentTierInfo.badgeColor} flex items-center gap-1 cursor-pointer hover:brightness-110`}
              >
                <span>{currentTierInfo.name}</span>
                <ChevronDown size={10} />
              </button>
            </h3>
            <span className="text-[11px] text-[var(--g4-text-muted)] flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              <span>
                {currentTierInfo.size} — {currentTierInfo.description}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEscalate}
            className="text-[10px] text-purple-300 hover:text-white px-2 py-1 rounded bg-purple-900/30 hover:bg-purple-900/60 border border-purple-700/40 flex items-center gap-1 cursor-pointer transition-colors"
            title="Climb to higher capability model"
          >
            <ArrowUpRight size={11} />
            <span>Escalate</span>
          </button>
          <button
            onClick={onClose}
            className="text-[var(--g4-text-muted)] hover:text-white p-1 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs: Chat vs Evals Studio */}
      <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-gray-800 text-[11px]">
        <button
          onClick={() => onTabChange("chat")}
          className={`flex-1 py-1 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "chat"
              ? "bg-[var(--g4-primary)] text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>Agent Chat</span>
        </button>
        <button
          onClick={() => onTabChange("evals")}
          className={`flex-1 py-1 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "evals"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <Award size={12} />
          <span>Expert Judge & Evals</span>
          {recentTracesCount > 0 && (
            <span className="px-1.5 py-0.2 bg-black/50 text-[9px] rounded-full text-purple-200">
              {recentTracesCount}
            </span>
          )}
        </button>
      </div>

      {/* Tier Switcher Dropdown */}
      {showTierMenu && (
        <div className="absolute top-[82px] left-4 right-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in duration-150">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-2 py-1">
            Switch Progressive Model Tier
          </div>
          {(Object.keys(TIER_METADATA) as unknown as ModelTier[]).map((tierKey) => {
            const info = TIER_METADATA[tierKey];
            const isSelected = info.tier === currentTierInfo.tier;
            return (
              <button
                key={info.tier}
                onClick={() => onSelectTier(info.tier)}
                className={`w-full text-left p-2 rounded-lg flex items-start justify-between transition-colors cursor-pointer ${
                  isSelected ? "bg-purple-900/40 border border-purple-500/50" : "hover:bg-gray-800/80"
                }`}
              >
                <div>
                  <div className="font-medium text-xs text-gray-200 flex items-center gap-1.5">
                    <span>{info.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${info.badgeColor}`}>
                      {info.size}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{info.description}</div>
                </div>
                {isSelected && <span className="text-purple-400 text-xs font-bold">Active</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
