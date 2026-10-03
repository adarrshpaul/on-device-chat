import { useState } from "react";
import { marked } from "marked";
import ToolCallCard from "./ToolCallCard";
import type { DisplayMessage } from "../hooks/useChat";
import { ThumbsUp, ThumbsDown, ArrowUpRight, ShieldAlert, Zap, ChevronDown, ChevronRight, Terminal } from "lucide-react";

interface MessageBubbleProps {
  message: DisplayMessage;
  onFeedback?: (messageId: string, feedback: "up" | "down") => void;
  onEscalate?: () => void;
}

export default function MessageBubble({ message, onFeedback, onEscalate }: MessageBubbleProps) {
  const [showSteps, setShowSteps] = useState(false);

  // Escalation notice message
  if (message.isEscalationNotice || message.role === "system") {
    return (
      <div className="my-3 px-3 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-200 text-xs shadow-md flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <ShieldAlert size={16} className="text-purple-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-purple-300 mb-0.5 flex items-center gap-1.5">
            Model Escalation Triggered
          </div>
          <div dangerouslySetInnerHTML={{ __html: marked(message.content || "") as string }} />
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-[var(--g4-primary)] text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "assistant") {
    return (
      <div className="flex flex-col mb-4 items-start max-w-[90%]">
        {/* Tier & Macro Badge */}
        <div className="text-[10px] font-medium text-[var(--g4-text-muted)] mb-1 flex items-center gap-1.5 px-1 flex-wrap">
          {message.tierInfo && (
            <span className={`px-1.5 py-0.2 rounded border text-[9px] ${message.tierInfo.badgeColor}`}>
              {message.tierInfo.name} ({message.tierInfo.size})
            </span>
          )}
          {message.isMacro && (
            <span className="px-1.5 py-0.2 rounded border text-[9px] bg-amber-950/40 border-amber-500/40 text-amber-300 flex items-center gap-1">
              <Zap size={10} />
              Host Recipe (0 Tokens)
            </span>
          )}
          {message.durationMs && (
            <span className="text-[9px] text-gray-500">
              {message.durationMs}ms
            </span>
          )}
        </div>

        {/* Content bubble */}
        {message.content && (
          <div
            className="bg-[var(--g4-bg-bubble)] text-[var(--g4-text-main)] px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm g4-prose text-sm w-full"
            dangerouslySetInnerHTML={{ __html: marked(message.content) as string }}
          />
        )}

        {/* Five Primitives Step Trace (Collapsible) */}
        {message.stepTrace && message.stepTrace.length > 0 && (
          <div className="mt-2 w-full border border-gray-700/50 rounded-lg overflow-hidden bg-gray-900/60 text-xs">
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-800 text-gray-300 text-[11px] font-mono cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Terminal size={12} className="text-cyan-400" />
                Harness Trace ({message.stepTrace.length} steps)
              </span>
              {showSteps ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showSteps && (
              <div className="p-2 space-y-1.5 font-mono text-[11px] border-t border-gray-800">
                {message.stepTrace.map((st) => (
                  <div key={st.step} className="p-1.5 rounded bg-black/40 border border-gray-800/80">
                    <div className="flex items-center justify-between text-cyan-300 font-semibold mb-0.5">
                      <span>Step {st.step}: {st.tool}</span>
                      <span className="text-gray-500 text-[10px]">{st.durationMs}ms</span>
                    </div>
                    {st.args && Object.keys(st.args).length > 0 && (
                      <div className="text-gray-400 text-[10px] truncate mb-0.5">
                        Args: {JSON.stringify(st.args)}
                      </div>
                    )}
                    <div className="text-gray-300 text-[10px] line-clamp-2">
                      Obs: {st.observationSummary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legacy Tool calls cards */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="flex flex-col gap-2 mt-2 w-full">
            {message.tool_calls.map((call) => (
              <ToolCallCard key={call.id} toolCall={call} />
            ))}
          </div>
        )}

        {/* Interactive feedback & escalation buttons */}
        <div className="flex items-center gap-2 mt-1.5 px-1 text-xs text-[var(--g4-text-muted)] w-full">
          <span>Was this helpful?</span>
          <button
            onClick={() => message.id && onFeedback?.(message.id, "up")}
            className={`p-1 rounded hover:text-green-400 transition-colors cursor-pointer ${
              message.feedback === "up" ? "text-green-400 font-bold" : ""
            }`}
            title="Helpful response (records golden exemplar)"
          >
            <ThumbsUp size={13} />
          </button>
          <button
            onClick={() => message.id && onFeedback?.(message.id, "down")}
            className={`p-1 rounded hover:text-red-400 transition-colors cursor-pointer ${
              message.feedback === "down" ? "text-red-400 font-bold" : ""
            }`}
            title="Not helpful (records in alignment dataset & escalates)"
          >
            <ThumbsDown size={13} />
          </button>
          <button
            onClick={onEscalate}
            className="ml-auto text-[10px] text-purple-300 hover:text-purple-200 flex items-center gap-0.5 bg-purple-900/30 hover:bg-purple-900/50 px-2 py-0.5 rounded border border-purple-700/40 cursor-pointer transition-colors"
            title="Escalate to more capable tier"
          >
            <span>Escalate model</span>
            <ArrowUpRight size={11} />
          </button>
        </div>
      </div>
    );
  }

  // Tool message
  if (message.role === "tool") {
    return (
      <div className="my-1.5 text-xs text-[var(--g4-text-muted)] bg-[var(--g4-bg-code)] p-2 rounded border border-[var(--g4-border)] font-mono max-w-[90%]">
        <span className="font-semibold text-emerald-400">Result ({message.name}):</span>{" "}
        <span className="text-gray-300 truncate inline-block max-w-full align-bottom">
          {message.content}
        </span>
      </div>
    );
  }

  return null;
}
