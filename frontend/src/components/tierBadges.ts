import { Zap, Sparkles, ScanSearch, Brain, Gem, type LucideIcon } from "lucide-react";
import { ModelTier } from "../lib/escalationManager";

// Compact, never-truncating display identity for each tier (header pill + tier menu).
// Class strings are kept literal so Tailwind CSS can find them at compile time.
export interface TierBadge {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  pillClass: string;
  pillOpenClass: string;
  rowSelectedClass: string;
}

export const TIER_BADGES: Record<ModelTier, TierBadge> = {
  [ModelTier.TIER_1_5_LAYA_DECISION]: {
    label: "Reflex",
    icon: Zap,
    iconClass: "text-cyan-300",
    pillClass: "bg-cyan-500/10 border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/20 hover:border-cyan-400/50",
    pillOpenClass: "bg-cyan-500/20 border-cyan-400/60 text-cyan-100 ring-2 ring-cyan-400/20",
    rowSelectedClass: "bg-cyan-500/10 border-cyan-400/40",
  },
  [ModelTier.TIER_0_GEMINI_NANO]: {
    label: "Nano",
    icon: Sparkles,
    iconClass: "text-blue-300",
    pillClass: "bg-blue-500/10 border-blue-400/30 text-blue-100 hover:bg-blue-500/20 hover:border-blue-400/50",
    pillOpenClass: "bg-blue-500/20 border-blue-400/60 text-blue-100 ring-2 ring-blue-400/20",
    rowSelectedClass: "bg-blue-500/10 border-blue-400/40",
  },
  [ModelTier.TIER_1_MINILM_ROUTER]: {
    label: "MiniLM",
    icon: ScanSearch,
    iconClass: "text-emerald-300",
    pillClass: "bg-emerald-500/10 border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-400/50",
    pillOpenClass: "bg-emerald-500/20 border-emerald-400/60 text-emerald-100 ring-2 ring-emerald-400/20",
    rowSelectedClass: "bg-emerald-500/10 border-emerald-400/40",
  },
  [ModelTier.TIER_2_SMOLLM_GENERATIVE]: {
    label: "SmolLM",
    icon: Brain,
    iconClass: "text-purple-300",
    pillClass: "bg-purple-500/10 border-purple-400/30 text-purple-100 hover:bg-purple-500/20 hover:border-purple-400/50",
    pillOpenClass: "bg-purple-500/20 border-purple-400/60 text-purple-100 ring-2 ring-purple-400/20",
    rowSelectedClass: "bg-purple-500/10 border-purple-400/40",
  },
  [ModelTier.TIER_3_GEMMA4_E2B]: {
    label: "Gemma 4",
    icon: Gem,
    iconClass: "text-rose-300",
    pillClass: "bg-rose-500/10 border-rose-400/30 text-rose-100 hover:bg-rose-500/20 hover:border-rose-400/50",
    pillOpenClass: "bg-rose-500/20 border-rose-400/60 text-rose-100 ring-2 ring-rose-400/20",
    rowSelectedClass: "bg-rose-500/10 border-rose-400/40",
  },
};

// Strip leading emoji from TIER_METADATA strings when paired with explicit Lucide icons
export const stripLeadingEmoji = (s: string) => s.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "");
