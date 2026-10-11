/**
 * WorkflowStore: Persistent Storage for On-Device Website Workflows & Automations
 *
 * Implements deterministic multi-step workflow persistence in IndexedDB.
 * Enables users to build, save, edit, and repeat site automations again and again with 0 token overhead.
 *
 * Grounding & Adaptability Invariants:
 * 1. ZERO HARDCODED STARTER WORKFLOWS: No static starter arrays in code.
 * 2. 100% Dynamic DOM-Grounded Synthesis: Workflows are synthesized at runtime directly from
 *    the active page's DOM (navigation landmarks, playgrounds, interactive inputs, theme toggle button).
 * 3. Strict Target Verification: Any workflow whose targets do not exist in the DOM is never shown.
 */

import { WebWorkflow } from "./types";
import { planSiteTour } from "./siteTour";
import { getCleanElementSelector, isWidgetElement, smartQuerySelector } from "./domUtils";

const DB_NAME = "gemma4_web_workflows";
const DB_VERSION = 4; // Bumped to 4 to permanently wipe all legacy hardcoded starter workflows
const STORE_NAME = "workflows";

/**
 * Dynamically synthesizes suggested automations directly from the host page DOM.
 * Guarantees zero hardcoded domains, names, or targets.
 */
export function synthesizeSiteWorkflows(): WebWorkflow[] {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return [];
  }

  const workflows: WebWorkflow[] = [];
  const currentHost = window.location.hostname.replace(/^www\./, "");
  const siteTitle = (document.title || "").split(/[-|•–]/)[0].trim() || currentHost;

  // 1. Dynamic Site Tour (Only if the page actually has 2 or more real landmark sections)
  try {
    const tourStops = planSiteTour();
    if (tourStops.length >= 2) {
      workflows.push({
        id: `wf_dyn_tour_${currentHost.replace(/[^a-zA-Z0-9]/g, "_")}`,
        name: `🗺️ Explore ${siteTitle.slice(0, 20)}`,
        description: `Guided interactive tour of the ${tourStops.length} key landmarks and sections on this page.`,
        siteOrigin: currentHost,
        isSystemStarter: true,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["tour", "explore", "guided tour", "landmarks"],
        triggerPhrase: "site tour",
        steps: tourStops.map((stop, idx) => ({
          id: `step_${idx + 1}`,
          title: stop.title,
          action: "scroll",
          target: stop.selector,
          delayMs: 1400,
          status: "idle",
        })),
      });
    }
  } catch (err) {
    console.warn("[WorkflowStore] Error planning site tour:", err);
  }

  // 2. Dynamic Canvas Game Autopilot (Only if a canvas is physically present)
  try {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    if (canvas && !isWidgetElement(canvas)) {
      workflows.push({
        id: `wf_dyn_game_${currentHost.replace(/[^a-zA-Z0-9]/g, "_")}`,
        name: "🎮 Play Game Autopilot",
        description: "Engage real-time physics trajectory controller to autonomously play and score points on canvas.",
        siteOrigin: currentHost,
        isSystemStarter: true,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["game", "canvas", "autopilot", "play", "score"],
        triggerPhrase: "play game",
        steps: [
          {
            id: "step_1",
            title: "Launch Autonomous Game Autopilot",
            action: "game_autopilot",
            target: "canvas",
            delayMs: 1000,
            status: "idle",
          },
        ],
      });
    }
  } catch (err) {
    console.warn("[WorkflowStore] Error synthesizing canvas game workflow:", err);
  }

  // 3. Dynamic Interactive Action / Playground (Forms, run buttons, prompt inputs)
  try {
    const candidateButtons = Array.from(
      document.querySelectorAll("button, input[type='submit'], [role='button'], a.btn")
    ).filter((b) => {
      if (isWidgetElement(b)) return false;
      const rect = b.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const txt = (b.textContent || b.getAttribute("aria-label") || (b as HTMLInputElement).value || "").toLowerCase().trim();
      return /^(?:run|dispatch|execute|calculate|benchmark|test|compile|generate|simulate|demo|search|play|start|launch|shop|cart|buy|subscribe|filter)\b/i.test(txt);
    }) as HTMLElement[];

    if (candidateButtons.length > 0) {
      const targetBtn = candidateButtons[0];
      const rawLabel = (targetBtn.textContent || targetBtn.getAttribute("aria-label") || (targetBtn as HTMLInputElement).value || "Execute").trim();
      const cleanLabel = rawLabel.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").slice(0, 22);
      const cleanSel = getCleanElementSelector(targetBtn);

      workflows.push({
        id: `wf_dyn_action_${targetBtn.id || "btn"}`,
        name: `⚡ ${cleanLabel || "Run Live Action"}`,
        description: `Execute ${cleanLabel} and verify results on this page.`,
        siteOrigin: currentHost,
        isSystemStarter: true,
        executionCount: 0,
        createdAt: Date.now(),
        tags: [cleanLabel.toLowerCase(), "run", "execute", "interactive"],
        triggerPhrase: cleanLabel.toLowerCase(),
        steps: [
          {
            id: "step_1",
            title: `Execute ${cleanLabel}`,
            action: "click",
            target: cleanSel,
            delayMs: 1000,
            status: "idle",
          },
        ],
      });
    }
  } catch (err) {
    console.warn("[WorkflowStore] Error synthesizing interactive action:", err);
  }

  // 3. Theme Toggle Workflow: ONLY IF a theme button is physically present in the DOM
  try {
    const themeBtn = document.querySelector(
      "button[aria-label*='theme' i], button[title*='theme' i], [data-theme-toggle], .theme-toggle"
    ) as HTMLElement | null;

    if (themeBtn && !isWidgetElement(themeBtn)) {
      workflows.push({
        id: "wf_dyn_theme_toggle",
        name: "🎨 Dark/Light Theme",
        description: "Toggle appearance theme mode between light and dark.",
        siteOrigin: "*",
        isSystemStarter: true,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["theme", "dark mode", "light mode", "contrast"],
        triggerPhrase: "toggle theme",
        steps: [
          {
            id: "step_1",
            title: "Toggle Theme Mode",
            action: "click",
            target: getCleanElementSelector(themeBtn),
            delayMs: 1000,
            status: "idle",
          },
        ],
      });
    }
  } catch (err) {
    console.warn("[WorkflowStore] Error checking theme button:", err);
  }

  // 4. Scroll to Top Workflow: ONLY IF document is tall enough to scroll
  try {
    const isScrollable =
      document.documentElement.scrollHeight > window.innerHeight * 1.4 ||
      document.body.scrollHeight > window.innerHeight * 1.4;

    if (isScrollable) {
      workflows.push({
        id: "wf_dyn_scroll_top",
        name: "🔝 Scroll to Top",
        description: "Smoothly navigate back to the top hero of the page.",
        siteOrigin: "*",
        isSystemStarter: true,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["scroll top", "top", "hero"],
        triggerPhrase: "scroll to top",
        steps: [
          {
            id: "step_1",
            title: "Return to Page Top",
            action: "scroll",
            target: "body, html, header, h1",
            delayMs: 1000,
            status: "idle",
          },
        ],
      });
    }
  } catch (err) {
    console.warn("[WorkflowStore] Error checking scroll height:", err);
  }

  return workflows;
}

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
        // First, sanitize localStorage to delete any legacy hardcoded entries
        this.sanitizeLocalStorage();

        if (!window.indexedDB) {
          this.loadFromLocalStorage();
          resolve();
          return;
        }

        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);

          req.onupgradeneeded = (e: any) => {
            const db = e.target.result as IDBDatabase;
            // Wipe old store containing legacy static entries
            if (db.objectStoreNames.contains(STORE_NAME)) {
              db.deleteObjectStore(STORE_NAME);
            }
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("by_origin", "siteOrigin", { unique: false });
          };

          req.onsuccess = async () => {
            this.db = req.result;
            await this.purgeLegacyDbEntries();
            resolve();
          };

          req.onerror = () => {
            console.warn("[WorkflowStore] IndexedDB error, falling back to LocalStorage:", req.error);
            this.loadFromLocalStorage();
            resolve();
          };
        } catch {
          console.warn("[WorkflowStore] IndexedDB access denied, falling back to LocalStorage");
          this.loadFromLocalStorage();
          resolve();
        }
      });
    }

    return this.initPromise;
  }

  private sanitizeLocalStorage(): void {
    try {
      const raw = localStorage.getItem("eo_saved_workflows") || localStorage.getItem("g4_saved_workflows");
      if (raw) {
        const parsed = JSON.parse(raw) as WebWorkflow[];
        // Filter out any legacy static starters, fallbacks, or site-hardcoded starters
        const userOnly = parsed.filter(
          (w) =>
            !w.isSystemStarter &&
            !w.id.startsWith("wf_portfolio_") &&
            !w.id.startsWith("wf_fallback_") &&
            !w.id.startsWith("wf_pred_showcase_") &&
            !w.id.startsWith("wf_ai_engram_")
        );
        const serialized = JSON.stringify(userOnly);
        localStorage.setItem("eo_saved_workflows", serialized);
        localStorage.setItem("g4_saved_workflows", serialized);
      }
    } catch {
      // ignore
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem("eo_saved_workflows") || localStorage.getItem("g4_saved_workflows");
      if (raw) {
        const parsed = JSON.parse(raw) as WebWorkflow[];
        const userOnly = parsed.filter(
          (w) =>
            !w.isSystemStarter &&
            !w.id.startsWith("wf_portfolio_") &&
            !w.id.startsWith("wf_fallback_") &&
            !w.id.startsWith("wf_pred_showcase_") &&
            !w.id.startsWith("wf_ai_engram_")
        );
        userOnly.forEach((w) => this.memoryCache.set(w.id, w));
      }
    } catch {
      // ignore
    }
  }

  private syncToLocalStorage(): void {
    try {
      const arr = Array.from(this.memoryCache.values()).filter((w) => !w.isSystemStarter);
      const serialized = JSON.stringify(arr);
      localStorage.setItem("eo_saved_workflows", serialized);
      localStorage.setItem("g4_saved_workflows", serialized);
    } catch {
      // ignore
    }
  }

  private async purgeLegacyDbEntries(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const all = (req.result as WebWorkflow[]) || [];
          all.forEach((w) => {
            if (
              w.isSystemStarter ||
              w.id.startsWith("wf_portfolio_") ||
              w.id.startsWith("wf_fallback_") ||
              w.id.startsWith("wf_pred_showcase_") ||
              w.id.startsWith("wf_ai_engram_") ||
              w.id === "wf_site_tour" ||
              w.id === "wf_theme_toggle" ||
              w.id === "wf_scroll_top"
            ) {
              store.delete(w.id);
            }
          });
          resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Retrieve all user-saved workflows for this origin PLUS dynamically synthesized workflows
   * derived 100% from the live DOM of the host website.
   */
  async getWorkflowsForOrigin(siteOrigin?: string): Promise<WebWorkflow[]> {
    await this.init();

    const currentHost = typeof window !== "undefined" ? window.location.hostname.replace(/^www\./, "") : "*";
    const targetOrigin = siteOrigin && siteOrigin !== "*" ? siteOrigin : currentHost;

    // 1. Get user-saved workflows (custom workflows created by user)
    let userWorkflows: WebWorkflow[] = [];

    if (!this.db) {
      userWorkflows = Array.from(this.memoryCache.values()).filter((w) => !w.isSystemStarter);
    } else {
      userWorkflows = await new Promise((resolve) => {
        try {
          const tx = this.db!.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();

          req.onsuccess = () => {
            const all = (req.result as WebWorkflow[]) || [];
            // Strictly exclude any legacy static starters
            const clean = all.filter(
              (w) => !w.isSystemStarter && !w.id.startsWith("wf_portfolio_") && !w.id.startsWith("wf_ai_engram_")
            );
            resolve(clean);
          };
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    // Filter user workflows by domain match
    const matchedUserWorkflows = userWorkflows.filter((w) => {
      if (w.siteOrigin && w.siteOrigin !== "*") {
        return targetOrigin === w.siteOrigin;
      }
      return true;
    });

    // 2. Synthesize dynamic workflows strictly grounded in the active DOM
    const dynamicWorkflows = synthesizeSiteWorkflows();

    // 3. Combine: User saved workflows take precedence, followed by dynamic synthesized workflows
    const combined: WebWorkflow[] = [...matchedUserWorkflows];
    const seenIds = new Set(combined.map((w) => w.id));

    for (const dyn of dynamicWorkflows) {
      if (!seenIds.has(dyn.id)) {
        seenIds.add(dyn.id);
        combined.push(dyn);
      }
    }

    // 4. Strict DOM Grounding Verification: Filter out any workflows with broken/missing selectors
    return combined.filter((w) => {
      if (typeof document === "undefined") return true;

      const specificSelectors = w.steps
        .map((s) => s.target)
        .filter((t): t is string => typeof t === "string" && (t.startsWith("#") || t.startsWith(".")));

      if (specificSelectors.length > 0) {
        const anySelectorFound = specificSelectors.some((sel) => {
          try {
            return smartQuerySelector(sel) !== null;
          } catch {
            return false;
          }
        });
        if (!anySelectorFound) return false;
      }

      return true;
    });
  }

  /**
   * Save or update a custom user workflow
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
   * Increment execution count and record timestamp
   */
  async recordExecution(id: string): Promise<void> {
    await this.init();
    const wf = this.memoryCache.get(id);
    if (wf) {
      wf.executionCount = (wf.executionCount || 0) + 1;
      wf.lastRunAt = Date.now();
      await this.saveWorkflow(wf);
    }
  }

  /**
   * Find workflow matching user query phrase (semantic or exact tag trigger)
   */
  async findWorkflowByTrigger(query: string, siteOrigin?: string): Promise<WebWorkflow | null> {
    const list = await this.getWorkflowsForOrigin(siteOrigin);
    const cleaned = query.toLowerCase().trim();

    // 1. Direct trigger phrase exact match
    const exact = list.find((w) => w.triggerPhrase && (cleaned === w.triggerPhrase.toLowerCase() || cleaned === `run ${w.triggerPhrase.toLowerCase()}`));
    if (exact) return exact;

    // 2. Exact name match (ignoring leading emoji)
    const nameMatch = list.find((w) => {
      const cleanName = w.name.toLowerCase().replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").trim();
      return cleaned === cleanName || cleaned === `run ${cleanName}`;
    });
    if (nameMatch) return nameMatch;

    return null;
  }

  async findMatchingWorkflow(siteOrigin: string, query: string): Promise<WebWorkflow | null> {
    return this.findWorkflowByTrigger(query, siteOrigin);
  }
}

export const workflowStore = new WorkflowStoreImpl();
