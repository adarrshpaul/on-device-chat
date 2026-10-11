import React, { useState } from "react";
import { CheckCircle2, AlertCircle, Play, Square, RefreshCw, CheckSquare, Square as UncheckedSquare, Layers, ShieldCheck } from "lucide-react";
import type { BatchProposal } from "../lib/types";

interface BatchConfirmationCardProps {
  proposal: BatchProposal;
  onApprove: (updatedProposal: BatchProposal) => void;
  onCancel?: (proposalId: string) => void;
  onAbort?: () => void;
  isExecuting?: boolean;
}

export const BatchConfirmationCard: React.FC<BatchConfirmationCardProps> = ({
  proposal: initialProposal,
  onApprove,
  onCancel,
  onAbort,
  isExecuting = false,
}) => {
  const [proposal, setProposal] = useState<BatchProposal>(initialProposal);

  // Sync state if initialProposal changes from parent execution
  React.useEffect(() => {
    setProposal(initialProposal);
  }, [initialProposal]);

  const selectedCount = proposal.entities.filter((e) => e.selected).length;
  const totalCount = proposal.entities.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  const toggleSelectAll = () => {
    if (isExecuting || proposal.executionStatus === "running") return;
    const nextVal = !allSelected;
    setProposal((prev) => ({
      ...prev,
      entities: prev.entities.map((e) => ({ ...e, selected: nextVal })),
    }));
  };

  const toggleEntity = (entityId: string) => {
    if (isExecuting || proposal.executionStatus === "running") return;
    setProposal((prev) => ({
      ...prev,
      entities: prev.entities.map((e) =>
        e.id === entityId ? { ...e, selected: !e.selected } : e
      ),
    }));
  };

  const isCompleted = proposal.executionStatus === "completed";
  const isRunning = isExecuting || proposal.executionStatus === "running";

  return (
    <div
      data-testid="batch-confirmation-card"
      className="my-3 p-3.5 rounded-[10px] bg-[#0c1222] border border-purple-500/20 text-xs shadow-xl animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/8">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-purple-500/10 text-purple-400">
            <Layers size={14} />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-gray-100 truncate block text-[13px]">
              {proposal.title}
            </span>
            <span className="text-[10px] text-gray-400 block truncate">
              {proposal.summary}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-500/30 text-purple-300 text-[10px] font-mono flex items-center gap-1">
            <ShieldCheck size={11} className="text-purple-400" />
            <span>0 Tokens</span>
          </span>
        </div>
      </div>

      {/* Confirmation Banner / Safety Notice */}
      {!isRunning && !isCompleted && (
        <div className="mt-2.5 px-2.5 py-1.5 rounded-[6px] bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between">
          <span>
            ⚠️ <strong>Human Confirmation Gate:</strong> Deselect any items you do not wish to process.
          </span>
          <span className="font-mono text-[10px] text-amber-400 shrink-0 ml-2">
            {selectedCount} of {totalCount} selected
          </span>
        </div>
      )}

      {/* Entity Selection & Progress Table */}
      <div className="mt-2.5 max-h-56 overflow-y-auto rounded-[6px] border border-white/6 bg-black/30 divide-y divide-white/5">
        {/* Table Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/5 text-[10px] text-gray-400 font-medium">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={isRunning}
            className="flex items-center gap-1.5 hover:text-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {allSelected ? (
              <CheckSquare size={13} className="text-purple-400" />
            ) : (
              <UncheckedSquare size={13} className="text-gray-500" />
            )}
            <span>Select All ({totalCount})</span>
          </button>
          <span>Execution State</span>
        </div>

        {/* Entity Rows */}
        {proposal.entities.map((entity) => (
          <div
            key={entity.id}
            className={`flex items-center justify-between px-2.5 py-1.5 transition-colors text-[11px] ${
              entity.selected ? "bg-white/[0.02]" : "opacity-50 bg-black/40"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <button
                type="button"
                onClick={() => toggleEntity(entity.id)}
                disabled={isRunning}
                className="shrink-0 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {entity.selected ? (
                  <CheckSquare size={13} className="text-purple-400" />
                ) : (
                  <UncheckedSquare size={13} className="text-gray-600" />
                )}
              </button>
              <div className="min-w-0">
                <span className="font-medium text-gray-200 truncate block">
                  {entity.name}
                </span>
                {entity.status && (
                  <span className="text-[9px] font-mono text-gray-500 truncate block">
                    status: {entity.status}
                  </span>
                )}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="shrink-0 text-[10px] font-mono">
              {entity.executionState === "pending" && (
                <span className="text-gray-400">⏳ Pending</span>
              )}
              {entity.executionState === "running" && (
                <span className="text-purple-400 animate-pulse font-semibold">
                  ⚡ Running...
                </span>
              )}
              {entity.executionState === "success" && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  <span>Done {entity.durationMs ? `(${entity.durationMs}ms)` : ""}</span>
                </span>
              )}
              {entity.executionState === "failed" && (
                <span className="text-rose-400 flex items-center gap-1" title={entity.error}>
                  <AlertCircle size={11} />
                  <span>Failed</span>
                </span>
              )}
              {entity.executionState === "skipped" && (
                <span className="text-gray-600">⚪ Skipped</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progress / Summary Bar */}
      {isCompleted && (
        <div className="mt-2.5 p-2 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span>
              Batch complete: <strong>{proposal.succeededCount || 0}</strong> succeeded,{" "}
              <strong>{proposal.failedCount || 0}</strong> failed
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400/80">0 API Tokens</span>
        </div>
      )}

      {/* Actions Footer */}
      <div className="mt-3 pt-2 border-t border-white/8 flex items-center justify-between">
        {!isRunning && !isCompleted && (
          <>
            {onCancel && (
              <button
                type="button"
                onClick={() => onCancel(proposal.id)}
                className="px-2.5 py-1 text-gray-400 hover:text-gray-200 text-[11px] transition-colors rounded hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={() => onApprove(proposal)}
              disabled={selectedCount === 0}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Play size={12} className="fill-current" />
              <span>Approve & Run Batch ({selectedCount} items)</span>
            </button>
          </>
        )}

        {isRunning && (
          <div className="w-full flex items-center justify-between">
            <span className="text-[11px] text-purple-300 flex items-center gap-1.5 animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              <span>Executing batch operations locally...</span>
            </span>
            {onAbort && (
              <button
                type="button"
                onClick={onAbort}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] cursor-pointer"
              >
                <Square size={11} className="fill-current" />
                <span>Abort</span>
              </button>
            )}
          </div>
        )}

        {isCompleted && (
          <button
            type="button"
            onClick={() => {
              // Reset execution states for repeat
              setProposal((prev) => ({
                ...prev,
                executionStatus: "proposed",
                entities: prev.entities.map((e) => ({ ...e, executionState: "pending" })),
              }));
            }}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 rounded transition-colors text-[11px] cursor-pointer"
          >
            <RefreshCw size={11} />
            <span>Re-configure / Repeat</span>
          </button>
        )}
      </div>
    </div>
  );
};
