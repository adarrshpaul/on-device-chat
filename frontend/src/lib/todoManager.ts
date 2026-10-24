/**
 * Harness-Held Todo List & Task State Manager (TASK-116)
 *
 * Implements the harness-owned plan pattern inspired by Claude Code:
 * 1. The harness (not the LLM) owns the task list and state transitions.
 * 2. Small on-device models only mark items done/blocked, keeping prompt additions to 1 short line.
 * 3. Supports user plan approval before execution begins.
 * 4. Emits real-time reactive updates to the UI widget.
 */

export type TodoStatus = "pending" | "in_progress" | "completed" | "blocked";

export interface TodoItem {
  id: string;
  title: string;
  status: TodoStatus;
  note?: string;
  attempts?: number;
}

export interface PlanState {
  id: string;
  goal: string;
  tasks: TodoItem[];
  approved: boolean;
  status: "draft" | "approved" | "executing" | "completed" | "failed";
  createdAt: number;
}

export type PlanChangeListener = (plan: PlanState | null) => void;

export class TodoManager {
  private currentPlan: PlanState | null = null;
  private listeners: Set<PlanChangeListener> = new Set();

  /**
   * Initialize a new plan held by the harness.
   * If autoApprove is false, plan remains in "draft" requiring user approval.
   */
  createPlan(
    goal: string,
    tasks: Array<{ title: string; id?: string }>,
    autoApprove = false
  ): PlanState {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const todoTasks: TodoItem[] = tasks.map((t, index) => ({
      id: t.id || `task_${index + 1}`,
      title: t.title.trim(),
      status: index === 0 && autoApprove ? "in_progress" : "pending",
      attempts: 0,
    }));

    this.currentPlan = {
      id: planId,
      goal,
      tasks: todoTasks,
      approved: autoApprove,
      status: autoApprove ? "executing" : "draft",
      createdAt: Date.now(),
    };

    this.notify();
    return this.currentPlan;
  }

  /**
   * Get the active plan or null if none is active.
   */
  getPlan(): PlanState | null {
    return this.currentPlan;
  }

  /**
   * User approves the current draft plan to start execution.
   */
  approvePlan(): boolean {
    if (!this.currentPlan) return false;
    this.currentPlan.approved = true;
    this.currentPlan.status = "executing";
    if (this.currentPlan.tasks.length > 0 && this.currentPlan.tasks[0].status === "pending") {
      this.currentPlan.tasks[0].status = "in_progress";
    }
    this.notify();
    return true;
  }

  /**
   * User or harness rejects/cancels the current plan.
   */
  rejectPlan(reason?: string): void {
    if (!this.currentPlan) return;
    this.currentPlan.status = "failed";
    this.currentPlan.approved = false;
    if (reason && this.currentPlan.tasks.length > 0) {
      const active = this.getActiveTask() || this.currentPlan.tasks[0];
      active.status = "blocked";
      active.note = reason;
    }
    this.notify();
  }

  /**
   * Update status of a specific task item by ID or 1-based index (e.g. "task_1" or "1").
   */
  updateTaskStatus(identifier: string, status: TodoStatus, note?: string): boolean {
    if (!this.currentPlan) return false;
    const task = this.resolveTask(identifier);
    if (!task) return false;

    task.status = status;
    if (note) task.note = note;

    // Check if all tasks are completed
    const allDone = this.currentPlan.tasks.every(
      (t) => t.status === "completed"
    );
    if (allDone) {
      this.currentPlan.status = "completed";
    } else if (status === "completed") {
      // Auto-advance next pending task to in_progress
      const nextPending = this.currentPlan.tasks.find((t) => t.status === "pending");
      if (nextPending) {
        nextPending.status = "in_progress";
      }
    }

    this.notify();
    return true;
  }

  /**
   * Mark a task as done.
   */
  markTaskDone(identifier: string, note?: string): boolean {
    return this.updateTaskStatus(identifier, "completed", note);
  }

  /**
   * Mark a task as blocked.
   */
  markTaskBlocked(identifier: string, reason: string): boolean {
    return this.updateTaskStatus(identifier, "blocked", reason);
  }

  /**
   * Retrieve the currently active task in progress.
   */
  getActiveTask(): TodoItem | null {
    if (!this.currentPlan) return null;
    return (
      this.currentPlan.tasks.find((t) => t.status === "in_progress") ||
      this.currentPlan.tasks.find((t) => t.status === "pending") ||
      null
    );
  }

  /**
   * Generates a single concise summary line for the LLM prompt.
   * "Small models punish prompt growth: implement techniques in harness CODE,
   * keeping prompt additions to one short line."
   */
  formatPromptLine(): string {
    if (!this.currentPlan || this.currentPlan.tasks.length === 0) {
      return "";
    }
    const parts = this.currentPlan.tasks.map((t, idx) => {
      const symbol =
        t.status === "completed"
          ? "done"
          : t.status === "in_progress"
          ? "active"
          : t.status === "blocked"
          ? "blocked"
          : "todo";
      return `[${idx + 1}] ${t.title} (${symbol})`;
    });
    return `Plan: ${parts.join(" | ")}`;
  }

  /**
   * Clear the plan state when goal is finished or aborted.
   */
  clear(): void {
    this.currentPlan = null;
    this.notify();
  }

  /**
   * Subscribe to plan state transitions for reactive UI rendering.
   */
  onPlanChange(listener: PlanChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private resolveTask(identifier: string): TodoItem | undefined {
    if (!this.currentPlan) return undefined;
    const clean = String(identifier).trim();
    // Check direct ID match
    const found = this.currentPlan.tasks.find((t) => t.id === clean);
    if (found) return found;

    // Check numeric index (1-based e.g. "1" or "task 1")
    const numMatch = clean.match(/\d+/);
    if (numMatch) {
      const idx = parseInt(numMatch[0], 10) - 1;
      if (idx >= 0 && idx < this.currentPlan.tasks.length) {
        return this.currentPlan.tasks[idx];
      }
    }
    return undefined;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentPlan ? { ...this.currentPlan, tasks: [...this.currentPlan.tasks] } : null);
      } catch (err) {
        console.error("[TodoManager] Listener error:", err);
      }
    }
  }
}

export const globalTodoManager = new TodoManager();
