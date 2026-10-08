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
    <div className="p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-[var(--g4-bg-panel)] border-t border-[var(--g4-border)] shrink-0">
      <form onSubmit={onSubmit} className="flex items-center">
        <div className="flex-1 flex items-center gap-1.5 bg-black/40 border border-white/8 focus-within:border-purple-500/60 rounded-[6px] px-2 py-1.5 transition-colors min-w-0">
          {/* Dismissible Left Page-Context Tag */}
          {!isContextDismissed && contextLabel && (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-white/6 text-gray-300 border border-white/8 text-[11px] font-mono leading-none">
              <span className="truncate max-w-[75px] sm:max-w-[110px]">{contextLabel}</span>
              <button
                type="button"
                onClick={() => setIsContextDismissed(true)}
                className="text-gray-500 hover:text-white cursor-pointer ml-0.5 p-0.5"
                title="Dismiss context tag"
              >
                <X size={10} />
              </button>
            </span>
          )}

          {/* Clean Central Input Field */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={
              isReady ? "Ask about this page..." : "Initializing local engine..."
            }
            disabled={!isReady}
            className="flex-1 bg-transparent text-white placeholder-gray-500 px-1 py-0.5 text-[16px] sm:text-[13px] focus:outline-none disabled:opacity-50 min-w-0"
          />

          {/* Right Action: Stop or Send */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded-[5px] bg-white/10 hover:bg-white/20 text-gray-200 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              title="Stop generation"
            >
              <Square size={10} className="fill-current text-gray-300" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!isReady || !hasInput}
              className={`w-7 h-7 sm:w-6 sm:h-6 rounded-[5px] flex items-center justify-center transition-colors shrink-0 ${
                hasInput
                  ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
                  : "text-gray-600 hover:text-gray-500 cursor-not-allowed opacity-40"
              }`}
              title="Send"
            >
              <ArrowUp size={14} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
