/**
 * RecipeStore & Golden Exemplar Memory
 *
 * Implements the harness enhancement loop:
 * 1. Stores verified golden trajectories (traces with positive user feedback and expert judge PASS).
 * 2. Injects domain-specific few-shot exemplars into small local models (Nano, SmolLM2)
 *    so they instantly know how to navigate the current site's DOM.
 * 3. Compiles repeated multi-step agent actions into zero-latency deterministic host macros/recipes.
 */

export interface GoldenExemplar {
  id: string;
  siteOrigin: string;
  userGoal: string;
  actions: Array<{ tool: string; args: Record<string, unknown>; observationSummary?: string }>;
  verifiedAt: number;
}

export interface SiteMacroRecipe {
  id: string;
  siteOrigin: string;
  triggerPhrase: string;
  actions: Array<{ tool: string; args: Record<string, unknown> }>;
  executionCount: number;
  lastSuccessAt: number;
}

export function isActionGoal(goal: string): boolean {
  if (!goal) return false;
  const lower = goal.toLowerCase().trim();
  // Informational and question queries must NEVER be treated as action macros
  if (
    lower.endsWith("?") ||
    /^(what|how|who|why|where|when|can you|tell me|explain|describe|list)\b/i.test(lower) ||
    /\b(what\s+actions|what\s+can|how\s+can|what\s+is)\b/i.test(lower)
  ) {
    return false;
  }
  return /\b(click|open|navigate|goto|go to|scroll|toggle|type|fill|select|press|tour|visit)\b/i.test(lower);
}

class RecipeStoreImpl {
  private dbName = "gemma4_agent_recipes";
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
          if (!db.objectStoreNames.contains("exemplars")) {
            const store = db.createObjectStore("exemplars", { keyPath: "id" });
            store.createIndex("by_origin", "siteOrigin", { unique: false });
          }
          if (!db.objectStoreNames.contains("recipes")) {
            const store = db.createObjectStore("recipes", { keyPath: "id" });
            store.createIndex("by_origin", "siteOrigin", { unique: false });
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
   * Save a verified successful trajectory as a golden exemplar
   */
  async saveGoldenExemplar(exemplar: GoldenExemplar): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("exemplars", "readwrite");
      const store = tx.objectStore("exemplars");
      store.put(exemplar);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Find matching golden exemplars for the current site origin to inject as few-shot in-context learning
   */
  async getExemplarsForOrigin(siteOrigin: string, limit = 2): Promise<GoldenExemplar[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const tx = this.db!.transaction("exemplars", "readonly");
      const store = tx.objectStore("exemplars");
      const index = store.index("by_origin");
      const req = index.getAll(siteOrigin);

      req.onsuccess = () => {
        const results = req.result || [];
        resolve(results.slice(-limit));
      };
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Check if a deterministic macro/recipe matches the user's intent.
   * If found, the harness can bypass model generation and run the deterministic code directly!
   */
  async findMatchingMacro(siteOrigin: string, userGoal: string): Promise<SiteMacroRecipe | null> {
    if (!isActionGoal(userGoal)) return null;

    await this.init();
    if (!this.db) return null;

    const normalizedGoal = userGoal.toLowerCase().trim();

    return new Promise((resolve) => {
      const tx = this.db!.transaction("recipes", "readonly");
      const store = tx.objectStore("recipes");
      const index = store.index("by_origin");
      const req = index.getAll(siteOrigin);

      req.onsuccess = () => {
        const recipes = (req.result as SiteMacroRecipe[]) || [];
        // Strict exact action matching: do NOT use loose substring containment
        const match = recipes.find((r) => {
          if (!isActionGoal(r.triggerPhrase)) return false;
          const trigger = r.triggerPhrase.toLowerCase().trim();
          return trigger === normalizedGoal;
        });
        resolve(match || null);
      };
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Save or update a deterministic macro recipe
   */
  async saveMacroRecipe(recipe: SiteMacroRecipe): Promise<void> {
    if (!isActionGoal(recipe.triggerPhrase)) return;

    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("recipes", "readwrite");
      const store = tx.objectStore("recipes");
      store.put(recipe);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get all learned macros for the current origin
   */
  async getMacrosForOrigin(siteOrigin: string): Promise<SiteMacroRecipe[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const tx = this.db!.transaction("recipes", "readonly");
      const store = tx.objectStore("recipes");
      const index = store.index("by_origin");
      const req = index.getAll(siteOrigin);

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }
}

export const recipeStore = new RecipeStoreImpl();
