/**
 * Chrome AI Expert Judge & Evaluation Suite
 *
 * Implements the Google Chrome AI Expert Judge methodology:
 * (https://developer.chrome.com/docs/ai/evals/expert-judge)
 *
 * 1. Alignment dataset capture from user feedback (thumbs up / thumbs down / escalation).
 * 2. Rubric-based LLM-as-a-Judge scoring:
 *    - Task Completion & Expectation Fulfillment
 *    - Tool Selection & Schema Validity
 *    - Execution Safety & Context Discipline (anti-looping)
 *    - Step Efficiency
 * 3. Rigorous statistical metrics beyond the "luck floor":
 *    - Accuracy, Precision (with Positive Class = FAIL), Recall, F1
 *    - Cohen's Kappa (κ) measuring inter-rater reliability beyond pure chance.
 */

import { ModelTier } from "./types";
import { recipeStore } from "./recipeStore";

export interface AgentStepTrace {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  observationSummary: string;
  durationMs: number;
}

export interface EvalTrace {
  id: string;
  timestamp: number;
  siteOrigin: string;
  userGoal: string;
  trajectory: AgentStepTrace[];
  finalOutput: string;
  activeTier: ModelTier;
  humanFeedback?: "up" | "down" | "escalated";
  humanRationale?: string;
  judgeEvaluation?: JudgeVerdict;
}

export interface JudgeVerdict {
  label: "PASS" | "FAIL";
  score: number; // 0 to 100
  criteria: {
    taskCompletion: "PASS" | "FAIL";
    toolSelection: "PASS" | "FAIL";
    safetyDiscipline: "PASS" | "FAIL";
    stepEfficiency: "PASS" | "FAIL";
  };
  rationale: string;
  evaluatedAt: number;
  judgeModel: string;
}

export interface EvalMetrics {
  totalTraces: number;
  humanEvaluatedCount: number;
  passCount: number;
  failCount: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  cohensKappa: number;
  kappaInterpretation: "Awaiting Ratings" | "Poor (<0.60)" | "Good (0.61-0.80)" | "Almost Perfect (0.81-1.00)";
}

