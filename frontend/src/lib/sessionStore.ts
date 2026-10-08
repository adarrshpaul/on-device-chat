/**
 * Persistent Session & Chat History Store
 *
 * Implements local-first IndexedDB persistence for:
 * 1. Multi-session chat conversations (titles, timestamps, message logs).
 * 2. Active session switching, creating new sessions, deleting sessions.
 * 3. Session export / resume across page reloads.
 *
 * Follows zero-cloud data residency principles (all transcripts remain on-device).
 */

import { DisplayMessage } from "../hooks/useChat";

export interface ChatSession {
  id: string;
  title: string;
  siteOrigin: string;
  createdAt: number;
  updatedAt: number;
  messages: DisplayMessage[];
}

class SessionStoreImpl {
  private dbName = "gemma4_chat_sessions";
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
          if (!db.objectStoreNames.contains("sessions")) {
            const store = db.createObjectStore("sessions", { keyPath: "id" });
            store.createIndex("by_origin", "siteOrigin", { unique: false });
            store.createIndex("by_updated", "updatedAt", { unique: false });
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
   * List all stored sessions for the current site origin (most recent first)
   */
  async listSessions(siteOrigin?: string): Promise<ChatSession[]> {
    await this.init();
    if (!this.db) return [];

    const origin = siteOrigin || (typeof window !== "undefined" ? window.location.origin : "web");

    return new Promise((resolve) => {
      const tx = this.db!.transaction("sessions", "readonly");
      const store = tx.objectStore("sessions");
      const index = store.index("by_origin");
      const req = index.getAll(origin);

      req.onsuccess = () => {
        const list = (req.result || []) as ChatSession[];
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Get a single session by ID
   */
  async getSession(id: string): Promise<ChatSession | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db!.transaction("sessions", "readonly");
      const store = tx.objectStore("sessions");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Save or update a session
   */
  async saveSession(session: ChatSession): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("sessions", "readwrite");
      const store = tx.objectStore("sessions");
      store.put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Delete a session by ID
   */
  async deleteSession(id: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("sessions", "readwrite");
      const store = tx.objectStore("sessions");
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const sessionStore = new SessionStoreImpl();
