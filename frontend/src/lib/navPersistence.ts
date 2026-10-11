/**
 * Cross-Page Navigation State Persistence
 *
 * Enables the on-device web agent to survive full-page HTTP navigations (MPAs)
 * and multi-page workflows across arbitrary websites.
 *
 * Mechanism:
 * 1. Before an action navigates away (link click, form submit, location.href change),
 *    the active task state, trajectory, and dialogue memory are serialized to sessionStorage.
 * 2. On new page load, if an unexpired in-flight task is detected (<90s),
 *    the harness automatically re-hydrates state and continues the workflow with the new DOM.
 */

export interface InFlightStepTrace {
  step: number;
  tool: string;
  args?: Record<string, unknown>;
  observationSummary: string;
  durationMs: number;
}

const PRIMARY_STORAGE_KEY = "eo_inflight_agent_task";
const LEGACY_STORAGE_KEY = "g4_inflight_agent_task";
const MAX_TASK_AGE_MS = 90_000; // 90 seconds timeout for page loads

export interface InFlightTaskState {
  id: string;
  userGoal: string;
  stepIndex: number;
  maxSteps: number;
  trajectory: InFlightStepTrace[];
  conversationHistory: Array<{ role: string; content: string }>;
  workingMemory: Record<string, unknown>;
  originUrl: string;
  targetUrl?: string;
  createdAt: number;
}

export class NavPersistenceManager {
  /**
   * Serialize active in-flight task before page transition
   */
  static saveTask(task: Omit<InFlightTaskState, "createdAt">): void {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;
      const payload: InFlightTaskState = {
        ...task,
        createdAt: Date.now(),
      };
      const serialized = JSON.stringify(payload);
      window.sessionStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
      window.sessionStorage.setItem(LEGACY_STORAGE_KEY, serialized);
    } catch (err) {
      console.warn("[NavPersistence] Failed to serialize in-flight task to sessionStorage:", err);
    }
  }

  /**
   * Retrieve and validate pending in-flight task on page load
   */
  static getPendingTask(): InFlightTaskState | null {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return null;
      const raw = window.sessionStorage.getItem(PRIMARY_STORAGE_KEY) || window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;

      const task = JSON.parse(raw) as InFlightTaskState;
      const age = Date.now() - (task.createdAt || 0);

      if (age > MAX_TASK_AGE_MS || task.stepIndex >= task.maxSteps) {
        this.clearTask();
        return null;
      }

      return task;
    } catch {
      this.clearTask();
      return null;
    }
  }

  /**
   * Clear active task once completed or aborted
   */
  static clearTask(): void {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;
      window.sessionStorage.removeItem(PRIMARY_STORAGE_KEY);
      window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
