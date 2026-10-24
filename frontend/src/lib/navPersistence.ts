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

declare const chrome: any;

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
   * Serialize active in-flight task before page transition.
   * Persists to both sessionStorage and chrome.storage.session (cross-origin resilient).
   */
  static saveTask(task: Omit<InFlightTaskState, "createdAt">): void {
    const payload: InFlightTaskState = {
      ...task,
      createdAt: Date.now(),
    };
    const serialized = JSON.stringify(payload);

    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
        window.sessionStorage.setItem(LEGACY_STORAGE_KEY, serialized);
      }
    } catch (err) {
      console.warn("[NavPersistence] Failed to serialize in-flight task to sessionStorage:", err);
    }

    // Persist to chrome.storage.session (extension tier, survives cross-domain navigations)
    if (typeof chrome !== "undefined") {
      const sessionStore = chrome.storage?.session || chrome.storage?.local;
      if (sessionStore?.set) {
        sessionStore.set({ [PRIMARY_STORAGE_KEY]: payload }).catch(() => {});
      }
    }
  }

  /**
   * Retrieve and validate pending in-flight task on page load (synchronous sessionStorage check).
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
   * Retrieve pending in-flight task asynchronously, checking chrome.storage.session first
   * for cross-origin navigation continuation.
   */
  static async getPendingTaskAsync(): Promise<InFlightTaskState | null> {
    if (typeof chrome !== "undefined") {
      const sessionStore = chrome.storage?.session || chrome.storage?.local;
      if (sessionStore?.get) {
        try {
          const res = await sessionStore.get([PRIMARY_STORAGE_KEY]);
          const task = res?.[PRIMARY_STORAGE_KEY] as InFlightTaskState | undefined;
          if (task) {
            const age = Date.now() - (task.createdAt || 0);
            if (age <= MAX_TASK_AGE_MS && task.stepIndex < task.maxSteps) {
              return task;
            }
            await this.clearTaskAsync();
          }
        } catch {}
      }
    }
    return this.getPendingTask();
  }

  /**
   * Clear active task once completed or aborted.
   */
  static clearTask(): void {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(PRIMARY_STORAGE_KEY);
        window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch {}

    if (typeof chrome !== "undefined") {
      const sessionStore = chrome.storage?.session || chrome.storage?.local;
      if (sessionStore?.remove) {
        sessionStore.remove([PRIMARY_STORAGE_KEY]).catch(() => {});
      }
    }
  }

  static async clearTaskAsync(): Promise<void> {
    this.clearTask();
  }
}
