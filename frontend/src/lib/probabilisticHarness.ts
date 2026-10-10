/**
 * Probabilistic Harness Engine
 *
 * Implements inference-time search, multi-hypothesis sampling,
 * and deterministic verification to amplify weak on-device models.
 *
 * Key Pillars:
 * 1. Pass@K & Best-of-N (BoN): Sample multiple candidate reasoning paths / tool decisions.
 * 2. Self-Consistency / Consensus: Plurality voting over normalized semantic actions.
 * 3. Environment-Grounded Verifiers: Syntax checkers, tool-schema validators, and DOM element existence checks.
 * 4. Reflexion MDP: Capture failures/exceptions into episodic feedback prompting revision.
 */

import { parseHarnessDecision, HarnessToolCall } from "./harnessDecisionParser";
import { smartQuerySelector, isWidgetElement } from "./domUtils";
import { ActionDispatcher } from "./actionDispatcher";
import { ToolDefinition } from "./types";

export interface CandidateDecision {
  raw: string;
  decision: HarnessToolCall;
  verifierScore: number;
  verifierFeedback?: string;
  isValid: boolean;
}

export interface VerificationResult {
  score: number; // 0.0 to 1.0
  passed: boolean;
  reason?: string;
}

export class ProbabilisticHarnessEngine {
  /**
   * Evaluates a candidate tool decision against deterministic environment constraints.
   * Generation vs. Verification Asymmetry: Verifying is an O(1)/deterministic oracle check.
   */
  static verifyDecision(
    decision: HarnessToolCall,
    customToolDefs: ToolDefinition[] = [],
    domRoot: ParentNode = (typeof document !== "undefined" ? document : null as any)
  ): VerificationResult {
    // 1. Final answer check
    if (decision.tool === "final") {
      const text = decision.final || "";
      if (!text.trim() || text === "..." || text.length < 2) {
        return { score: 0.1, passed: false, reason: "Empty or placeholder final response." };
      }
      // Penalize raw JSON leaks or unresolved selector artifacts
      if (text.startsWith("{") && text.endsWith("}") && text.includes('"tool"')) {
        return { score: 0.2, passed: false, reason: "Unparsed raw JSON leaked into final text." };
      }
      return { score: 0.95, passed: true };
    }

    // 2. Canonical tool name validation & direct action normalization
    const directActionMap: Record<string, string> = {
      click: "click",
      type: "type",
      fill: "type",
      input: "type",
      scroll: "scroll",
      navigate: "navigate",
      goto: "navigate",
      open: "navigate",
      inspect: "inspect",
      snapshot: "snapshot",
      hover: "hover",
      extract: "extract",
      see: "see",
      look: "see",
      ocr: "ocr",
      overview: "overview",
      map: "overview",
      sitemap: "overview",
      teleport: "teleport",
      jump: "teleport",
      tour: "tour",
      guide: "tour",
    };

    const canonicalTools = new Set([
      "browse",
      "search",
      "read",
      "write",
      "sandbox",
      "ask",
      ...Object.keys(directActionMap),
    ]);
    const isCustom = customToolDefs.some((t) => t.function.name === decision.tool);

    if (!canonicalTools.has(decision.tool) && !isCustom) {
      return {
        score: 0.0,
        passed: false,
        reason: `Unknown tool '${decision.tool}'. Allowed: click, type, scroll, navigate, inspect, browse, search, read, write, sandbox, ask${
          customToolDefs.length ? ", " + customToolDefs.map((t) => t.function.name).join(", ") : ""
        }`,
      };
    }

    const args = decision.args || {};

    // Normalize direct browser tools into browse format for unified verification
    let effectiveTool = decision.tool;
    if (directActionMap[decision.tool]) {
      const actionName = directActionMap[decision.tool];
      if (!args.action) {
        args.action = actionName;
      }
      effectiveTool = "browse";
    }

    // 3. Tool-specific verification
    if (effectiveTool === "browse") {
      const action = String(args.action || "").toLowerCase().trim();
      const validActions = new Set([
        "inspect",
        "snapshot",
        "click",
        "type",
        "scroll",
        "navigate",
        "hover",
        "extract",
        "see",
        "ocr",
        "overview",
        "teleport",
      ]);
      if (!validActions.has(action)) {
        return {
          score: 0.2,
          passed: false,
          reason: `Invalid browse action '${action}'. Allowed: ${Array.from(validActions).join(", ")}`,
        };
      }

      if (action === "click" || action === "type" || action === "inspect") {
        const rawTarget = args.selector ?? args.target ?? args.targetId ?? args.id;
        const selector = String(rawTarget || "").trim();
        if (!selector) {
          return { score: 0.3, passed: false, reason: `Missing required target or selector for browse.${action}` };
        }

        // DOM grounding verification (if running in browser)
        if (domRoot) {
          const resolved = ActionDispatcher.resolveTarget(rawTarget);
          const el = resolved.element || smartQuerySelector(selector, domRoot);
          if (!el) {
            return {
              score: 0.4,
              passed: false,
              reason: `Target element '${selector}' was not found in active document DOM.`,
            };
          }
          if (isWidgetElement(el)) {
            return {
              score: 0.1,
              passed: false,
              reason: `Selector target '${selector}' attempts to manipulate widget internal UI.`,
            };
          }
        }
      }

      if (action === "type" && args.value === undefined) {
        return { score: 0.4, passed: false, reason: "Missing required 'value' parameter for browse.type" };
      }

      return { score: 1.0, passed: true };
    }

    if (decision.tool === "search") {
      const q = String(args.query || args.q || "").trim();
      if (!q) {
        return { score: 0.2, passed: false, reason: "Search query is empty." };
      }
      return { score: 0.9, passed: true };
    }

    if (decision.tool === "sandbox") {
      const code = String(args.code || args.expression || "").trim();
      if (!code) {
        return { score: 0.1, passed: false, reason: "No code provided to sandbox." };
      }
      // Rejection check for forbidden globals
      const forbidden = /\b(window|document|globalThis|fetch|XMLHttpRequest|localStorage|cookieStore|Function|eval)\b/i;
      if (forbidden.test(code)) {
        return { score: 0.0, passed: false, reason: "Security violation: sandbox cannot access globals or storage." };
      }
      return { score: 0.95, passed: true };
    }

    if (decision.tool === "read" || decision.tool === "write") {
      const target = String(args.target || args.key || "").trim();
      if (!target) {
        return { score: 0.3, passed: false, reason: "Target memory key or DOM selector is required." };
      }
      return { score: 0.9, passed: true };
    }

    if (decision.tool === "ask") {
      const question = String(args.question || args.prompt || "").trim();
      if (!question) {
        return { score: 0.2, passed: false, reason: "Ask prompt is empty." };
      }
      return { score: 0.9, passed: true };
    }

    // Custom tool validation against schema
    if (isCustom) {
      const def = customToolDefs.find((t) => t.function.name === decision.tool);
      if (def?.function.parameters?.required) {
        const required = def.function.parameters.required as string[];
        for (const req of required) {
          if (args[req] === undefined || args[req] === null) {
            return { score: 0.3, passed: false, reason: `Missing required parameter '${req}' for ${decision.tool}` };
          }
        }
      }
      return { score: 0.95, passed: true };
    }

    return { score: 0.5, passed: true };
  }

