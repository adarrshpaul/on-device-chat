import { useState } from "react";
import { marked } from "marked";
import ToolCallCard from "./ToolCallCard";
import { DecisionCard } from "./DecisionCard";
import type { DisplayMessage } from "../hooks/useChat";
import {
  ThumbsUp,
  ThumbsDown,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Terminal,
} from "lucide-react";
import type { AgentStepTrace } from "../lib/expertJudge";

interface MessageBubbleProps {
  message: DisplayMessage;
  onFeedback?: (messageId: string, feedback: "up" | "down") => void;
  onEscalate?: () => void;
  onSelectOption?: (optionLabel: string) => void;
}

function formatToolSummary(trace: AgentStepTrace[]): string {
  if (!trace || trace.length === 0) return "";
  const inspectStep = trace.find(
    (s) =>
      s.tool === "browse" &&
      (s.args?.action === "inspect" || s.args?.action === "see")
  );
  if (inspectStep) {
    return "inspected page elements";
  }
  const clickStep = trace.find(
    (s) => s.tool === "browse" && s.args?.action === "click"
  );
  if (clickStep) {
    const sel = (clickStep.args?.selector as string) || "element";
    return `clicked ${sel}`;
  }
  if (trace.length === 1) {
    return `executed ${trace[0].tool}`;
  }
  return `executed ${trace.length} harness steps`;
}

export default function MessageBubble({
  message,
  onFeedback,
  onEscalate,
  onSelectOption,
}: MessageBubbleProps) {
  const [showSteps, setShowSteps] = useState(false);

  // System or escalation alert notice
  if (message.isEscalationNotice || message.role === "system") {
    return (
      <div className="my-2.5 px-3 py-2 rounded-[6px] bg-purple-950/30 border border-purple-500/30 text-purple-200 text-[12px] flex items-start gap-2">
        <ShieldAlert size={14} className="text-purple-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-purple-300 text-[11px] mb-0.5">
            Model Escalation Triggered
          </div>
          <div
            className="g4-prose text-[12px]"
            dangerouslySetInnerHTML={{ __html: marked(message.content || "") as string }}
          />
        </div>
      </div>
    );
  }

  // User message: right-aligned, slightly lighter fill, no heavy gradient
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-white/10 text-white px-3.5 py-2 rounded-[8px] max-w-[85%] text-[13px] leading-relaxed border border-white/8 select-text">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message: full-width, NO bubble, with small model label and monospace tool row
  if (message.role === "assistant") {
    const toolSummary = message.stepTrace ? formatToolSummary(message.stepTrace) : "";

    return (
      <div className="flex flex-col mb-4 items-start w-full">
        {/* Small model label + latency */}
        <div className="text-[11px] font-medium text-gray-400 mb-1 flex items-center gap-1.5 select-none">
          <span>{message.tierInfo?.name || "Gemini Nano"}</span>
          {message.durationMs && (
            <span className="text-[10px] text-gray-500 font-mono">
              · {message.durationMs}ms
            </span>
          )}
        </div>

        {/* Monospace Tool Row when tools execute */}
        {message.stepTrace && message.stepTrace.length > 0 && (
          <div className="mb-2 w-full">
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="text-[11px] font-mono text-gray-400 hover:text-gray-200 bg-white/4 hover:bg-white/8 px-2 py-1 rounded-[6px] border border-white/6 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Terminal size={11} className="text-purple-400 shrink-0" />
              <span>{toolSummary}</span>
              {showSteps ? (
                <ChevronDown size={11} className="text-gray-500 ml-1" />
              ) : (
                <ChevronRight size={11} className="text-gray-500 ml-1" />
              )}
            </button>

            {showSteps && (
              <div className="mt-1.5 p-2 space-y-1 font-mono text-[11px] bg-black/40 border border-white/6 rounded-[6px]">
                {message.stepTrace.map((st) => (
                  <div key={st.step} className="text-gray-400 text-[10px] py-0.5 border-b border-white/5 last:border-0">
                    <span className="text-purple-300 font-semibold">Step {st.step}: {st.tool}</span>
                    {st.observationSummary && (
                      <span className="text-gray-300 ml-1.5 truncate inline-block max-w-[280px] align-bottom">
                        • {st.observationSummary}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Decision Card (if calibrated choice alternatives exist) */}
        {message.decision && (
          <div className="mb-2 w-full">
            <DecisionCard decision={message.decision} onSelectOption={onSelectOption} />
          </div>
        )}

        {/* Flat Text Content (No card bubble, blends into thread) */}
        {message.content && (
          <div
            className="g4-prose text-[13.5px] leading-relaxed text-gray-100 w-full select-text"
            dangerouslySetInnerHTML={{ __html: marked(message.content) as string }}
          />
        )}

        {/* Legacy Tool Calls Cards */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2 w-full">
            {message.tool_calls.map((call) => (
              <ToolCallCard key={call.id} toolCall={call} />
            ))}
          </div>
        )}

        {/* Quiet inline feedback */}
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500 select-none">
          <button
            onClick={() => message.id && onFeedback?.(message.id, "up")}
            className={`p-0.5 rounded hover:text-gray-300 cursor-pointer transition-colors ${
              message.feedback === "up" ? "text-purple-400 font-bold" : ""
            }`}
            title="Helpful"
          >
            <ThumbsUp size={11} />
          </button>
          <button
            onClick={() => message.id && onFeedback?.(message.id, "down")}
            className={`p-0.5 rounded hover:text-gray-300 cursor-pointer transition-colors ${
              message.feedback === "down" ? "text-red-400 font-bold" : ""
            }`}
            title="Not helpful"
          >
            <ThumbsDown size={11} />
          </button>
          {message.feedback === "down" && onEscalate && (
            <button
              onClick={onEscalate}
              className="ml-auto text-[10px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer transition-colors"
              title="Escalate model tier"
            >
              Try stronger model
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
