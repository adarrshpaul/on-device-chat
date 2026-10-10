/**
 * WorkflowStore: Persistent Storage for On-Device Website Workflows & Automations
 *
 * Implements deterministic multi-step workflow persistence in IndexedDB.
 * Enables users to build, save, edit, and repeat site automations again and again with 0 token overhead.
 */

import { WebWorkflow } from "./types";

const DB_NAME = "gemma4_web_workflows";
const DB_VERSION = 1;
const STORE_NAME = "workflows";

const STARTER_WORKFLOWS: WebWorkflow[] = [
  {
    id: "wf_portfolio_tour",
    name: "🚀 Full Portfolio Guided Tour",
    description: "Step through the About hero, skills deck, featured projects, and contact footer.",
    siteOrigin: "*",
    isSystemStarter: true,
    executionCount: 0,
    createdAt: Date.now(),
    tags: ["tour", "navigation", "featured"],
    triggerPhrase: "tour",
    steps: [
      {
        id: "step_1",
        title: "Scroll to About Hero",
        action: "scroll",
        target: "#about",
        delayMs: 400,
        status: "idle",
      },
      {
        id: "step_2",
        title: "Inspect Core Skills & Engineering",
        action: "teleport",
        target: "skills",
        delayMs: 500,
        status: "idle",
      },
      {
        id: "step_3",
        title: "Navigate to Featured Projects Showcase",
        action: "teleport",
        target: "projects",
        delayMs: 500,
        status: "idle",
      },
      {
        id: "step_4",
        title: "Open Contact & Work Inquiries",
        action: "scroll",
        target: "#contact",
        delayMs: 300,
        status: "idle",
      },
    ],
  },
  {
    id: "wf_ai_engram_deepdive",
    name: "🧠 AI Architecture & Engram Deep Dive",
    description: "Inspect the on-device multi-model harness and neural cognitive engrams.",
    siteOrigin: "*",
    isSystemStarter: true,
    executionCount: 0,
    createdAt: Date.now(),
    tags: ["ai", "architecture", "engram"],
    triggerPhrase: "architecture",
    steps: [
      {
        id: "step_1",
        title: "Locate On-Device Chat Showcase",
        action: "scroll",
        target: "#projects",
        delayMs: 400,
        status: "idle",
      },
      {
        id: "step_2",
        title: "Verify Decision Engine Presence",
        action: "verify",
        target: "[data-testid='decision-card'], #projects",
        delayMs: 300,
        status: "idle",
      },
      {
        id: "step_3",
        title: "Focus Music Web DSP / Rust Engine",
        action: "teleport",
        target: "music.paulcreates.online",
        delayMs: 400,
        status: "idle",
      },
    ],
  },
  {
    id: "wf_theme_and_contrast",
    name: "🎨 Dark/Light Contrast & UI Check",
    description: "Audit theme toggling, color contrast, and navigation bar visibility.",
    siteOrigin: "*",
    isSystemStarter: true,
    executionCount: 0,
    createdAt: Date.now(),
    tags: ["ui", "theme", "contrast"],
    triggerPhrase: "theme",
    steps: [
      {
        id: "step_1",
        title: "Check Navigation Bar Header",
        action: "verify",
        target: "header, nav, [class*='navbar']",
        delayMs: 300,
        status: "idle",
      },
      {
        id: "step_2",
        title: "Verify Color Mode / Canvas Contrast",
        action: "verify",
        target: "canvas, #about, body",
        delayMs: 300,
        status: "idle",
      },
    ],
  },
];

