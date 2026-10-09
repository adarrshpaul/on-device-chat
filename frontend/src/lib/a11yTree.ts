/**
 * Accessibility Tree & Numeric Element Grounding Engine
 *
 * Implements SOTA Web Agent Element Selection (Mind2Web / Stagehand / Browser-Use):
 * 1. Traverses the live viewport for interactive elements.
 * 2. Filters hidden, disabled, and widget-internal chrome.
 * 3. Assigns clean 1-based integer IDs [1..N] in reading order.
 * 4. Produces token-efficient, semantic representation for compact local LLMs.
 * 5. Provides O(1) resolution from integer ID to live DOM Element.
 */

import { isWidgetElement, getCleanElementSelector } from "./domUtils";

export interface IA11yNode {
  id: number;
  role: string;
  name: string;
  tag: string;
  selector: string;
  element: HTMLElement;
  bounds: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  states: {
    disabled?: boolean;
    checked?: boolean;
    expanded?: boolean;
    selected?: boolean;
    focused?: boolean;
    value?: string;
    href?: string;
  };
}

export interface A11yScanOptions {
  maxItems?: number;
  viewportOnly?: boolean;
}

export class A11yTreeEngine {
  private static activeRegistry: Map<number, IA11yNode> = new Map();

  /**
   * Determine the explicit or implicit ARIA role of a DOM element
   */
  private static inferRole(el: HTMLElement): string {
    const explicitRole = el.getAttribute("role");
    if (explicitRole) return explicitRole.toLowerCase().trim();

    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "button":
        return "button";
      case "a":
        return el.hasAttribute("href") ? "link" : "button";
      case "input": {
        const type = (el as HTMLInputElement).type?.toLowerCase() || "text";
        if (type === "button" || type === "submit" || type === "reset") return "button";
        if (type === "checkbox") return "checkbox";
        if (type === "radio") return "radio";
        return `input[${type}]`;
      }
      case "select":
        return "combobox";
      case "textarea":
        return "textbox";
      case "canvas":
        return "canvas";
      case "h1":
      case "h2":
      case "h3":
        return `heading[${tag}]`;
      default:
        if (el.hasAttribute("onclick") || el.getAttribute("tabindex") === "0") {
          return "button";
        }
        return tag;
    }
  }

  /**
   * Determine the accessible name following the W3C Accessible Name Computation spec
   */
  private static computeAccessibleName(el: HTMLElement): string {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    if (ariaLabelledBy && typeof document !== "undefined") {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl && labelEl.textContent?.trim()) {
        return labelEl.textContent.trim();
      }
    }

    const title = el.getAttribute("title");
    if (title && title.trim()) return title.trim();

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.placeholder && el.placeholder.trim()) {
        return el.placeholder.trim();
      }
      if (el.value && el.value.trim() && el.type !== "password") {
        return el.value.trim();
      }
    }

    // Direct text content, trimmed and compact
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    return text.slice(0, 60);
  }

  /**
   * Check if element is genuinely visible and interactable in the viewport
   */
  private static isVisible(el: HTMLElement, viewportOnly: boolean = false): boolean {
    if (isWidgetElement(el)) return false;

    // Check style visibility
    if (typeof window !== "undefined") {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") < 0.05) {
        return false;
      }
      if (style.pointerEvents === "none") {
        return false;
      }
    }

    const rect = el.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2) return false;

    if (viewportOnly && typeof window !== "undefined") {
      // Element must overlap current screen viewport
      const inView =
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0;
      if (!inView) return false;
    }

    return true;
  }

  /**
   * Scan active page DOM and build a clean indexed a11y tree [1..N]
   */
  public static scan(options: A11yScanOptions = {}): IA11yNode[] {
    if (typeof document === "undefined") return [];

    const maxItems = options.maxItems || 36;
    const viewportOnly = options.viewportOnly ?? true;

    // Query all interactive selectors across the page
    const query = [
      "button",
      "a[href]",
      "input:not([type='hidden'])",
      "select",
      "textarea",
      "[role='button']",
      "[role='link']",
      "[role='tab']",
      "[role='checkbox']",
      "[role='switch']",
      "[role='menuitem']",
      "[role='combobox']",
      "[tabindex='0']",
      "h1",
      "h2",
      "canvas",
    ].join(", ");

    const rawElements = Array.from(document.querySelectorAll<HTMLElement>(query));

    // Filter, deduplicate child buttons inside parent buttons, and check visibility
    const visibleElements: HTMLElement[] = [];
    for (const el of rawElements) {
      if (this.isVisible(el, viewportOnly)) {
        // Prevent duplicate nested interactive nodes (e.g., span inside button)
        const parentInteractive = el.parentElement?.closest?.("button, a[href]");
        if (parentInteractive && parentInteractive !== el) {
          continue;
        }
        visibleElements.push(el);
      }
    }

    // Sort in visual reading order: top-to-bottom, then left-to-right
    visibleElements.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      // Allow 8px variance in Y to treat horizontally aligned elements on the same row
      if (Math.abs(rectA.top - rectB.top) > 8) {
        return rectA.top - rectB.top;
      }
      return rectA.left - rectB.left;
    });

    const nodes: IA11yNode[] = [];
    const registry = new Map<number, IA11yNode>();

    const sliced = visibleElements.slice(0, maxItems);
    sliced.forEach((el, index) => {
      const id = index + 1;
      const rect = el.getBoundingClientRect();
      const role = this.inferRole(el);
      const name = this.computeAccessibleName(el);
      const cleanSel = getCleanElementSelector(el);

      const inputEl = el as HTMLInputElement;
      const states: IA11yNode["states"] = {};

      if (el.hasAttribute("disabled") || (el as any).disabled) states.disabled = true;
      if (inputEl.type === "checkbox" || el.getAttribute("role") === "checkbox") {
        states.checked = inputEl.checked ?? (el.getAttribute("aria-checked") === "true");
      }
      if (el.getAttribute("aria-expanded")) {
        states.expanded = el.getAttribute("aria-expanded") === "true";
      }
      if (el.getAttribute("aria-selected")) {
        states.selected = el.getAttribute("aria-selected") === "true";
      }
      if (inputEl.value !== undefined && inputEl.type !== "password") {
        states.value = inputEl.value;
      }
      if (el.tagName.toLowerCase() === "a" && el.getAttribute("href")) {
        states.href = el.getAttribute("href")!;
      }
      if (document.activeElement === el) {
        states.focused = true;
      }

      const node: IA11yNode = {
        id,
        role,
        name,
        tag: el.tagName.toLowerCase(),
        selector: cleanSel,
        element: el,
        bounds: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        states,
      };

      nodes.push(node);
      registry.set(id, node);
    });

    this.activeRegistry = registry;
    return nodes;
  }

  /**
   * Look up a node by its 1-based integer ID
   */
  public static getNodeById(id: number | string): IA11yNode | undefined {
    const num = Number(id);
    if (!isNaN(num) && this.activeRegistry.has(num)) {
      const node = this.activeRegistry.get(num)!;
      // Verify node element is still attached to DOM
      if (node.element.isConnected) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Format scanned nodes into ultra-compact, token-efficient text representation
   */
  public static formatForPrompt(nodes: IA11yNode[]): string {
    if (nodes.length === 0) {
      return "No interactive elements detected on the current screen.";
    }

    return nodes
      .map((n) => {
        const stateFlags: string[] = [];
        if (n.states.disabled) stateFlags.push("disabled");
        if (n.states.checked !== undefined) stateFlags.push(`checked: ${n.states.checked}`);
        if (n.states.expanded !== undefined) stateFlags.push(`expanded: ${n.states.expanded}`);
        if (n.states.focused) stateFlags.push("focused");
        if (n.states.value && n.states.value.length > 0) stateFlags.push(`val: "${n.states.value.slice(0, 20)}"`);
        if (n.states.href) stateFlags.push(`href: "${n.states.href.slice(0, 30)}"`);

        const stateStr = stateFlags.length > 0 ? ` (${stateFlags.join(", ")})` : "";
        const labelStr = n.name ? ` "${n.name}"` : "";

        return `[${n.id}] ${n.role}${labelStr}${stateStr}`;
      })
      .join("\n");
  }

  /**
   * Get all active registered nodes
   */
  public static getActiveNodes(): IA11yNode[] {
    return Array.from(this.activeRegistry.values());
  }

  /**
   * Clear active registry
   */
  public static clear(): void {
    this.activeRegistry.clear();
  }
}
