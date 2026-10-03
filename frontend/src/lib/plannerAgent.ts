/**
 * Plan-Agent with Meta-Agent Orchestration Architecture
 *
 * Inspired by Jeomon/Plan-Agent-with-Meta-Agent:
 * 1. Planner Agent: Decomposes complex user requests into discrete, ordered subtasks.
 * 2. Meta Agent: Orchestrates execution, tracks plan progress, and dispatches each task
 *    to either ReAct (AgentHarness action loop) or CoT (pure reasoning/evaluation).
 * 3. Dynamic Replanning: If an action fails or the DOM changes unexpectedly, Meta Agent
 *    triggers the Planner to adjust remaining tasks rather than thrashing in loops.
 */

import { AgentHarness, HarnessExecutionResult } from "./agentHarness";
import { ModelTier } from "./types";
import { AgentStepTrace } from "./expertJudge";

export type TaskType = "action" | "reasoning";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface PlanTask {
  id: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  result?: string;
  attempts: number;
}

export interface AgentPlan {
  id: string;
  goal: string;
  tasks: PlanTask[];
  currentTaskIndex: number;
  status: "planning" | "executing" | "replanning" | "completed" | "failed";
  createdAt: number;
}

export interface MetaExecutionResult {
  final: string;
  plan: AgentPlan;
  fullTrajectory: AgentStepTrace[];
  totalDurationMs: number;
  replansCount: number;
}

export interface PlannerConfig {
  maxReplans?: number;
  subtaskMaxSteps?: number;
  onPlanUpdate?: (plan: AgentPlan) => void;
  onSubtaskProgress?: (taskId: string, status: TaskStatus, note?: string) => void;
}

export class PlannerAgent {
  /**
   * Decompose a user goal into an ordered array of subtasks.
   * Simple goals (e.g. "search shoes") become 1 task.
   * Complex workflows (e.g. "find watch, add to cart, check out") become multi-stage plans.
   */
  async createPlan(
    goal: string,
    predictor: (messages: Array<{ role: string; content: string }>) => Promise<string>
  ): Promise<AgentPlan> {
    const prompt = `You are a high-level Planner Agent for a web automation harness.
Decompose the following user goal into 1 to 4 sequential, atomic subtasks.
Each task must be either:
- "action": Requires interacting with the web page (search, browse, click, type, navigate, cart, checkout).
- "reasoning": Pure evaluation, calculation, extraction comparison, or decision making.

If the goal is simple (e.g., searching or asking a question), output only 1 task.
DO NOT overcomplicate. Output STRICT JSON only in this format:
{
  "tasks": [
    { "id": "task_1", "description": "Search for...", "type": "action" },
    { "id": "task_2", "description": "Inspect and add to cart...", "type": "action" }
  ]
}

User Goal: "${goal}"`;

    try {
      const res = await predictor([
        { role: "system", content: "You output valid JSON only. No markdown formatting, no explanations." },
        { role: "user", content: prompt },
      ]);

      const cleaned = res.replace(/```json/gi, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          const tasks: PlanTask[] = parsed.tasks.map((t: any, idx: number) => ({
            id: String(t.id || `task_${idx + 1}`),
            description: String(t.description || ""),
            type: t.type === "reasoning" ? "reasoning" : "action",
            status: "pending",
            attempts: 0,
          }));

          return {
            id: `plan_${Date.now()}`,
            goal,
            tasks,
            currentTaskIndex: 0,
            status: "planning",
            createdAt: Date.now(),
          };
        }
      }
    } catch (e) {
      console.warn("[PlannerAgent] LLM plan parsing failed, falling back to direct single-task plan:", e);
    }

    // Fallback: Single atomic task plan
    return {
      id: `plan_${Date.now()}`,
      goal,
      tasks: [
        {
          id: "task_1",
          description: goal,
          type: "action",
          status: "pending",
          attempts: 0,
        },
      ],
      currentTaskIndex: 0,
      status: "planning",
      createdAt: Date.now(),
    };
  }

  /**
   * Replan remaining pending tasks when a subtask fails or encounters an unrecoverable state.
   */
  async replan(
    currentPlan: AgentPlan,
    failedTask: PlanTask,
    failureReason: string,
    predictor: (messages: Array<{ role: string; content: string }>) => Promise<string>
  ): Promise<AgentPlan> {
    const prompt = `The current subtask failed during execution.
Overall Goal: "${currentPlan.goal}"
Failed Subtask: "${failedTask.description}"
Failure / Observation: "${failureReason.slice(0, 300)}"

Please provide an adjusted plan for the remaining steps to achieve the goal.
STRICT JSON only:
{
  "tasks": [
    { "id": "adjusted_1", "description": "Alternative action...", "type": "action" }
  ]
}`;

    try {
      const res = await predictor([
        { role: "system", content: "You output valid JSON only. No markdown formatting, no explanations." },
        { role: "user", content: prompt },
      ]);
      const cleaned = res.replace(/```json/gi, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          const completedTasks = currentPlan.tasks.slice(0, currentPlan.currentTaskIndex);
          const adjustedTasks: PlanTask[] = parsed.tasks.map((t: any, idx: number) => ({
            id: `adj_${Date.now()}_${idx + 1}`,
            description: String(t.description || ""),
            type: t.type === "reasoning" ? "reasoning" : "action",
            status: "pending",
            attempts: 0,
          }));

          return {
            ...currentPlan,
            tasks: [...completedTasks, { ...failedTask, status: "failed" }, ...adjustedTasks],
            currentTaskIndex: completedTasks.length + 1,
            status: "replanning",
          };
        }
      }
    } catch (e) {
      console.warn("[PlannerAgent] Replanning failed:", e);
    }

    return currentPlan;
  }
}

