import React from "react";
import { CheckCircle2, AlertCircle, RefreshCw, BookmarkPlus, Zap, ArrowRight } from "lucide-react";
import type { ActionExecutionOutput } from "../lib/types";

interface ActionOutputCardProps {
  output: ActionExecutionOutput;
  onRepeat?: () => void;
  onSaveToWorkflow?: () => void;
}

export const ActionOutputCard: React.FC<ActionOutputCardProps> = ({
  output,
  onRepeat,
  onSaveToWorkflow,
}) => {
  const isSuccess = output.status === "success";

  return (
    <div
      data-testid="action-output-card"
      className="my-2 p-2.5 rounded-[8px] bg-[#0c1222] border border-white/10 text-xs shadow-md animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-white/6">
        <div className="flex items-center gap-1.5 min-w-0">
          {isSuccess ? (
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
          )}
          <span className="font-semibold text-gray-200 truncate capitalize">
            {output.action} Action Output
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 shrink-0">
          <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/6 text-emerald-300">
            {output.durationMs}ms
          </span>
          <span className="text-gray-500">· 0 tokens</span>
        </div>
      </div>

      {/* Target & Summary */}
      <div className="pt-2 space-y-1.5">
        <div className="flex items-start gap-1 text-[11px] text-gray-300">
          <ArrowRight size={12} className="text-purple-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 leading-snug">
            <span className="text-gray-400 font-mono text-[10px] mr-1">Target:</span>
            <span className="font-mono text-purple-200 font-medium">{output.target}</span>
          </div>
        </div>

        <div className="text-[11px] text-gray-200 bg-black/40 p-1.5 rounded-[6px] border border-white/5 font-sans leading-relaxed">
          {output.outputSummary}
        </div>

        {/* DOM Delta state */}
        {output.domDelta && (
          <div className="p-1.5 rounded-[5px] bg-purple-950/20 border border-purple-500/20 text-[10px] font-mono text-purple-300 flex items-center justify-between">
            <div className="truncate flex items-center gap-1">
              <Zap size={11} className="text-purple-400 shrink-0" />
              <span>{output.domDelta.description}</span>
            </div>
            {output.domDelta.afterState && (
              <span className="text-gray-400 text-[9px] shrink-0 ml-1">
                [{output.domDelta.afterState}]
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="mt-2 pt-1.5 border-t border-white/6 flex items-center justify-between text-[10px]">
        {onSaveToWorkflow && (
          <button
            onClick={onSaveToWorkflow}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-purple-950/40"
            title="Save this action as a repeated workflow button"
          >
            <BookmarkPlus size={11} />
            <span>Save to Workflows</span>
          </button>
        )}

        {onRepeat && (
          <button
            onClick={onRepeat}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-white/5 ml-auto"
            title="Execute this action again"
          >
            <RefreshCw size={11} />
            <span>Repeat</span>
          </button>
        )}
      </div>
    </div>
  );
};
