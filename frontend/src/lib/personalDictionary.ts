/**
 * Personal Dictionary Store for Voice Input (TASK-115)
 *
 * Persists user-defined acronyms, names, and custom jargon replacements
 * in client-side IndexedDB (eo_voice_dictionary). 100% offline and private.
 */

export interface DictionaryEntry {
  phrase: string;
  replacement: string;
  caseSensitive?: boolean;
}

const DB_NAME = "eo_voice_dictionary_db";
const STORE_NAME = "dictionary";
const DB_VERSION = 1;

class PersonalDictionaryStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryCache: Map<string, string> = new Map();

  constructor() {
    this.initDefaultEntries();
  }

  private initDefaultEntries() {
    // Seed common tech jargon often misheard by off-the-shelf ASR
    this.memoryCache.set("edge operator", "EdgeOperator");
    this.memoryCache.set("gemini nano", "Gemini Nano");
    this.memoryCache.set("scalance", "SCALANCE");
    this.memoryCache.set("web gpu", "WebGPU");
    this.memoryCache.set("sntp", "SNTP");
    this.memoryCache.set("wbm", "WBM");
  }

  private async openDB(): Promise<IDBDatabase | null> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return null;
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const req = window.indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: "phrase" });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }

  async addEntry(phrase: string, replacement: string): Promise<void> {
    const cleanPhrase = phrase.toLowerCase().trim();
    this.memoryCache.set(cleanPhrase, replacement.trim());

    const db = await this.openDB();
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ phrase: cleanPhrase, replacement: replacement.trim() });
    } catch {
      // Non-fatal storage catch
    }
  }

  async removeEntry(phrase: string): Promise<void> {
    const cleanPhrase = phrase.toLowerCase().trim();
    this.memoryCache.delete(cleanPhrase);

    const db = await this.openDB();
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(cleanPhrase);
    } catch {}
  }

  async getAllEntries(): Promise<DictionaryEntry[]> {
    const db = await this.openDB();
    if (!db) {
      return Array.from(this.memoryCache.entries()).map(([phrase, replacement]) => ({
        phrase,
        replacement,
      }));
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
          const stored = req.result as DictionaryEntry[];
          if (stored && stored.length > 0) {
            for (const item of stored) {
              this.memoryCache.set(item.phrase, item.replacement);
            }
          }
          resolve(
            Array.from(this.memoryCache.entries()).map(([phrase, replacement]) => ({
              phrase,
              replacement,
            }))
          );
        };
        req.onerror = () => {
          resolve(
            Array.from(this.memoryCache.entries()).map(([phrase, replacement]) => ({
              phrase,
              replacement,
            }))
          );
        };
      } catch {
        resolve(
          Array.from(this.memoryCache.entries()).map(([phrase, replacement]) => ({
            phrase,
            replacement,
          }))
        );
      }
    });
  }

  applyReplacements(text: string): string {
    if (!text) return "";
    let result = text;
    for (const [phrase, replacement] of this.memoryCache.entries()) {
      const regex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi");
      result = result.replace(regex, replacement);
    }
    return result;
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const personalDictionary = new PersonalDictionaryStore();
