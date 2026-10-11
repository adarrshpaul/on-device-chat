import React from "react";
import { Trophy, Flame, Square, Sparkles, Activity } from "lucide-react";
import { GameProgressEvent } from "../lib/canvasGameController";

interface GameAutopilotCardProps {
  progress: GameProgressEvent & { isFinished?: boolean; summary?: string };
  onStop?: () => void;
}

export const GameAutopilotCard: React.FC<GameAutopilotCardProps> = ({ progress, onStop }) => {
  const isFinished = !!progress.isFinished;

  return (
    <div className="my-2.5 rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-950/40 to-slate-900/80 p-3.5 shadow-lg backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-amber-200">
              {isFinished ? "Game Session Complete" : "Autonomous Game Autopilot"}
            </h4>
            <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
              <Activity className="h-3 w-3 animate-pulse text-emerald-400" />
              60Hz Physics Trajectory Optimization
            </p>
          </div>
        </div>

        {!isFinished && onStop && (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        )}
      </div>

      {/* Main Scoreboard */}
      <div className="my-3 flex items-center justify-between rounded-lg bg-black/40 px-3.5 py-2.5 border border-amber-500/20">
        <div>
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Current Score</span>
          <div className="text-2xl font-black text-amber-300 tracking-tight font-mono">
            {progress.score}
          </div>
        </div>

        {progress.combo > 0 && (
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            progress.turbo 
              ? "bg-orange-600/30 text-orange-300 border border-orange-500/50 animate-pulse" 
              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
          }`}>
            <Flame className="h-3.5 w-3.5 fill-current text-orange-400" />
            <span>Combo x{progress.combo}{progress.turbo ? " TURBO!" : ""}</span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-slate-800/40 p-2 border border-slate-700/50">
          <span className="text-slate-400 text-[10px]">Total Jumps</span>
          <div className="font-semibold text-slate-200 mt-0.5">{progress.totalJumps} actions</div>
        </div>

        <div className="rounded-lg bg-slate-800/40 p-2 border border-slate-700/50">
          <span className="text-slate-400 text-[10px]">Elapsed Time</span>
          <div className="font-semibold text-slate-200 mt-0.5">{progress.elapsedSec}s elapsed</div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-300">
        <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span className="truncate">
          {progress.summary || progress.statusText || "Predicting ball parabolas & executing timed jumps..."}
        </span>
      </div>
    </div>
  );
};
