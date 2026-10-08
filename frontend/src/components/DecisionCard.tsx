import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Info,
  Compass,
} from "lucide-react";
import type { DecisionTrace } from "../lib/types";

interface DecisionCardProps {
  decision: DecisionTrace;
  onSelectOption?: (optionLabel: string) => void;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  onSelectOption,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showEvidence, setShowEvidence] = useState<boolean>(false);

  const confidencePct = Math.round(decision.confidence * 100);

  // Confidence color grading
  const getConfidenceTheme = (pct: number) => {
    if (pct >= 85) {
      return {
        badgeBg: "bg-emerald-950/60 border-emerald-500/40 text-emerald-300",
        barFill: "from-emerald-500 to-teal-400",
        glow: "shadow-[0_0_12px_rgba(16,185,129,0.25)]",
        statusText: "High Calibration",
      };
    }
    if (pct >= 65) {
      return {
        badgeBg: "bg-amber-950/60 border-amber-500/40 text-amber-300",
        barFill: "from-amber-500 to-yellow-400",
        glow: "shadow-[0_0_12px_rgba(245,158,11,0.25)]",
        statusText: "Moderate Calibration",
      };
    }
    return {
      badgeBg: "bg-rose-950/60 border-rose-500/40 text-rose-300",
      barFill: "from-rose-500 to-red-400",
      glow: "shadow-[0_0_12px_rgba(244,63,94,0.25)]",
      statusText: "Ambiguous Gating",
    };
  };

  const theme = getConfidenceTheme(confidencePct);

  return (
    <div
      data-testid="decision-card"
      className="my-2 w-full rounded-[8px] bg-[#0c101d] border border-white/8 overflow-hidden transition-all duration-200"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/30 border-b border-white/6">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
            {decision.type === "macro" ? (
              <Zap size={13} className="text-amber-400" />
            ) : decision.hallucinationShield?.verified ? (
              <ShieldCheck size={13} className="text-emerald-400" />
            ) : (
              <Compass size={13} className="text-cyan-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-gray-200 truncate flex items-center gap-1.5">
              <span>{decision.title}</span>
              {decision.margin !== undefined && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/50 text-purple-300 border border-purple-500/30">
                  +{Math.round(decision.margin * 100)}% margin
                </span>
              )}
              {decision.engineUsed && (
                <span className="text-[9px] font-normal px-1.5 py-0.2 rounded bg-black/40 text-gray-400 border border-gray-800 hidden sm:inline-block">
                  {decision.engineUsed}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Calibrated Confidence Badge */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-medium ${theme.badgeBg} ${theme.glow}`}
            title={`Calibrated Confidence: ${confidencePct}%`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span>{confidencePct}%</span>
          </div>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800/50 transition-colors cursor-pointer"
            aria-label={isExpanded ? "Collapse Decision Details" : "Expand Decision Details"}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Main Body */}
      {isExpanded && (
        <div className="p-3 space-y-2.5 text-xs">
          {/* User Control & Steering Banner */}
          {decision.needsClarification ? (
            <div className="p-2.5 rounded-[6px] bg-purple-950/30 border border-purple-500/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-purple-300 text-[11px] font-medium">
                <Sliders size={13} className="text-purple-400 shrink-0" />
                <span>Ambiguous Intent — Tap an option to steer the agent:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {decision.distribution?.map((alt, idx) => {
                  const altScorePct = Math.round(alt.score * 100);
                  return (
                    <button
                      key={idx}
                      onClick={() => onSelectOption?.(alt.label)}
                      className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                        alt.isWinner
                          ? "bg-purple-600 text-white shadow-sm hover:bg-purple-500"
                          : "bg-white/6 hover:bg-purple-900/40 text-gray-200 border border-white/10 hover:border-purple-500/40"
                      }`}
                    >
                      <span>{alt.label}</span>
                      <span className="text-[9px] font-mono opacity-70">({altScorePct}%)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Primary Routed Decision Banner */
            <div className="flex items-start gap-2 p-2 rounded-[6px] bg-black/40 border border-gray-800">
              <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400 flex items-center justify-between">
                  <span>Selected Action</span>
                  {decision.latencyMs !== undefined && (
                    <span className="text-gray-500 lowercase font-normal">
                      {decision.latencyMs}ms · 0 tokens
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-medium text-emerald-200 truncate mt-0.5">
                  {decision.selectedOption}
                </div>
              </div>
            </div>
          )}

          {/* Quick Choice / Steer Pills (When not in clarification mode, user can still override) */}
          {!decision.needsClarification && decision.distribution && decision.distribution.length > 1 && (
            <div className="pt-0.5">
              <div className="text-[10px] font-mono text-gray-400 mb-1 flex items-center justify-between">
                <span>STEER OR OVERRIDE:</span>
                <span className="text-[9px] text-gray-500">Click to switch</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {decision.distribution.map((alt, idx) => {
                  const altScorePct = Math.round(alt.score * 100);
                  const isWinner = Boolean(alt.isWinner);
                  return (
                    <button
                      key={idx}
                      onClick={() => onSelectOption?.(alt.label)}
                      className={`px-2 py-0.5 rounded-[5px] text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                        isWinner
                          ? "bg-purple-950/60 border border-purple-500/40 text-purple-200"
                          : "bg-white/4 hover:bg-purple-900/30 text-gray-300 border border-white/6 hover:border-purple-500/30"
                      }`}
                      title={isWinner ? "Active choice" : `Override and execute "${alt.label}"`}
                    >
                      {isWinner && <Zap size={10} className="text-purple-400" />}
                      <span className="truncate max-w-[140px]">{alt.label}</span>
                      <span className="text-[9px] font-mono opacity-60">{altScorePct}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Jev Hallucination Shield Notice (Noul DOM Evidence Verification) */}
          {decision.hallucinationShield && (
            <div
              className={`flex items-start gap-1.5 p-2 rounded-[6px] border text-[11px] ${
                decision.hallucinationShield.verified
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-950/30 border-amber-500/30 text-amber-300"
              }`}
            >
              {decision.hallucinationShield.verified ? (
                <ShieldCheck size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <ShieldAlert size={14} className="text-amber-400 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium flex items-center justify-between">
                  <span>
                    {decision.hallucinationShield.verified
                      ? "Zero Hallucination Shield: Verified"
                      : "Unverified Target Warning"}
                  </span>
                  <span className="font-mono text-[9px] opacity-75">
                    P(true) = {decision.hallucinationShield.probability}
                  </span>
                </div>
                <div className="text-[10px] opacity-85 mt-0.5">
                  {decision.hallucinationShield.check}
                  {decision.hallucinationShield.evidenceSelector && (
                    <span className="font-mono ml-1 text-gray-300">
                      [`{decision.hallucinationShield.evidenceSelector}`]
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Toggle: "Why this action?" Explainability Inspector */}
          <div className="pt-1">
            <button
              onClick={() => setShowEvidence(!showEvidence)}
              className="text-[10px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Info size={11} />
              <span>{showEvidence ? "Hide decision ledger" : "Why this action? (Inspect evidence)"}</span>
            </button>

            {showEvidence && (
              <div className="mt-2 p-2.5 rounded-[6px] bg-black/50 border border-white/6 space-y-2 text-[10px] font-mono">
                {decision.explanation && (
                  <div className="text-gray-300 leading-relaxed font-sans text-[11px]">
                    {decision.explanation}
                  </div>
                )}

                {/* Probability Distribution Breakdown */}
                {decision.distribution && decision.distribution.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-white/6">
                    <div className="flex items-center justify-between text-gray-500 text-[9px]">
                      <span>CANDIDATE OPTION</span>
                      <span>CALIBRATED PROBABILITY</span>
                    </div>

                    {decision.distribution.map((alt, idx) => {
                      const altScorePct = Math.round(alt.score * 100);
                      const isWinner = Boolean(alt.isWinner);

                      return (
                        <div
                          key={idx}
                          className="relative overflow-hidden rounded p-1 border border-white/4 bg-white/2"
                        >
                          <div
                            className={`absolute left-0 top-0 bottom-0 opacity-20 pointer-events-none ${
                              isWinner ? "bg-purple-500" : "bg-gray-500"
                            }`}
                            style={{ width: `${Math.max(4, altScorePct)}%` }}
                          />
                          <div className="relative flex items-center justify-between z-10 text-[10px]">
                            <span className={isWinner ? "text-white font-medium" : "text-gray-400"}>
                              {alt.label}
                            </span>
                            <span className="font-mono text-gray-400">{altScorePct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