  /**
   * Consensus & Plurality Vote across multiple candidate trajectories (Self-Consistency).
   * Clusters candidate outputs by semantic tool & normalized args.
   */
  static computeConsensus(candidates: CandidateDecision[]): CandidateDecision {
    if (candidates.length === 0) {
      throw new Error("Cannot compute consensus on empty candidates pool.");
    }

    // Filter valid or sort by verification score
    const validCandidates = candidates.filter((c) => c.isValid);
    const pool = validCandidates.length > 0 ? validCandidates : candidates;

    // Cluster map: signature -> { count, totalScore, bestCandidate }
    const clusters = new Map<string, { count: number; totalScore: number; candidate: CandidateDecision }>();

    for (const cand of pool) {
      const d = cand.decision;
      let signature = "";
      if (d.tool === "final") {
        // Group similar final answers by lowercase normalized first 60 chars
        signature = `final:${(d.final || "").toLowerCase().replace(/\s+/g, " ").slice(0, 60)}`;
      } else {
        const normArgs = JSON.stringify(d.args || {});
        signature = `${d.tool}:${normArgs}`;
      }

      const existing = clusters.get(signature);
      if (existing) {
        existing.count += 1;
        existing.totalScore += cand.verifierScore;
        if (cand.verifierScore > existing.candidate.verifierScore) {
          existing.candidate = cand;
        }
      } else {
        clusters.set(signature, {
          count: 1,
          totalScore: cand.verifierScore,
          candidate: cand,
        });
      }
    }

    // Rank clusters by (count * 1.5 + averageVerifierScore)
    let bestWinner = pool[0];
    let highestRank = -1;

    for (const entry of clusters.values()) {
      const avgScore = entry.totalScore / entry.count;
      // Condorcet weight: plurality count weighted by verifier confirmation
      const rank = entry.count * 1.5 + avgScore;
      if (rank > highestRank) {
        highestRank = rank;
        bestWinner = entry.candidate;
      }
    }

    return bestWinner;
  }

  /**
   * Best-of-N (BoN) Adaptive Sampling:
   * Takes a model predictor, samples k candidate decisions, runs verifiers, and picks the highest consensus.
   * If k = 1 and verifier passes, returns immediately (compute-optimal test-time scaling).
   */
  static async sampleBestOfN(
    predictor: () => Promise<string>,
    userGoal: string,
    k: number = 3,
    customToolDefs: ToolDefinition[] = []
  ): Promise<CandidateDecision> {
    const candidates: CandidateDecision[] = [];

    for (let i = 0; i < k; i++) {
      try {
        const raw = await predictor();
        const decision = parseHarnessDecision(raw, userGoal);
        const verification = ProbabilisticHarnessEngine.verifyDecision(decision, customToolDefs);

        const cand: CandidateDecision = {
          raw,
          decision,
          verifierScore: verification.score,
          verifierFeedback: verification.reason,
          isValid: verification.passed,
        };

        candidates.push(cand);

        // Fast-path for compute-optimal test-time scaling:
        // If the very first sample achieves a perfect 1.0 verifier score, short-circuit immediately!
        if (i === 0 && cand.verifierScore >= 0.95 && cand.isValid) {
          return cand;
        }
      } catch (err: any) {
        candidates.push({
          raw: "",
          decision: { tool: "final", args: {}, final: `Prediction error: ${err.message}` },
          verifierScore: 0,
          verifierFeedback: err.message,
          isValid: false,
        });
      }
    }

    return ProbabilisticHarnessEngine.computeConsensus(candidates);
  }
}
