import React, { useState } from "react";
import { Clock, ChevronRight } from "lucide-react";
import { PlanSummarySheet } from "./PlanSummarySheet";
import type { PlanState } from "../lib/todoManager";
import type { AgentStepTrace } from "../lib/expertJudge";

export interface ThinkingAccordionProps {
  title?: string;
  plan?: PlanState | null;
  stepTrace?: AgentStepTrace[];
  durationMs?: number;
  tokensSavedPct?: number;
  thinking?: string;
  isLive?: boolean;
}

export const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({
  title,
  plan,
  stepTrace,
  durationMs,
  tokensSavedPct = 61,
  thinking,
  isLive = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Derive label: active milestone, or custom title, or fallback to first task
  const activeTask =
    plan?.tasks.find((t) => t.status === "in_progress") ||
    plan?.tasks.find((t) => t.status === "completed") ||
    plan?.tasks[0];

  const displayTitle =
    title ||
    activeTask?.title ||
    (stepTrace && stepTrace.length > 0 && stepTrace[stepTrace.length - 1]?.observationSummary
      ? stepTrace[stepTrace.length - 1].observationSummary
      : "Auditing page layout and constraints...");

  // Truncate to match Claude mobile screenshot aesthetic
  const truncated =
    displayTitle.length > 34 ? `${displayTitle.slice(0, 32)}...` : displayTitle;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group inline-flex items-center gap-2 py-1 px-2.5 rounded-full text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-all text-[13px] font-sans cursor-pointer select-none border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700/60 my-1"
        aria-label="View thinking and execution summary"
      >
        <span className="flex items-center justify-center text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors">
          <Clock size={14} className={isLive ? "animate-spin text-sky-500" : ""} />
        </span>
        <span className="truncate max-w-[240px] sm:max-w-[320px] text-neutral-600 dark:text-neutral-300">
          {truncated}
        </span>
        <ChevronRight
          size={14}
          className="text-neutral-400 group-hover:translate-x-0.5 transition-transform"
        />
      </button>

      <PlanSummarySheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        plan={plan}
        stepTrace={stepTrace}
        activeMilestoneTitle={displayTitle}
        durationMs={durationMs}
        tokensSavedPct={tokensSavedPct}
        thinking={thinking}
      />
    </>
  );
};
