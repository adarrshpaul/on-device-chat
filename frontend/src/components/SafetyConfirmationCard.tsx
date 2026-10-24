/**
 * Safety Confirmation Card (TASK-112 / TASK-117)
 *
 * Prompts the user before executing irreversible, destructive, or financial actions.
 * Guarantees fail-closed human-in-the-loop verification.
 */

import React from "react";
import { ShieldAlert, Check, X } from "lucide-react";
import type { SafetyClassification } from "../lib/safetyGate";

export interface SafetyConfirmationCardProps {
  classification: SafetyClassification;
  onApprove: () => void;
  onReject: () => void;
}

export const SafetyConfirmationCard: React.FC<SafetyConfirmationCardProps> = ({
  classification,
  onApprove,
  onReject,
}) => {
  const category = classification.category || "destructive";
  const categoryLabels: Record<string, string> = {
    financial: "Financial Payment / Checkout",
    destructive: "Destructive / Irreversible Mutation",
    communication: "Irreversible Communication / Post",
    transfer: "Asset / Fund Transfer",
  };

  const categoryColor: Record<string, string> = {
    financial: "border-amber-500/50 bg-amber-950/40 text-amber-200",
    destructive: "border-rose-500/50 bg-rose-950/40 text-rose-200",
    communication: "border-sky-500/50 bg-sky-950/40 text-sky-200",
    transfer: "border-purple-500/50 bg-purple-950/40 text-purple-200",
  };

  return (
    <div
      data-testid="safety-confirmation-card"
      className={`mx-3 my-2 p-3.5 rounded-xl border backdrop-blur-md shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-2 ${
        categoryColor[category] || "border-rose-500/50 bg-rose-950/40 text-rose-200"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 rounded-lg bg-black/40 text-rose-400 shrink-0">
          <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/50 border border-white/10">
              {categoryLabels[category] || "Approval Required"}
            </span>
            <span className="text-[10px] text-gray-400 truncate">
              {classification.origin}
            </span>
          </div>

          <h4 className="text-xs font-semibold text-white mb-1">
            Action requires explicit confirmation:
          </h4>

          <p className="text-[11px] text-gray-300 bg-black/30 p-2 rounded border border-white/5 font-mono break-all mb-2.5">
            {classification.reason || classification.targetDescription}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              data-testid="safety-approve-btn"
              onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-medium transition-all shadow-lg"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve Action</span>
            </button>
            <button
              data-testid="safety-reject-btn"
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 text-gray-200 text-xs font-medium transition-all border border-white/10"
            >
              <X className="w-3.5 h-3.5" />
              <span>Deny (Block)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SafetyConfirmationCard;
