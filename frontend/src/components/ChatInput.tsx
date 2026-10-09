import React, { useState } from "react";
import { ArrowUp, Square, X } from "lucide-react";
import { TierInfo } from "../lib/escalationManager";

interface ChatInputProps {
  inputValue: string;
  isReady: boolean;
  isLoading: boolean;
  currentTierInfo: TierInfo;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  isReady,
  isLoading,
  onInputChange,
  onSubmit,
  onStop,
}) => {
  const [isContextDismissed, setIsContextDismissed] = useState(false);
  const hasInput = inputValue.trim().length > 0;

  // Derives clean page context path or host
  const getContextLabel = (): string => {
    if (typeof window === "undefined") return "/";
    const path = window.location.pathname;
    if (path && path !== "/") return path;
    return window.location.hostname.replace(/^www\./, "");
  };

  const contextLabel = getContextLabel();

  return (
    <div className="px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[var(--g4-bg-panel)] border-t border-[var(--g4-border)] shrink-0">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-black/40 border border-white/10 focus-within:border-purple-500/70 rounded-[8px] px-2.5 py-1.5 transition-colors min-w-0">
          {/* Dismissible Left Page-Context Tag */}
          {!isContextDismissed && contextLabel && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-[5px] bg-white/6 text-gray-300 border border-white/8 text-[11px] font-mono leading-none">
              <span className="truncate max-w-[80px] sm:max-w-[120px]">{contextLabel}</span>
              <button
                type="button"
                onClick={() => setIsContextDismissed(true)}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer ml-0.5"
                title="Dismiss context tag"
                aria-label="Dismiss context tag"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {/* Clean Central Input Field (16px minimum body floor, zero auto-zoom) */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={
              isReady ? "Ask about this page..." : "Initializing local engine..."
            }
            disabled={!isReady}
            className="flex-1 bg-transparent text-white placeholder-gray-500 px-1 py-1 text-[16px] leading-[1.5] focus:outline-none disabled:opacity-50 min-w-0"
          />
        </div>

        {/* Right Action: Stop or Send (Minimum 44x44px Thumb Target Slot) */}
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-[8px] bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-sm"
            title="Stop generation"
            aria-label="Stop generation"
          >
            <Square size={13} className="fill-current text-gray-200" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!isReady || !hasInput}
            className={`w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-[8px] flex items-center justify-center transition-colors shrink-0 shadow-sm ${
              hasInput
                ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-purple-600/30"
                : "text-gray-600 bg-white/4 cursor-not-allowed opacity-40"
            }`}
            title="Send"
            aria-label="Send message"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </form>
    </div>
  );
};
