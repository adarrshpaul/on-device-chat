import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, X, Mic } from "lucide-react";
import { TierInfo } from "../lib/escalationManager";
import { VoiceEngine } from "../lib/voiceEngine";

interface ChatInputProps {
  inputValue: string;
  isReady: boolean;
  isLoading: boolean;
  currentTierInfo: TierInfo;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop?: () => void;
  onVoiceTranscribed?: (text: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  isReady,
  isLoading,
  onInputChange,
  onSubmit,
  onStop,
  onVoiceTranscribed,
}) => {
  const [isContextDismissed, setIsContextDismissed] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceEngineRef = useRef<VoiceEngine | null>(null);

  useEffect(() => {
    voiceEngineRef.current = new VoiceEngine({
      outputMode: "agent_command",
      onStateChange: (state, details) => {
        setIsListening(state === "listening");
        if (state === "error") {
          setVoiceError(details || "Voice recording failed");
        } else {
          setVoiceError(null);
        }
      },
      onAudioLevel: (lvl) => setAudioLevel(lvl),
      onInterimTranscript: (text) => {
        onInputChange(text);
      },
      onFinalTranscript: (_raw, polished) => {
        if (polished) {
          onInputChange(polished);
          if (onVoiceTranscribed) {
            onVoiceTranscribed(polished);
          }
        }
      },
    });
    return () => {
      voiceEngineRef.current?.cancelRecording();
    };
  }, [onInputChange, onVoiceTranscribed]);

  const toggleVoiceRecording = async () => {
    if (!voiceEngineRef.current) return;
    if (isListening) {
      await voiceEngineRef.current.stopRecording();
    } else {
      setVoiceError(null);
      await voiceEngineRef.current.startRecording();
    }
  };

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
      {voiceError && (
        <div className="mb-2 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px] flex items-center justify-between">
          <span className="truncate">{voiceError}</span>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            className="text-amber-400 hover:text-white ml-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-black/40 border border-white/10 focus-within:border-purple-500/70 rounded-[8px] px-2.5 py-1.5 transition-colors min-w-0">
          {/* Dismissible Left Page-Context Tag */}
          {!isContextDismissed && contextLabel && !hasInput && (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-purple-500/15 text-purple-300 border border-purple-500/25 text-[10px] font-mono leading-none">
              <span className="truncate max-w-[70px] sm:max-w-[120px]">{contextLabel}</span>
              <button
                type="button"
                onClick={() => setIsContextDismissed(true)}
                className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer ml-0.5"
                title="Dismiss context tag"
                aria-label="Dismiss context tag"
              >
                <X size={10} />
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
            style={{
              backgroundColor: "transparent",
              color: "#f8fafc",
              border: "none",
              outline: "none",
              boxShadow: "none",
              WebkitAppearance: "none",
            }}
            className="flex-1 bg-transparent text-white placeholder-gray-500 px-1 py-1 text-[16px] leading-[1.5] focus:outline-none disabled:opacity-50 min-w-0"
          />
        </div>

        {/* Push-to-Talk Mic Button */}
        <button
          type="button"
          onClick={toggleVoiceRecording}
          disabled={!isReady || isLoading}
          className={`w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-[8px] flex items-center justify-center transition-all shrink-0 shadow-sm ${
            isListening
              ? "bg-red-500/90 text-white animate-pulse ring-2 ring-red-400/50 cursor-pointer"
              : "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 cursor-pointer"
          }`}
          style={isListening ? { transform: `scale(${1 + audioLevel * 0.15})` } : undefined}
          title={isListening ? "Listening... Click to finish voice input" : "Push-to-talk voice input"}
          aria-label={isListening ? "Stop listening" : "Start push-to-talk voice input"}
        >
          <Mic size={17} className={isListening ? "text-white animate-bounce" : "text-gray-300"} />
        </button>

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
