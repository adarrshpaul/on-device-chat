import React from "react";
import { Send, Loader2, Eye } from "lucide-react";
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
  return (
    <div className="p-3 bg-[var(--g4-bg-panel)] border-t border-[var(--g4-border)]">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        {onQuickVisionInspect && (
          <button
            type="button"
            onClick={onQuickVisionInspect}
            disabled={!isReady || isLoading}
            title="Inspect visible page with on-device vision"
            className="w-9 h-9 rounded-full bg-gray-800/80 hover:bg-purple-900/60 text-purple-300 hover:text-white border border-gray-700 hover:border-purple-500/50 flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer shrink-0"
          >
            <Eye size={16} />
          </button>
        )}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={
            isReady
              ? `Command agent on ${currentTierInfo.name}...`
              : "Initializing AI engine..."
          }
          disabled={!isReady || isLoading}
          className="flex-1 bg-[var(--g4-bg-dark)] text-[var(--g4-text-main)] border border-[var(--g4-border)] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[var(--g4-primary)] disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!isReady || isLoading || !inputValue.trim()}
          className="bg-[var(--g4-primary)] hover:bg-[var(--g4-primary-hover)] text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md shrink-0"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} className="ml-0.5" />
          )}
        </button>
      </form>
    </div>
  );
};
