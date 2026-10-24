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
  const [useWhisper, setUseWhisper] = useState(false);
  const [hasWebGPU, setHasWebGPU] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceEngineRef = useRef<VoiceEngine | null>(null);

  useEffect(() => {
    VoiceEngine.hasWebGPU().then((supported) => {
      setHasWebGPU(supported);
      if (supported) {
        setUseWhisper(true);
        if (voiceEngineRef.current) {
          voiceEngineRef.current.setUseWhisperWebGPU(true);
        }
      }
    });
  }, []);

  useEffect(() => {
    voiceEngineRef.current = new VoiceEngine({
      outputMode: "agent_command",
      useWhisperWebGPU: useWhisper,
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
  }, [onInputChange, onVoiceTranscribed, useWhisper]);

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

      {/* Voice Provider Disclosure & Switcher Pill (TASK-118 Rule 7 Honesty & Neo-Brutalist Status Badge) */}
      <div className="flex items-center justify-between text-[11px] mb-2 px-0.5">
        <button
          type="button"
          onClick={() => {
            const next = !useWhisper;
            if (next && !hasWebGPU) {
              setVoiceError("WebGPU is not supported in this browser. Falling back to Browser speech (sent to Google).");
              return;
            }
            setUseWhisper(next);
            voiceEngineRef.current?.setUseWhisperWebGPU(next);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase transition-all cursor-pointer border shadow-sm ${
            useWhisper
              ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/80"
              : "bg-amber-950/80 text-amber-300 border-amber-500/50 hover:bg-amber-900/80"
          }`}
          title={
            useWhisper
              ? "On-device Whisper: 100% private, zero cloud egress via WebGPU. Click to switch to Browser speech."
              : "Browser speech: Transmits audio to Google cloud servers for transcription. Click to switch to On-device Whisper."
          }
        >
          <span className={`w-2 h-2 rounded-full ${useWhisper ? "bg-[#D4FF00] shadow-[0_0_8px_#D4FF00]" : "bg-amber-400 shadow-[0_0_8px_#F59E0B]"}`} />
          <span>{useWhisper ? "On-Device Whisper (100% Private)" : "Browser Speech (Cloud)"}</span>
          <span className="text-[9px] opacity-75 font-mono underline ml-0.5">{hasWebGPU ? "switch" : "info"}</span>
        </button>
      </div>

      {/* Active Listening Indicator Banner */}
      {isListening && (
        <div className={`mb-2 px-3 py-1.5 rounded-xl text-[11px] flex items-center justify-between shadow-sm animate-pulse ${
          useWhisper
            ? "bg-emerald-950/90 border-2 border-emerald-500/60 text-emerald-200"
            : "bg-amber-950/90 border-2 border-amber-500/60 text-amber-200"
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-bold">
              {useWhisper
                ? "Listening with On-Device Whisper (Zero Egress)..."
                : "Recording with Browser speech (Sent to Google)..."}
            </span>
          </div>
          <span className="text-[10px] font-mono opacity-80">Tap mic to finish</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 p-1 rounded-2xl bg-[#090d18] border-2 border-white/15 focus-within:border-[#D4FF00] focus-within:shadow-[0_0_18px_rgba(212,255,0,0.18)] transition-all">
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 min-w-0">
          {/* Dismissible Left Page-Context Tag */}
          {!isContextDismissed && contextLabel && !hasInput && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-500/35 text-[10px] font-mono font-bold leading-none">
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
              isReady ? "Ask about this page or command..." : "Initializing local engine..."
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
            className="flex-1 bg-transparent text-white placeholder-gray-500 px-1 py-1 text-[16px] leading-[1.5] focus:outline-none disabled:opacity-50 min-w-0 font-medium"
          />
        </div>

        {/* Push-to-Talk Mic Button */}
        <button
          type="button"
          onClick={toggleVoiceRecording}
          disabled={!isReady || isLoading}
          className={`w-[42px] h-[42px] min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm g4-mic-btn ${
            isListening ? "listening" : ""
          }`}
          style={isListening ? { transform: `scale(${1 + audioLevel * 0.15})` } : undefined}
          title={
            isListening
              ? `Listening with ${useWhisper ? "On-device Whisper" : "Browser speech (sent to Google)"}... Click to finish voice input`
              : `Voice input: ${useWhisper ? "On-device Whisper" : "Browser speech (sent to Google)"}`
          }
          aria-label={
            isListening
              ? `Stop voice input (${useWhisper ? "On-device Whisper" : "Browser speech (sent to Google)"})`
              : `Start voice input (${useWhisper ? "On-device Whisper" : "Browser speech (sent to Google)"})`
          }
        >
          <Mic size={18} className={isListening ? "text-white animate-bounce" : "text-gray-200"} />
        </button>

        {/* Right Action: Stop or Send (High-Contrast Tactile Button) */}
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="w-[42px] h-[42px] min-w-[42px] min-h-[42px] rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-sm active:scale-95"
            title="Stop generation"
            aria-label="Stop generation"
          >
            <Square size={13} className="fill-current text-gray-100" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!isReady || !hasInput}
            className={`w-[42px] h-[42px] min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center transition-all shrink-0 ${
              hasInput
                ? "neo-btn-send-active active:translate-x-[1px] active:translate-y-[1px]"
                : "g4-send-btn-disabled"
            }`}
            title="Send"
            aria-label="Send message"
          >
            <ArrowUp size={20} className={hasInput ? "stroke-[3] text-black" : "text-gray-500"} />
          </button>
        )}
      </form>
    </div>
  );
};
