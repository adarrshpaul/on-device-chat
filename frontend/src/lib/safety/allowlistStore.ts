/**
 * Allowlist Storage Port & Implementations (TASK-117)
 *
 * Implements Dependency Inversion Principle (DIP):
 * Storage is abstracted behind an interface. NEVER uses the host page's localStorage,
 * preventing untrusted page scripts from modifying or reading the trusted origins allowlist.
 */

declare const chrome: any;

export interface IAllowlistStore {
  isAllowed(origin: string): Promise<boolean> | boolean;
  add(origin: string): Promise<void> | void;
  remove(origin: string): Promise<void> | void;
  getAll(): Promise<string[]> | string[];
  clear(): Promise<void> | void;
}

/**
 * In-memory allowlist store (Default for standalone widget / Node / testing).
 * Completely isolated from host page DOM and localStorage.
 */
export class MemoryAllowlistStore implements IAllowlistStore {
  private allowedOrigins = new Set<string>();

  isAllowed(origin: string): boolean {
    if (!origin) return false;
    return this.allowedOrigins.has(origin.toLowerCase().trim());
  }

  add(origin: string): void {
    if (!origin) return;
    this.allowedOrigins.add(origin.toLowerCase().trim());
  }

  remove(origin: string): void {
    if (!origin) return;
    this.allowedOrigins.delete(origin.toLowerCase().trim());
  }

  getAll(): string[] {
    return Array.from(this.allowedOrigins);
  }

  clear(): void {
    this.allowedOrigins.clear();
  }
}

/**
 * Extension sync storage allowlist store (Used when running in WebExtensions context).
 * Uses chrome.storage.sync/local which is isolated in the extension background/content script
 * sandbox and cannot be accessed or manipulated by page JavaScript.
 */
export class ExtensionAllowlistStore implements IAllowlistStore {
  private memoryFallback = new MemoryAllowlistStore();
  private storageKey = "eo_safety_allowlist_secure";

  private hasChromeStorage(): boolean {
    return typeof chrome !== "undefined" && Boolean(chrome.storage?.sync || chrome.storage?.local);
  }

  async isAllowed(origin: string): Promise<boolean> {
    if (!origin) return false;
    const clean = origin.toLowerCase().trim();

    if (!this.hasChromeStorage()) {
      return this.memoryFallback.isAllowed(clean);
    }

    const storage = chrome.storage.sync || chrome.storage.local;
    return new Promise((resolve) => {
      try {
        storage.get([this.storageKey], (res: any) => {
          const list: string[] = res?.[this.storageKey] || [];
          resolve(list.includes(clean));
        });
      } catch {
        resolve(this.memoryFallback.isAllowed(clean));
      }
    });
  }

  async add(origin: string): Promise<void> {
    if (!origin) return;
    const clean = origin.toLowerCase().trim();

    if (!this.hasChromeStorage()) {
      this.memoryFallback.add(clean);
      return;
    }

    const storage = chrome.storage.sync || chrome.storage.local;
    return new Promise((resolve) => {
      try {
        storage.get([this.storageKey], (res: any) => {
          const list: string[] = res?.[this.storageKey] || [];
          if (!list.includes(clean)) {
            list.push(clean);
            storage.set({ [this.storageKey]: list }, () => resolve());
          } else {
            resolve();
          }
        });
      } catch {
        this.memoryFallback.add(clean);
        resolve();
      }
    });
  }

  async remove(origin: string): Promise<void> {
    if (!origin) return;
    const clean = origin.toLowerCase().trim();

    if (!this.hasChromeStorage()) {
      this.memoryFallback.remove(clean);
      return;
    }

    const storage = chrome.storage.sync || chrome.storage.local;
    return new Promise((resolve) => {
      try {
        storage.get([this.storageKey], (res: any) => {
          const list: string[] = res?.[this.storageKey] || [];
          const updated = list.filter((item) => item !== clean);
          storage.set({ [this.storageKey]: updated }, () => resolve());
        });
      } catch {
        this.memoryFallback.remove(clean);
        resolve();
      }
    });
  }

  async getAll(): Promise<string[]> {
    if (!this.hasChromeStorage()) {
      return this.memoryFallback.getAll();
    }

    const storage = chrome.storage.sync || chrome.storage.local;
    return new Promise((resolve) => {
      try {
        storage.get([this.storageKey], (res: any) => {
          resolve(res?.[this.storageKey] || []);
        });
      } catch {
        resolve(this.memoryFallback.getAll());
      }
    });
  }

  async clear(): Promise<void> {
    this.memoryFallback.clear();
    if (!this.hasChromeStorage()) return;

    const storage = chrome.storage.sync || chrome.storage.local;
    return new Promise((resolve) => {
      try {
        storage.remove([this.storageKey], () => resolve());
      } catch {
        resolve();
      }
    });
  }
}
