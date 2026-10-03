import React from "react";
import { Send, Loader2, Eye, Sparkles } from "lucide-react";
import { TierInfo } from "../lib/escalationManager";

interface ChatInputProps {
  inputValue: string;
  isReady: boolean;
  isLoading: boolean;
  currentTierInfo: TierInfo;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onQuickVisionInspect?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  isReady,
  isLoading,
  currentTierInfo,
  onInputChange,
  onSubmit,
  onQuickVisionInspect,
}) => {
  const hasInput = inputValue.trim().length > 0;

  return (
    <div className="p-3 bg-[var(--g4-bg-panel)] border-t border-[var(--g4-border)] flex flex-col gap-2">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-black/40 hover:bg-black/60 focus-within:bg-black/60 border border-white/10 focus-within:border-indigo-500/60 rounded-xl px-2.5 py-1.5 transition-all shadow-inner">
          {onQuickVisionInspect && (
            <button
              type="button"
              onClick={onQuickVisionInspect}
              disabled={!isReady || isLoading}
              title="Inspect visible page using local on-device vision"
              className="p-1.5 rounded-lg text-indigo-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Eye size={17} />
            </button>
          )}

          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={
              isReady
                ? `Ask anything about this page on ${currentTierInfo.name}...`
                : "Initializing local engine..."
            }
            disabled={!isReady || isLoading}
            className="flex-1 bg-transparent text-white placeholder-gray-400 px-2.5 py-1 text-xs focus:outline-none disabled:opacity-50 min-w-0"
          />

          <button
            type="submit"
            disabled={!isReady || isLoading || !hasInput}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              hasInput && !isLoading
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/30 hover:scale-105 active:scale-95"
                : "bg-white/5 text-gray-500 cursor-not-allowed opacity-50"
            }`}
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin text-indigo-300" />
            ) : (
              <Send size={14} className="translate-x-[0.5px]" />
            )}
          </button>
        </div>
      </form>

      {/* Trust & Privacy Micro-Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 font-mono">
        <div className="flex items-center gap-1">
          <Sparkles size={10} className="text-indigo-400" />
          <span>Local-First Intelligence</span>
        </div>
        <span>Zero Data Exfiltration</span>
      </div>
    </div>
  );
};
