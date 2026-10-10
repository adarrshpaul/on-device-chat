import { useState } from "react";
import { marked } from "marked";
import ToolCallCard from "./ToolCallCard";
import { DecisionCard } from "./DecisionCard";
import { ActionOutputCard } from "./ActionOutputCard";
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
  onExecuteAction?: (actionName: string, payload?: Record<string, unknown>) => void;
  onSaveToWorkflow?: (title: string, actionName: string, target?: string) => void;
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
  onExecuteAction,
  onSaveToWorkflow,
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

  // User message: right-aligned, slightly lighter fill, full content width minus padding
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-white/10 text-white px-3.5 py-2.5 rounded-[8px] max-w-[85%] text-[16px] leading-[1.5] border border-white/8 select-text">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message: full-width, NO bubble, 16px body floor, with small model label and monospace tool row
  if (message.role === "assistant") {
    const toolSummary = message.stepTrace ? formatToolSummary(message.stepTrace) : "";

    return (
      <div className="flex flex-col mb-4 items-start w-full">
        {/* Action Output Card (if direct 1-click button or workflow step was run) */}
        {message.actionOutput && (
          <div className="mb-2 w-full">
            <ActionOutputCard
              output={message.actionOutput}
              onRepeat={
                onExecuteAction
                  ? () => onExecuteAction(message.actionOutput!.action, { target: message.actionOutput!.target })
                  : undefined
              }
              onSaveToWorkflow={
                onSaveToWorkflow
                  ? () =>
                      onSaveToWorkflow(
                        `${message.actionOutput!.action} action`,
                        message.actionOutput!.action,
                        message.actionOutput!.target
                      )
                  : undefined
              }
            />
          </div>
        )}

        {/* Small model label + latency */}
        <div className="text-[12px] font-medium text-gray-400 mb-1 flex items-center gap-1.5 select-none">
          <span>{message.tierInfo?.name || "Gemini Nano"}</span>
          {message.durationMs && (
            <span className="text-[11px] text-gray-500 font-mono">
              · {message.durationMs}ms
            </span>
          )}
        </div>

        {/* Monospace Tool Row when tools execute */}
        {message.stepTrace && message.stepTrace.length > 0 && (
          <div className="mb-2 w-full">
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="text-[12px] font-mono text-gray-300 hover:text-white bg-white/4 hover:bg-white/8 px-2.5 py-1.5 rounded-[6px] border border-white/8 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Terminal size={12} className="text-purple-400 shrink-0" />
              <span>{toolSummary}</span>
              {showSteps ? (
                <ChevronDown size={12} className="text-gray-400 ml-1" />
              ) : (
                <ChevronRight size={12} className="text-gray-400 ml-1" />
              )}
            </button>

            {showSteps && (
              <div className="mt-1.5 p-2 space-y-1 font-mono text-[11px] bg-black/40 border border-white/6 rounded-[6px]">
                {message.stepTrace.map((st) => (
                  <div key={st.step} className="text-gray-400 text-[11px] py-0.5 border-b border-white/5 last:border-0">
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
            <DecisionCard
              decision={message.decision}
              onSelectOption={onSelectOption}
              onExecuteAction={onExecuteAction}
              onSaveToWorkflow={onSaveToWorkflow}
            />
          </div>
        )}

        {/* Flat Text Content (No card bubble, blends into thread, 16px body floor) */}
        {message.content && (
          <div
            className="g4-prose text-[16px] leading-[1.5] text-gray-100 w-full select-text"
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

        {/* Actions under bubble: Copy, Thumbs Up, Thumbs Down (Max 3 visible actions, accessible tap targets) */}
        <div className="flex items-center gap-1.5 mt-2 text-gray-400 select-none">
          <button
            onClick={() => {
              if (message.content && typeof navigator !== "undefined") {
                navigator.clipboard.writeText(message.content);
              }
            }}
            className="w-8 h-8 rounded-[6px] hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Copy response"
            aria-label="Copy response"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
          <button
            onClick={() => message.id && onFeedback?.(message.id, "up")}
            className={`w-8 h-8 rounded-[6px] hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors cursor-pointer ${
              message.feedback === "up" ? "text-purple-400 font-bold bg-white/10" : ""
            }`}
            title="Helpful"
            aria-label="Helpful"
          >
            <ThumbsUp size={13} />
          </button>
          <button
            onClick={() => message.id && onFeedback?.(message.id, "down")}
            className={`w-8 h-8 rounded-[6px] hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors cursor-pointer ${
              message.feedback === "down" ? "text-red-400 font-bold bg-white/10" : ""
            }`}
            title="Not helpful"
            aria-label="Not helpful"
          >
            <ThumbsDown size={13} />
          </button>
          {message.feedback === "down" && onEscalate && (
            <button
              onClick={onEscalate}
              className="ml-auto text-[11px] text-purple-400 hover:text-purple-300 font-medium px-2 py-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
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
