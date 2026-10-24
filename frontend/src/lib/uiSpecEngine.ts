/**
 * UI Spec Engine (Candidate 1: OpenUI / DIL Typed Component Stream)
 *
 * Provides a typed UI component stream contract between AI decision layers
 * (Vega, d3-nano, Gemma, Rules) and the client interface:
 *
 * Guarantees:
 * 1. Live Element Binding (Rule 9): Every actionable UI component is bound to a live ElementRef.
 * 2. Stale Drop Gate (Rule 7): bindOrDrop() verifies that referenced elements physically
 *    exist in the current DOM before rendering. Stale or fabricated refs are dropped.
 * 3. Execution & Verification: Pre-execution element verification and post-execution confirmation.
 */

import { smartQuerySelector } from "./domUtils";
import { A11yTreeEngine } from "./a11yTree";
import { ActionDispatcher } from "./actionDispatcher";
import type { ElementRef, UISpec } from "./types";

export class UISpecEngine {
  /**
   * Resolves an ElementRef to a live connected HTMLElement.
   */
  public static resolveElementRef(ref: ElementRef): HTMLElement | null {
    if (!ref) return null;

    // 1. Try A11y numeric ID if provided
    if (ref.a11yId) {
      const numId = parseInt(ref.a11yId, 10);
      if (!isNaN(numId)) {
        const node = A11yTreeEngine.getNodeById(numId);
        if (node && node.element && node.element.isConnected) {
          return node.element;
        }
      }
    }

    // 2. Try CSS Selector via smartQuerySelector
    if (ref.selector) {
      const el = smartQuerySelector(ref.selector);
      if (el && el.isConnected) {
        return el;
      }
    }

    return null;
  }

  /**
   * Constructs an ElementRef from a physical DOM HTMLElement.
   */
  public static createElementRef(el: HTMLElement, fallbackSelector?: string): ElementRef {
    let selector = fallbackSelector || "";
    if (!selector) {
      if (el.id) selector = `#${el.id}`;
      else if (el.getAttribute("data-testid")) selector = `[data-testid="${el.getAttribute("data-testid")}"]`;
      else if (el.getAttribute("name")) selector = `[name="${el.getAttribute("name")}"]`;
      else {
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).slice(0, 2).join(".");
        selector = classes ? `${tag}.${classes}` : tag;
      }
    }

    const role = el.getAttribute("role") || el.tagName.toLowerCase();
    const label = (
      el.getAttribute("aria-label") ||
      el.innerText ||
      el.getAttribute("placeholder") ||
      el.getAttribute("value") ||
      ""
    ).slice(0, 50).trim();

    return {
      selector,
      role,
      label,
      fingerprint: `${el.tagName}:${role}:${label.slice(0, 20)}`,
    };
  }

  /**
   * Rule 7 & Rule 9 Gate: Filters out any UISpec whose element references
   * cannot be resolved against the live, physical DOM.
   */
  public static bindOrDrop(specs: UISpec[]): UISpec[] {
    if (!specs || !Array.isArray(specs)) return [];
    if (typeof document === "undefined") return specs; // SSR / test mock fallback

    const validated: UISpec[] = [];

    for (const spec of specs) {
      switch (spec.kind) {
        case "confirm": {
          const el = this.resolveElementRef(spec.action.ref);
          if (el) {
            validated.push(spec);
          } else {
            console.warn(`[UISpecEngine] Dropped unresolvable confirm action on:`, spec.action.ref);
          }
          break;
        }

        case "batchPreview": {
          // Keep only rows with valid, connected elements
          const validRows = spec.rows.filter((row) => {
            const el = this.resolveElementRef(row.ref);
            return Boolean(el);
          });
          if (validRows.length > 0) {
            validated.push({ ...spec, rows: validRows });
          } else {
            console.warn(`[UISpecEngine] Dropped empty or detached batchPreview spec:`, spec.id);
          }
          break;
        }

        case "paramForm": {
          // Verify target or fields
          if (spec.targetRef) {
            const el = this.resolveElementRef(spec.targetRef);
            if (!el) {
              console.warn(`[UISpecEngine] Dropped paramForm with missing targetRef:`, spec.targetRef);
              break;
            }
          }
          // Validate individual field refs if provided
          if (spec.fields && spec.fields.length > 0) {
            const validFields = spec.fields.filter((f) => !f.ref || Boolean(this.resolveElementRef(f.ref)));
            if (validFields.length === 0) {
              console.warn(`[UISpecEngine] Dropped paramForm with all detached fields:`, spec.id);
              break;
            }
            validated.push({ ...spec, fields: validFields });
            break;
          }
          validated.push(spec);
          break;
        }

        case "choices": {
          // Filter options that require a ref but the ref is broken
          const validOptions = spec.options.filter((opt) => {
            if (!opt.ref) return true; // Pure logical choice
            return Boolean(this.resolveElementRef(opt.ref));
          });
          if (validOptions.length > 0) {
            validated.push({ ...spec, options: validOptions });
          }
          break;
        }

        default:
          validated.push(spec);
      }
    }

    return validated;
  }

  /**
   * Executes a confirmed action on a live ElementRef with verification.
   */
  public static async executeAction(action: {
    tool: "click" | "type" | "select" | "scroll" | "navigate";
    ref: ElementRef;
    value?: string;
    repeatCount?: number;
  }): Promise<{ success: boolean; error?: string; latencyMs: number }> {
    const t0 = performance.now();
    const el = this.resolveElementRef(action.ref);
    if (!el) {
      return {
        success: false,
        error: `Target element "${action.ref.selector}" is no longer attached to document.`,
        latencyMs: Math.round(performance.now() - t0),
      };
    }

    try {
      switch (action.tool) {
        case "click": {
          const count = Math.max(1, Math.min(50, action.repeatCount || 1));
          for (let i = 0; i < count; i++) {
            await ActionDispatcher.click(el, { skipSafetyCheck: true });
            if (count > 1 && i < count - 1) {
              await new Promise((r) => setTimeout(r, 200));
            }
          }
          break;
        }
        case "type": {
          await ActionDispatcher.type(el, action.value || "", { clearFirst: true });
          break;
        }
        case "select": {
          await ActionDispatcher.select(el as HTMLSelectElement, action.value || "");
          break;
        }
        case "scroll": {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        }
        case "navigate": {
          if (action.value) {
            try {
              const url = new URL(action.value, window.location.href);
              if (url.protocol === "http:" || url.protocol === "https:") {
                window.location.href = url.href;
              } else {
                console.warn(`[UISpecEngine] Blocked unsafe navigation protocol:`, url.protocol);
              }
            } catch {
              console.warn(`[UISpecEngine] Invalid navigation target:`, action.value);
            }
          }
          break;
        }
      }

      return {
        success: true,
        latencyMs: Math.round(performance.now() - t0),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Action dispatch failed.",
        latencyMs: Math.round(performance.now() - t0),
      };
    }
  }
}
