import React from "react";
import {
  ShieldCheck,
  Loader2,
  RotateCw,
  HelpCircle,
  ChevronDown,
  Globe,
  CheckCircle2,
  X,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Terminal,
  Zap,
} from "lucide-react";
import { EvalMetrics, EvalTrace } from "../lib/expertJudge";
import { SiteMacroRecipe } from "../lib/recipeStore";

interface EvalsStudioProps {
  evalMetrics: EvalMetrics | null;
  recentTraces: EvalTrace[];
  siteMacros: SiteMacroRecipe[];
  isJudging: boolean;
  expandedTraceId: string | null;
  showGuide: boolean;
  onToggleGuide: () => void;
  onRunBatchJudge: () => void;
  onJudgeSingleTrace: (id: string) => void;
  onRateTrace: (id: string, feedback: "up" | "down") => void;
  onToggleExpandTrace: (id: string) => void;
}

export const EvalsStudio: React.FC<EvalsStudioProps> = ({
  evalMetrics,
  recentTraces,
  siteMacros,
  isJudging,
  expandedTraceId,
  showGuide,
  onToggleGuide,
  onRunBatchJudge,
  onJudgeSingleTrace,
  onRateTrace,
  onToggleExpandTrace,
}) => {
  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
      {/* Header Banner & Guidance */}
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-950/40 via-purple-900/20 to-black/60 border border-purple-700/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-purple-200 text-xs flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-purple-400" />
              <span>Chrome AI Expert Judge & Quality Studio</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Audits agent actions on-device using Chrome's built-in LanguageModel against safety, schema, and completion rubrics.
            </p>
          </div>
          <button
            onClick={onRunBatchJudge}
            disabled={isJudging || recentTraces.length === 0}
            className="text-[10px] bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm shrink-0 font-medium"
            title="Audit all unreviewed traces with Chrome AI"
          >
            {isJudging ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCw size={12} />
            )}
            <span>
              {isJudging ? "Auditing..." : `Audit All (${recentTraces.filter((t) => !t.judgeEvaluation).length})`}
            </span>
          </button>
        </div>

        {/* Collapsible How It Works Guide */}
        <div className="mt-3 pt-2.5 border-t border-purple-800/30">
          <button
            onClick={onToggleGuide}
            className="text-[10px] text-purple-300 hover:text-purple-200 flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            <HelpCircle size={12} />
            <span>How does the Expert Judge work?</span>
            <ChevronDown
              size={11}
              className={`transition-transform duration-200 ${showGuide ? "rotate-180" : ""}`}
            />
          </button>

          {showGuide && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-black/50 border border-purple-800/40 space-y-2 text-[10px] text-gray-300">
              <div className="flex items-start gap-2">
                <span className="font-bold text-purple-400 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/50">
                  1
                </span>
                <div>
                  <strong className="text-gray-200">Autonomous Execution:</strong> The agent uses 5 canonical primitives (<em>browse, sandbox, read/write, search, ask</em>) to complete your prompt.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-purple-400 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/50">
                  2
                </span>
                <div>
                  <strong className="text-gray-200">Chrome AI Audit:</strong> Chrome's local model grades each trace on 4 rubrics: Goal Completion, Schema Integrity, DOM Safety, and Step Efficiency.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-purple-400 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/50">
                  3
                </span>
                <div>
                  <strong className="text-gray-200">Human Alignment & 0-Token Macros:</strong> Rate traces with 👍 or 👎 below. Approved workflows automatically compile into instant, zero-prompt-token deterministic macros!
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quality & Alignment Scorecard */}
      <div className="grid grid-cols-3 gap-2">
        {/* Metric 1: Task Pass Rate */}
        <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800 flex flex-col justify-between">
          <div>
            <div className="text-gray-400 text-[10px] font-medium">Audit Pass Rate</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {evalMetrics?.accuracy ?? 0}%
            </div>
          </div>
          <div className="text-[9px] text-gray-500 mt-1">
            {evalMetrics ? `${evalMetrics.passCount} PASS / ${evalMetrics.failCount} FAIL` : "No audits yet"}
          </div>
        </div>

        {/* Metric 2: Human-AI Agreement */}
        <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800 flex flex-col justify-between">
          <div>
            <div className="text-gray-400 text-[10px] font-medium">Alignment Index</div>
            <div className="text-xs font-bold text-purple-300 mt-0.5 truncate" title={evalMetrics?.kappaInterpretation || "Awaiting Ratings"}>
              {evalMetrics?.kappaInterpretation || "Awaiting Ratings"}
            </div>
          </div>
          <div className="text-[9px] text-gray-500 mt-1">
            κ: {evalMetrics?.cohensKappa ?? 0} ({evalMetrics?.humanEvaluatedCount ?? 0} rated)
          </div>
        </div>

        {/* Metric 3: Site Macros */}
        <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800 flex flex-col justify-between">
          <div>
            <div className="text-gray-400 text-[10px] font-medium">Learned Macros</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              {siteMacros.length}
            </div>
          </div>
          <div className="text-[9px] text-amber-500/80 mt-1">
            0 Token Overhead
          </div>
        </div>
      </div>

      {/* Recent Evaluation Traces - Interactive Inspection */}
      <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
        <div className="flex items-center justify-between mb-2.5">
          <div className="font-semibold text-gray-200 text-xs flex items-center gap-1.5">
            <Globe size={14} className="text-indigo-400" />
            <span>Captured Action Traces</span>
            <span className="text-[10px] font-normal text-gray-500 bg-gray-800 px-1.5 py-0.2 rounded-full">
              {recentTraces.length}
            </span>
          </div>
        </div>

        {recentTraces.length === 0 ? (
          <div className="p-4 text-center rounded-lg bg-black/30 border border-dashed border-gray-800 text-gray-400 space-y-1">
            <p className="text-[11px] font-medium text-gray-300">No traces recorded yet</p>
            <p className="text-[10px] text-gray-500">
              Try typing a command in Chat like <em>"Add 2 widgets to my cart"</em> to watch the agent execute and inspect its trajectory here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentTraces.map((t) => {
              const isExpanded = expandedTraceId === t.id;
              const isJudged = !!t.judgeEvaluation;
              const isPass = t.judgeEvaluation?.label === "PASS";

              return (
                <div
                  key={t.id}
                  className="rounded-lg bg-black/40 border border-gray-800 transition-all hover:border-gray-700 overflow-hidden"
                >
                  {/* Trace Summary Bar */}
                  <div className="p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-200 truncate max-w-[240px] text-[11px]">
                        "{t.userGoal}"
                      </span>

                      {/* Judge Verdict Badge */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {isJudged ? (
                          <span
                            className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              isPass
                                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                                : "bg-rose-950/60 border-rose-500/50 text-rose-300"
                            }`}
                          >
                            {isPass ? <CheckCircle2 size={10} /> : <X size={10} />}
                            <span>{t.judgeEvaluation?.label}</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => onJudgeSingleTrace(t.id)}
                            disabled={isJudging}
                            className="text-[9px] bg-purple-900/60 hover:bg-purple-800/80 border border-purple-600/50 text-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors"
                            title="Audit this trace with Chrome AI"
                          >
                            <Sparkles size={9} className="text-purple-300" />
                            <span>Audit with Chrome AI</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Meta row: Model Tier, Step Count, Human Feedback */}
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-800 px-1.5 py-0.5 rounded text-[9px] text-gray-300">
                          {t.activeTier}
                        </span>
                        <span>{t.trajectory.length} steps</span>
                      </div>

                      {/* Inline Human Rating */}
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-500 mr-1">Feedback:</span>
                        <button
                          onClick={() => onRateTrace(t.id, "up")}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            t.humanFeedback === "up"
                              ? "bg-green-950 border border-green-500 text-green-300"
                              : "hover:bg-gray-800 text-gray-400"
                          }`}
                          title="Approve trace (compiles macro)"
                        >
                          <ThumbsUp size={11} />
                        </button>
                        <button
                          onClick={() => onRateTrace(t.id, "down")}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            t.humanFeedback === "down"
                              ? "bg-red-950 border border-red-500 text-red-300"
                              : "hover:bg-gray-800 text-gray-400"
                          }`}
                          title="Reject trace"
                        >
                          <ThumbsDown size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Quick Toggle for Step Breakdown */}
                    <button
                      onClick={() => onToggleExpandTrace(t.id)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 self-start cursor-pointer mt-0.5 transition-colors font-medium"
                    >
                      <span>
                        {isExpanded ? "Hide trajectory details" : `Inspect ${t.trajectory.length} steps & rubrics`}
                      </span>
                      <ChevronRight
                        size={11}
                        className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Expanded Trajectory View */}
                  {isExpanded && (
                    <div className="p-3 bg-black/60 border-t border-gray-800 space-y-2.5">
                      {/* Chrome AI Rubric Scores (if audited) */}
                      {t.judgeEvaluation && (
                        <div className="p-2.5 rounded bg-purple-950/30 border border-purple-800/40 space-y-1.5">
                          <div className="font-semibold text-purple-300 text-[10px] flex items-center justify-between">
                            <span>Chrome AI Rubric Scores:</span>
                            <span className="font-mono text-purple-400 font-bold">
                              Overall: {Math.round(t.judgeEvaluation.score)}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[9px]">
                            <div className="flex justify-between bg-black/30 p-1 rounded">
                              <span className="text-gray-400">Task Completion:</span>
                              <span className={`font-mono font-semibold ${t.judgeEvaluation.criteria.taskCompletion === "PASS" ? "text-emerald-400" : "text-rose-400"}`}>
                                {t.judgeEvaluation.criteria.taskCompletion}
                              </span>
                            </div>
                            <div className="flex justify-between bg-black/30 p-1 rounded">
                              <span className="text-gray-400">Schema Fidelity:</span>
                              <span className={`font-mono font-semibold ${t.judgeEvaluation.criteria.toolSelection === "PASS" ? "text-emerald-400" : "text-rose-400"}`}>
                                {t.judgeEvaluation.criteria.toolSelection}
                              </span>
                            </div>
                            <div className="flex justify-between bg-black/30 p-1 rounded">
                              <span className="text-gray-400">DOM Safety:</span>
                              <span className={`font-mono font-semibold ${t.judgeEvaluation.criteria.safetyDiscipline === "PASS" ? "text-emerald-400" : "text-rose-400"}`}>
                                {t.judgeEvaluation.criteria.safetyDiscipline}
                              </span>
                            </div>
                            <div className="flex justify-between bg-black/30 p-1 rounded">
                              <span className="text-gray-400">Step Efficiency:</span>
                              <span className={`font-mono font-semibold ${t.judgeEvaluation.criteria.stepEfficiency === "PASS" ? "text-emerald-400" : "text-rose-400"}`}>
                                {t.judgeEvaluation.criteria.stepEfficiency}
                              </span>
                            </div>
                          </div>
                          {t.judgeEvaluation.rationale && (
                            <p className="text-[10px] text-gray-300 italic pt-1 border-t border-purple-900/30">
                              "{t.judgeEvaluation.rationale}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Step by step action sequence */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold text-gray-400">Execution Trajectory:</div>
                        {t.trajectory.map((s) => (
                          <div
                            key={s.step}
                            className="p-1.5 rounded bg-gray-900/80 border border-gray-800 font-mono text-[9px] space-y-0.5"
                          >
                            <div className="flex items-center justify-between text-cyan-400 font-semibold">
                              <span>
                                Step {s.step}: {s.tool}
                              </span>
                              <span className="text-gray-500 font-normal">{s.durationMs}ms</span>
                            </div>
                            {s.args && Object.keys(s.args).length > 0 && (
                              <div className="text-gray-400 truncate">
                                Args: {JSON.stringify(s.args)}
                              </div>
                            )}
                            <div className="text-gray-300 truncate">
                              Obs: {s.observationSummary}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Final Result Message */}
                      <div className="pt-1 border-t border-gray-800 text-[10px]">
                        <span className="text-gray-400 font-medium">Final Output: </span>
                        <span className="text-gray-200">{t.finalOutput}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* The Five Primitives Architecture Reference */}
      <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
        <div className="font-semibold text-gray-200 text-xs mb-2 flex items-center gap-1.5">
          <Terminal size={14} className="text-cyan-400" />
          <span>The Five Primitives Active</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <div className="flex items-center justify-between p-1.5 rounded bg-black/30 border border-gray-800/60">
            <span className="font-mono text-cyan-300">browse</span>
            <span className="text-gray-400 text-[10px]">Snapshot, click, type, extract, see on any DOM</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-black/30 border border-gray-800/60">
            <span className="font-mono text-cyan-300">sandbox</span>
            <span className="text-gray-400 text-[10px]">Detached JS eval (no direct DOM access)</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-black/30 border border-gray-800/60">
            <span className="font-mono text-cyan-300">read / write</span>
            <span className="text-gray-400 text-[10px]">Scratchpad notes & context compaction</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-black/30 border border-gray-800/60">
            <span className="font-mono text-cyan-300">search</span>
            <span className="text-gray-400 text-[10px]">In-page keyword & querySelector match</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-black/30 border border-gray-800/60">
            <span className="font-mono text-cyan-300">ask</span>
            <span className="text-gray-400 text-[10px]">Pause execution for human clarification</span>
          </div>
        </div>
      </div>

      {/* Learned Site Recipes & Golden Exemplars */}
      <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
        <div className="font-semibold text-gray-200 text-xs mb-2 flex items-center gap-1.5">
          <Zap size={14} className="text-amber-400" />
          <span>Learned Site Recipes (0 Token Overhead)</span>
        </div>
        {siteMacros.length === 0 ? (
          <p className="text-[11px] text-gray-400 leading-relaxed">
            No recipes compiled yet. When you give a 👍 to agent actions, repeated flows are automatically compiled into zero-token deterministic macros.
          </p>
        ) : (
          <div className="space-y-1.5">
            {siteMacros.map((macro) => (
              <div key={macro.id} className="p-2 rounded bg-black/40 border border-amber-900/40">
                <div className="font-semibold text-amber-300 text-[11px]">
                  Trigger: "{macro.triggerPhrase}"
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {macro.actions.length} deterministic steps | Run {macro.executionCount} times
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