class WorkflowStoreImpl {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private memoryCache: Map<string, WebWorkflow> = new Map();

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof window === "undefined") return;

    if (!this.initPromise) {
      this.initPromise = new Promise((resolve) => {
        if (!window.indexedDB) {
          this.loadFromLocalStorage();
          resolve();
          return;
        }

        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("by_origin", "siteOrigin", { unique: false });
          }
        };

        req.onsuccess = async () => {
          this.db = req.result;
          await this.seedDefaultsIfNeeded();
          resolve();
        };

        req.onerror = () => {
          console.warn("[WorkflowStore] IndexedDB error, falling back to LocalStorage:", req.error);
          this.loadFromLocalStorage();
          resolve();
        };
      });
    }

    return this.initPromise;
  }

  private loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem("g4_saved_workflows");
      if (raw) {
        const parsed = JSON.parse(raw) as WebWorkflow[];
        parsed.forEach((w) => this.memoryCache.set(w.id, w));
      } else {
        STARTER_WORKFLOWS.forEach((w) => this.memoryCache.set(w.id, { ...w }));
        this.syncToLocalStorage();
      }
    } catch {
      STARTER_WORKFLOWS.forEach((w) => this.memoryCache.set(w.id, { ...w }));
    }
  }

  private syncToLocalStorage(): void {
    try {
      const arr = Array.from(this.memoryCache.values());
      localStorage.setItem("g4_saved_workflows", JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private async seedDefaultsIfNeeded(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();

      countReq.onsuccess = () => {
        if (countReq.result === 0) {
          STARTER_WORKFLOWS.forEach((w) => store.put(w));
        }
        resolve();
      };
      countReq.onerror = () => resolve();
    });
  }

  /**
   * Retrieve all workflows matching the active site origin (or global wildcard)
   */
  async getWorkflowsForOrigin(siteOrigin: string = "*"): Promise<WebWorkflow[]> {
    await this.init();

    if (!this.db) {
      const list = Array.from(this.memoryCache.values());
      return list.filter((w) => w.siteOrigin === "*" || w.siteOrigin === siteOrigin);
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as WebWorkflow[]) || [];
        const filtered = all.filter((w) => w.siteOrigin === "*" || w.siteOrigin === siteOrigin);
        resolve(filtered);
      };
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Save or update a workflow
   */
  async saveWorkflow(workflow: WebWorkflow): Promise<void> {
    await this.init();
    this.memoryCache.set(workflow.id, workflow);
    this.syncToLocalStorage();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(workflow);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Delete a workflow by ID
   */
  async deleteWorkflow(id: string): Promise<void> {
    await this.init();
    this.memoryCache.delete(id);
    this.syncToLocalStorage();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Increment execution count and timestamp
   */
  async recordExecution(id: string): Promise<void> {
    const list = await this.getWorkflowsForOrigin();
    const target = list.find((w) => w.id === id);
    if (target) {
      target.executionCount = (target.executionCount || 0) + 1;
      target.lastRunAt = Date.now();
      await this.saveWorkflow(target);
    }
  }

  /**
   * Find matching workflow by intent or trigger phrase
   */
  async findMatchingWorkflow(siteOrigin: string, phrase: string): Promise<WebWorkflow | null> {
    const list = await this.getWorkflowsForOrigin(siteOrigin);
    const lower = phrase.toLowerCase().trim();

    return (
      list.find((w) => {
        if (w.triggerPhrase && lower.includes(w.triggerPhrase.toLowerCase())) return true;
        if (w.name.toLowerCase().includes(lower)) return true;
        return w.tags?.some((t) => lower.includes(t.toLowerCase())) ?? false;
      }) || null
    );
  }

  /**
   * Export all workflows to JSON
   */
  async exportWorkflows(): Promise<string> {
    const workflows = await this.getWorkflowsForOrigin();
    return JSON.stringify(workflows, null, 2);
  }

  /**
   * Import workflows from JSON string
   */
  async importWorkflows(jsonStr: string): Promise<number> {
    try {
      const parsed = JSON.parse(jsonStr) as WebWorkflow[];
      if (!Array.isArray(parsed)) return 0;
      let count = 0;
      for (const w of parsed) {
        if (w.id && w.name && Array.isArray(w.steps)) {
          await this.saveWorkflow(w);
          count++;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }
}

export const workflowStore = new WorkflowStoreImpl();
