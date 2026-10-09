/**
 * Set-of-Marks (SoM) In-DOM Visual Overlay Manager
 *
 * Implements SOTA Visual Grounding (Browser-Use / SeeClick / VisualWebArena):
 * Injects lightweight, non-blocking numeric badges [1], [2], [3] directly over
 * interactive element bounding boxes on the live webpage.
 *
 * Key Guarantees:
 * - pointer-events: none (zero click interference with the host page).
 * - Automatic teardown timer or explicit cleanup.
 * - Viewport-bounded positioning with high-contrast legibility.
 */

import { IA11yNode } from "./a11yTree";

const OVERLAY_CONTAINER_ID = "g4-som-overlay-root";

export class SomOverlayManager {
  private static cleanupTimer: any = null;

  /**
   * Get or create the root container for Set-of-Marks badges
   */
  private static getOrCreateRoot(): HTMLElement {
    if (typeof document === "undefined") {
      throw new Error("DOM not available for Set-of-Marks overlay");
    }

    let root = document.getElementById(OVERLAY_CONTAINER_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = OVERLAY_CONTAINER_ID;
      root.setAttribute("aria-hidden", "true");
      root.style.position = "fixed";
      root.style.top = "0";
      root.style.left = "0";
      root.style.width = "100%";
      root.style.height = "100%";
      root.style.pointerEvents = "none";
      root.style.zIndex = "999990"; // Just below the active spotlight
      root.style.overflow = "hidden";
      document.body.appendChild(root);
    }
    return root;
  }

  /**
   * Render Set-of-Marks numeric badges over all given a11y nodes
   */
  public static renderBadges(nodes: IA11yNode[], autoDismissMs: number = 3500): void {
    if (typeof document === "undefined" || nodes.length === 0) return;

    this.clearBadges();
    const root = this.getOrCreateRoot();

    const fragment = document.createDocumentFragment();

    nodes.forEach((node) => {
      const rect = node.element.getBoundingClientRect();
      // Skip if off-screen or collapsed
      if (rect.width <= 4 || rect.height <= 4) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      if (rect.right < 0 || rect.left > window.innerWidth) return;

      const badge = document.createElement("div");
      badge.className = "g4-som-badge";
      badge.style.position = "fixed";
      badge.style.top = `${Math.max(2, rect.top - 2)}px`;
      badge.style.left = `${Math.max(2, rect.left - 2)}px`;
      badge.style.pointerEvents = "none";
      badge.style.display = "flex";
      badge.style.alignItems = "center";
      badge.style.justifyContent = "center";
      badge.style.backgroundColor = "#4f46e5"; // Indigo-600
      badge.style.color = "#ffffff";
      badge.style.fontSize = "11px";
      badge.style.fontWeight = "700";
      badge.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      badge.style.padding = "1px 5px";
      badge.style.borderRadius = "4px";
      badge.style.border = "1px solid rgba(255, 255, 255, 0.9)";
      badge.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.4)";
      badge.style.transform = "translate(0, -50%)";
      badge.style.zIndex = "999991";
      badge.style.lineHeight = "1.2";
      badge.style.userSelect = "none";
      badge.innerText = `${node.id}`;

      // Bounding box outline
      const box = document.createElement("div");
      box.className = "g4-som-box";
      box.style.position = "fixed";
      box.style.top = `${rect.top}px`;
      box.style.left = `${rect.left}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.style.border = "1.5px dashed rgba(99, 102, 241, 0.6)";
      box.style.borderRadius = "3px";
      box.style.pointerEvents = "none";
      box.style.boxSizing = "border-box";

      fragment.appendChild(box);
      fragment.appendChild(badge);
    });

    root.appendChild(fragment);

    if (autoDismissMs > 0) {
      if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
      this.cleanupTimer = setTimeout(() => {
        this.clearBadges();
      }, autoDismissMs);
    }
  }

  /**
   * Remove all active badges and box outlines
   */
  public static clearBadges(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    const root = document.getElementById(OVERLAY_CONTAINER_ID);
    if (root) {
      root.innerHTML = "";
    }
  }

  /**
   * Remove overlay root completely from DOM
   */
  public static destroy(): void {
    this.clearBadges();
    const root = document.getElementById(OVERLAY_CONTAINER_ID);
    if (root && root.parentElement) {
      root.parentElement.removeChild(root);
    }
  }
}