export class MetaAgent {
  private planner: PlannerAgent;
  private harness?: AgentHarness;
  private maxReplans: number;
  private subtaskMaxSteps: number;
  private onPlanUpdate?: (plan: AgentPlan) => void;
  private onSubtaskProgress?: (taskId: string, status: TaskStatus, note?: string) => void;

  constructor(
    harness?: AgentHarness,
    config: PlannerConfig = {}
  ) {
    this.planner = new PlannerAgent();
    this.harness = harness;
    this.maxReplans = config.maxReplans ?? 2;
    this.subtaskMaxSteps = config.subtaskMaxSteps ?? 4;
    this.onPlanUpdate = config.onPlanUpdate;
    this.onSubtaskProgress = config.onSubtaskProgress;
  }

  /**
   * Main entry point for the Meta-Agent orchestrator.
   */
  async executePlan(
    userGoal: string,
    predictor: (messages: Array<{ role: string; content: string }>) => Promise<string>,
    activeTier: ModelTier = ModelTier.TIER_0_GEMINI_NANO
  ): Promise<MetaExecutionResult> {
    const startTime = performance.now();
    const fullTrajectory: AgentStepTrace[] = [];
    let replansCount = 0;

    // 1. Generate Initial Plan
    let plan = await this.planner.createPlan(userGoal, predictor);
    plan.status = "executing";
    this.emitPlan(plan);

    const taskSummaries: string[] = [];

    // 2. Iterate through plan tasks
    while (plan.currentTaskIndex < plan.tasks.length) {
      const currentTask = plan.tasks[plan.currentTaskIndex];
      currentTask.status = "in_progress";
      currentTask.attempts++;
      this.emitProgress(currentTask.id, "in_progress");
      this.emitPlan(plan);

      if (currentTask.type === "reasoning") {
        // Execute CoT (pure reasoning)
        const cotResult = await this.executeCoT(currentTask, taskSummaries, predictor);
        currentTask.result = cotResult;
        currentTask.status = "completed";
        taskSummaries.push(`[${currentTask.id}] (Reasoning): ${cotResult}`);
        this.emitProgress(currentTask.id, "completed", cotResult);
        plan.currentTaskIndex++;
        this.emitPlan(plan);
        continue;
      }

      // Execute Action Task via bounded ReAct sub-sprint in AgentHarness
      const subHarness = this.harness || new AgentHarness({
        maxSteps: this.subtaskMaxSteps,
        onStepProgress: (_step, tool, obs) => {
          this.emitProgress(currentTask.id, "in_progress", `${tool}: ${obs.slice(0, 100)}`);
        },
      });

      const subResult: HarnessExecutionResult = await subHarness.runLoop(
        `Subtask: ${currentTask.description}\nContext: Goal is "${userGoal}". Previous notes: ${taskSummaries.slice(-2).join("; ")}`,
        predictor,
        activeTier
      );

      // Accumulate trajectory
      for (const step of subResult.trajectory) {
        fullTrajectory.push({
          ...step,
          step: fullTrajectory.length + 1,
        });
      }

      const isFailure =
        subResult.final.toLowerCase().includes("maximum step limit") ||
        subResult.final.toLowerCase().includes("failed") ||
        subResult.final.toLowerCase().includes("not found");

      if (isFailure && replansCount < this.maxReplans) {
        replansCount++;
        currentTask.status = "failed";
        currentTask.result = subResult.final;
        this.emitProgress(currentTask.id, "failed", subResult.final);

        // Dynamically replan
        plan = await this.planner.replan(plan, currentTask, subResult.final, predictor);
        plan.status = "executing";
        this.emitPlan(plan);
      } else {
        currentTask.status = isFailure ? "failed" : "completed";
        currentTask.result = subResult.final;
        taskSummaries.push(`[${currentTask.id}] (Action): ${subResult.final}`);
        this.emitProgress(currentTask.id, currentTask.status, subResult.final);
        plan.currentTaskIndex++;
        this.emitPlan(plan);
      }
    }

    const allSuccessful = plan.tasks.every((t) => t.status === "completed");
    plan.status = allSuccessful ? "completed" : "failed";
    this.emitPlan(plan);

    const finalSummary = taskSummaries.length > 0
      ? taskSummaries[taskSummaries.length - 1].replace(/^\[.*?\]\s*\(.*?\):\s*/, "")
      : "Plan executed.";

    return {
      final: finalSummary,
      plan,
      fullTrajectory,
      totalDurationMs: Math.round(performance.now() - startTime),
      replansCount,
    };
  }

  private async executeCoT(
    task: PlanTask,
    previousNotes: string[],
    predictor: (messages: Array<{ role: string; content: string }>) => Promise<string>
  ): Promise<string> {
    const prompt = `Perform the following reasoning/analysis step:
Task: "${task.description}"
Prior observations:
${previousNotes.join("\n")}

Think step-by-step and provide a clear, concise conclusion or answer.`;

    try {
      const response = await predictor([
        { role: "system", content: "You are a precise, analytical reasoning engine." },
        { role: "user", content: prompt },
      ]);
      return response.trim();
    } catch (err: any) {
      return `Reasoning error: ${err.message}`;
    }
  }

  private emitPlan(plan: AgentPlan) {
    if (this.onPlanUpdate) {
      try {
        this.onPlanUpdate({ ...plan, tasks: [...plan.tasks] });
      } catch (e) {
        console.error("[MetaAgent] Error in onPlanUpdate listener:", e);
      }
    }
  }

  private emitProgress(taskId: string, status: TaskStatus, note?: string) {
    if (this.onSubtaskProgress) {
      try {
        this.onSubtaskProgress(taskId, status, note);
      } catch (e) {
        console.error("[MetaAgent] Error in onSubtaskProgress listener:", e);
      }
    }
  }
}