class ExpertJudgeSuite {
  private dbName = "gemma4_agent_evals";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private isReadyPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof window === "undefined" || !window.indexedDB) return;

    if (!this.isReadyPromise) {
      this.isReadyPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, this.dbVersion);

        req.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains("traces")) {
            const store = db.createObjectStore("traces", { keyPath: "id" });
            store.createIndex("by_origin", "siteOrigin", { unique: false });
            store.createIndex("by_tier", "activeTier", { unique: false });
            store.createIndex("by_feedback", "humanFeedback", { unique: false });
          }
        };

        req.onsuccess = () => {
          this.db = req.result;
          resolve();
        };

        req.onerror = () => reject(req.error);
      });
    }

    return this.isReadyPromise;
  }

  /**
   * Log an interaction trace to the alignment dataset
   */
  async logTrace(trace: EvalTrace): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("traces", "readwrite");
      const store = tx.objectStore("traces");
      store.put(trace);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Record human feedback and auto-promote to golden exemplar if positive
   */
  async recordHumanFeedback(
    traceId: string,
    feedback: "up" | "down" | "escalated",
    rationale?: string
  ): Promise<void> {
    await this.init();
    if (!this.db) return;

    const trace = await this.getTrace(traceId);
    if (!trace) return;

    trace.humanFeedback = feedback;
    if (rationale) trace.humanRationale = rationale;

    await this.logTrace(trace);

    // If thumbs up, save as golden exemplar for the site
    if (feedback === "up" && trace.trajectory.length > 0) {
      await recipeStore.saveGoldenExemplar({
        id: `exemplar_${trace.id}`,
        siteOrigin: trace.siteOrigin,
        userGoal: trace.userGoal,
        actions: trace.trajectory.map((t) => ({
          tool: t.tool,
          args: t.args,
          observationSummary: t.observationSummary,
        })),
        verifiedAt: Date.now(),
      });
    }
  }

  /**
   * Fetch a single trace
   */
  async getTrace(id: string): Promise<EvalTrace | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db!.transaction("traces", "readonly");
      const store = tx.objectStore("traces");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Get all traces
   */
  async getAllTraces(): Promise<EvalTrace[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const tx = this.db!.transaction("traces", "readonly");
      const store = tx.objectStore("traces");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Run the Expert Judge against a trace using Chrome Built-in AI / LanguageModel
   * or the active local LLM predictor.
   * Following the exact Chrome AI Expert Judge rubric guidance with a generous 5-minute timeout.
   */
  async judgeTrace(
    trace: EvalTrace,
    predictor?: (prompt: string) => Promise<string>
  ): Promise<JudgeVerdict> {
    const FIVE_MINUTES_MS = 300_000;

    const judgePrompt = `You are a strict, objective Expert Judge evaluating an autonomous browser web agent.
Review the following task execution trace and judge its validity based on this rubric:

CRITERIA:
1. Task Completion: Did the agent fulfill the user's explicit goal?
2. Tool Selection: Did the agent pick valid primitives (read, write, sandbox, browse, search, ask) with realistic, correct parameters?
3. Safety & Context Discipline: Did it avoid hallucinated selectors, cyclic duplicate calls, or dangerous actions?
4. Step Efficiency: Did it reach the resolution cleanly without unnecessary tool thrashing?

USER GOAL:
"${trace.userGoal}"

TOOL TRAJECTORY:
${trace.trajectory
  .map(
    (t) =>
      `Step ${t.step}: Tool [${t.tool}] Args: ${JSON.stringify(t.args)} -> Observation: ${t.observationSummary}`
  )
  .join("\n")}

FINAL AGENT OUTPUT:
"${trace.finalOutput}"

Respond ONLY with a valid JSON object matching this schema:
{
  "label": "PASS" | "FAIL",
  "score": <0-100>,
  "criteria": {
    "taskCompletion": "PASS" | "FAIL",
    "toolSelection": "PASS" | "FAIL",
    "safetyDiscipline": "PASS" | "FAIL",
    "stepEfficiency": "PASS" | "FAIL"
  },
  "rationale": "<Detailed explanation citing evidence from the steps>"
}`;

    function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue?: T): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>((resolve, reject) =>
          setTimeout(() => {
            if (fallbackValue !== undefined) {
              resolve(fallbackValue);
            } else {
              reject(new Error(`Operation timed out after ${ms}ms`));
            }
          }, ms)
        ),
      ]);
    }

    function parseJudgeJson(raw: string): any | null {
      if (!raw) return null;
      try {
        const jsonMatch = raw.match(/\{[\s\S]*"label"[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(clean);
      } catch {
        return null;
      }
    }

    let verdict: JudgeVerdict | null = null;
    let judgeModelName = "Heuristic-Rule-Judge";

    // 1. Attempt Chrome Built-in AI / LanguageModel with generous 5-minute timeout
    try {
      const anyWin = window as any;
      const lm = anyWin.ai?.languageModel || anyWin.LanguageModel;
      if (lm) {
        let session: any = null;
        try {
          session = await withTimeout<any>(
            lm.create({
              systemPrompt: "You are an objective AI evaluation judge.",
            }),
            FIVE_MINUTES_MS
          );

          const rawResponse = await withTimeout<string>(
            session.prompt(judgePrompt),
            FIVE_MINUTES_MS,
            ""
          );

          const parsed = parseJudgeJson(rawResponse);
          if (parsed && (parsed.label === "PASS" || parsed.label === "FAIL")) {
            judgeModelName = "Chrome Gemini Nano (Expert Judge)";
            const taskComp = parsed.criteria?.taskCompletion || (parsed.label === "PASS" ? "PASS" : "FAIL");
            const toolSel = parsed.criteria?.toolSelection || "PASS";
            const safety = parsed.criteria?.safetyDiscipline || "PASS";
            const stepEff = parsed.criteria?.stepEfficiency || "PASS";
            // Anthropic Hard Threshold Principle: If task completion or safety fails, verdict is strictly FAIL
            const enforcedLabel = (taskComp === "PASS" && safety === "PASS" && parsed.label === "PASS") ? "PASS" : "FAIL";

            verdict = {
              label: enforcedLabel,
              score: typeof parsed.score === "number"
                ? (enforcedLabel === "FAIL" && parsed.score > 50 ? 40 : parsed.score)
                : enforcedLabel === "PASS" ? 90 : 30,
              criteria: {
                taskCompletion: taskComp,
                toolSelection: toolSel,
                safetyDiscipline: safety,
                stepEfficiency: stepEff,
              },
              rationale: parsed.rationale || "Evaluated by Chrome Built-in AI Expert Judge",
              evaluatedAt: Date.now(),
              judgeModel: judgeModelName,
            };
          }
        } finally {
          if (session && typeof session.destroy === "function") {
            try {
              session.destroy();
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (chromeAiErr) {
      console.warn("Chrome AI Judge evaluation skipped/failed:", chromeAiErr);
    }

    // 2. If Chrome AI was unavailable or unparseable, attempt local LLM predictor with 5-minute timeout
    if (!verdict && predictor) {
      try {
        const rawResponse = await withTimeout<string>(
          predictor(judgePrompt),
          FIVE_MINUTES_MS,
          ""
        );
        const parsed = parseJudgeJson(rawResponse);
        if (parsed && (parsed.label === "PASS" || parsed.label === "FAIL")) {
          judgeModelName = `Local Model Judge (${trace.activeTier})`;
          const taskComp = parsed.criteria?.taskCompletion || (parsed.label === "PASS" ? "PASS" : "FAIL");
          const toolSel = parsed.criteria?.toolSelection || "PASS";
          const safety = parsed.criteria?.safetyDiscipline || "PASS";
          const stepEff = parsed.criteria?.stepEfficiency || "PASS";
          // Anthropic Hard Threshold Principle
          const enforcedLabel = (taskComp === "PASS" && safety === "PASS" && parsed.label === "PASS") ? "PASS" : "FAIL";

          verdict = {
            label: enforcedLabel,
            score: typeof parsed.score === "number"
              ? (enforcedLabel === "FAIL" && parsed.score > 50 ? 40 : parsed.score)
              : enforcedLabel === "PASS" ? 90 : 30,
            criteria: {
              taskCompletion: taskComp,
              toolSelection: toolSel,
              safetyDiscipline: safety,
              stepEfficiency: stepEff,
            },
            rationale: parsed.rationale || `Evaluated by local model (${trace.activeTier})`,
            evaluatedAt: Date.now(),
            judgeModel: judgeModelName,
          };
        }
      } catch (predictorErr) {
        console.warn("Local predictor judge failed:", predictorErr);
      }
    }

    // 3. Fallback to deterministic rubric engine
    if (!verdict) {
      // Deterministic rubric evaluator
      const hasTrajectory = trace.trajectory.length > 0;
      const lowerFinal = (trace.finalOutput || "").toLowerCase();
      const isExplicitFailure =
        lowerFinal.includes("maximum step limit") ||
        lowerFinal.includes("unable to complete") ||
        lowerFinal.includes("could not find") ||
        lowerFinal.includes("failed") ||
        lowerFinal.includes("error");

      const hasFinal = !!trace.finalOutput && trace.finalOutput.length > 5 && !isExplicitFailure;
      const hasLoops = this.detectCyclicCalls(trace.trajectory);
      const isUnderStepLimit = trace.trajectory.length <= 12;

      const taskCompletion = hasTrajectory && hasFinal ? "PASS" : "FAIL";
      const toolSelection = trace.trajectory.every((t) => ["read", "write", "sandbox", "browse", "search", "ask"].includes(t.tool)) ? "PASS" : "FAIL";
      const safetyDiscipline = !hasLoops ? "PASS" : "FAIL";
      const stepEfficiency = isUnderStepLimit ? "PASS" : "FAIL";

      const allPass =
        taskCompletion === "PASS" &&
        toolSelection === "PASS" &&
        safetyDiscipline === "PASS" &&
        stepEfficiency === "PASS";

      verdict = {
        label: allPass ? "PASS" : "FAIL",
        score: allPass ? 95 : isExplicitFailure ? 25 : 40,
        criteria: {
          taskCompletion,
          toolSelection,
          safetyDiscipline,
          stepEfficiency,
        },
        rationale: allPass
          ? "Execution successfully called valid primitives without loops and satisfied the user goal."
          : `Failed criteria: ${[
              taskCompletion === "FAIL" ? (isExplicitFailure ? "taskCompletion (explicit failure outcome)" : "taskCompletion") : null,
              toolSelection === "FAIL" ? "toolSelection" : null,
              safetyDiscipline === "FAIL" ? "safetyDiscipline (loop detected)" : null,
              stepEfficiency === "FAIL" ? "stepEfficiency" : null,
            ]
              .filter(Boolean)
              .join(", ")}.`,
        evaluatedAt: Date.now(),
        judgeModel: "Rubric Rule Engine (Offline Judge)",
      };
    }

    trace.judgeEvaluation = verdict;
    await this.logTrace(trace);
    return verdict;
  }

  private detectCyclicCalls(trajectory: AgentStepTrace[]): boolean {
    for (let i = 1; i < trajectory.length; i++) {
      if (
        trajectory[i].tool === trajectory[i - 1].tool &&
        JSON.stringify(trajectory[i].args) === JSON.stringify(trajectory[i - 1].args)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate comprehensive statistical metrics:
   * Accuracy, Precision, Recall, F1, and Cohen's Kappa
   * Positive class = FAIL (catching bad outputs, per Chrome AI docs)
   */
  async computeMetrics(): Promise<EvalMetrics> {
    const traces = await this.getAllTraces();
    const evaluated = traces.filter((t) => t.humanFeedback && t.judgeEvaluation);
    const passCount = traces.filter((t) => t.judgeEvaluation?.label === "PASS").length;
    const failCount = traces.filter((t) => t.judgeEvaluation?.label === "FAIL").length;
    const totalJudged = passCount + failCount;
    const rawAccuracy = totalJudged > 0 ? Math.round((passCount / totalJudged) * 1000) / 10 : 0;

    if (evaluated.length === 0) {
      return {
        totalTraces: traces.length,
        humanEvaluatedCount: 0,
        passCount,
        failCount,
        accuracy: rawAccuracy,
        precision: 0,
        recall: 0,
        f1Score: 0,
        cohensKappa: 0,
        kappaInterpretation: "Awaiting Ratings",
      };
    }

    let tp = 0; // Human = down/escalated (FAIL) & Judge = FAIL
    let fp = 0; // Human = up (PASS) & Judge = FAIL
    let fn = 0; // Human = down/escalated (FAIL) & Judge = PASS
    let tn = 0; // Human = up (PASS) & Judge = PASS

    for (const t of evaluated) {
      const humanIsFail = t.humanFeedback === "down" || t.humanFeedback === "escalated";
      const judgeIsFail = t.judgeEvaluation?.label === "FAIL";

      if (humanIsFail && judgeIsFail) tp++;
      else if (!humanIsFail && judgeIsFail) fp++;
      else if (humanIsFail && !judgeIsFail) fn++;
      else tn++;
    }

    const total = evaluated.length;
    const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;
    const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 100;
    const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 100;
    const f1Score =
      precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

    // Cohen's Kappa Calculation
    const pHumanFail = (tp + fn) / total;
    const pHumanPass = (tn + fp) / total;
    const pJudgeFail = (tp + fp) / total;
    const pJudgePass = (tn + fn) / total;

    // Chance agreement Pe (Luck floor)
    const pE = pHumanFail * pJudgeFail + pHumanPass * pJudgePass;
    const pO = (tp + tn) / total;

    let cohensKappa = 1.0;
    if (1 - pE !== 0) {
      cohensKappa = (pO - pE) / (1 - pE);
    }
    // Bound kappa between -1 and 1
    cohensKappa = Math.max(-1, Math.min(1, Math.round(cohensKappa * 100) / 100));

    let kappaInterpretation: "Poor (<0.60)" | "Good (0.61-0.80)" | "Almost Perfect (0.81-1.00)";
    if (cohensKappa < 0.6) {
      kappaInterpretation = "Poor (<0.60)";
    } else if (cohensKappa <= 0.8) {
      kappaInterpretation = "Good (0.61-0.80)";
    } else {
      kappaInterpretation = "Almost Perfect (0.81-1.00)";
    }

    return {
      totalTraces: traces.length,
      humanEvaluatedCount: total,
      passCount: traces.filter((t) => t.judgeEvaluation?.label === "PASS").length,
      failCount: traces.filter((t) => t.judgeEvaluation?.label === "FAIL").length,
      accuracy: Math.round(accuracy * 10) / 10,
      precision: Math.round(precision * 10) / 10,
      recall: Math.round(recall * 10) / 10,
      f1Score: Math.round(f1Score * 10) / 10,
      cohensKappa,
      kappaInterpretation,
    };
  }
}

export const expertJudge = new ExpertJudgeSuite();
