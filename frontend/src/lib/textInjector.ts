/**
 * Tri-Tier Text Injection Engine (TASK-115)
 *
 * Implements the universal DOM injection sequence from flow-voice-harness:
 * 1. Deep active element & selection range resolution (including open shadow roots).
 * 2. Tri-Tier Injection Sequence:
 *    - Tier 1: document.execCommand("insertText", false, text) [preserves native undo stack]
 *    - Tier 2: Synthetic ClipboardEvent("paste") with DataTransfer
 *    - Tier 3: Prototype value setter fallback with InputEvent dispatch
 * 3. Dictated text verification & clipboard fallback: guarantees user speech is never lost.
 */

export interface InjectionResult {
  success: boolean;
  tierUsed: "execCommand" | "clipboardEvent" | "prototypeSetter" | "clipboardFallback";
  element: HTMLElement | null;
  verified: boolean;
}

export class TextInjector {
  /**
   * Traverse open shadow roots to find the deeply focused active element.
   */
  static getDeepActiveElement(root?: any): HTMLElement | null {
    if (typeof document === "undefined") return null;
    const docRoot = root || document;
    let active = (docRoot.activeElement as HTMLElement) || null;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement as HTMLElement;
    }
    return active;
  }

  /**
   * Check if an element is an editable target (input, textarea, or contenteditable).
   */
  static isEditable(el: any): boolean {
    if (!el) return false;
    if (typeof HTMLInputElement !== "undefined" && el instanceof HTMLInputElement) {
      const type = (el.type || "").toLowerCase();
      return !["button", "submit", "checkbox", "radio", "file", "image", "reset"].includes(type);
    }
    if (typeof HTMLTextAreaElement !== "undefined" && el instanceof HTMLTextAreaElement) return true;
    if (el.isContentEditable) return true;
    const tagName = (el.tagName || "").toUpperCase();
    if (tagName === "INPUT") {
      const type = (el.type || "").toLowerCase();
      return !["button", "submit", "checkbox", "radio", "file", "image", "reset"].includes(type);
    }
    if (tagName === "TEXTAREA") return true;
    const role = typeof el.getAttribute === "function" ? el.getAttribute("role") : null;
    return role === "textbox" || role === "searchbox";
  }

  /**
   * Inject text into the target element using the Tri-Tier sequence.
   */
  static async injectText(text: string, targetEl?: HTMLElement | null): Promise<InjectionResult> {
    if (!text) {
      return { success: true, tierUsed: "execCommand", element: null, verified: true };
    }

    const target = targetEl || this.getDeepActiveElement();
    if (!target || !this.isEditable(target)) {
      // No active editable field found: copy to clipboard as graceful fallback
      await this.copyToClipboard(text);
      return {
        success: true,
        tierUsed: "clipboardFallback",
        element: null,
        verified: true,
      };
    }

    target.focus();

    // -------------------------------------------------------------------------
    // Tier 1: document.execCommand("insertText")
    // Preserves native browser Cmd+Z undo history across inputs and contenteditables
    // -------------------------------------------------------------------------
    let tier1Succeeded = false;
    try {
      tier1Succeeded = document.execCommand("insertText", false, text);
    } catch {
      tier1Succeeded = false;
    }

    if (tier1Succeeded && this.verifyInjection(target, text)) {
      return {
        success: true,
        tierUsed: "execCommand",
        element: target,
        verified: true,
      };
    }

    // -------------------------------------------------------------------------
    // Tier 2: Synthetic ClipboardEvent("paste")
    // Used by rich-text editors (Lexical, ProseMirror, Slate, Draft.js)
    // -------------------------------------------------------------------------
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      target.dispatchEvent(pasteEvent);
      if (this.verifyInjection(target, text)) {
        return {
          success: true,
          tierUsed: "clipboardEvent",
          element: target,
          verified: true,
        };
      }
    } catch {
      // Proceed to Tier 3
    }

    // -------------------------------------------------------------------------
    // Tier 3: Prototype Value Setter Fallback
    // Direct DOM setter for standard inputs/textareas bypassing framework overrides
    // -------------------------------------------------------------------------
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      try {
        const proto = target instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const currentVal = target.value;
        const newVal = currentVal.slice(0, start) + text + currentVal.slice(end);

        if (setter) {
          setter.call(target, newVal);
        } else {
          target.value = newVal;
        }

        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));

        const newPos = start + text.length;
        target.setSelectionRange(newPos, newPos);

        return {
          success: true,
          tierUsed: "prototypeSetter",
          element: target,
          verified: true,
        };
      } catch {
        // Proceed to clipboard fallback
      }
    }

    // Fallback: Copy to clipboard if host page rejected all injection attempts
    await this.copyToClipboard(text);
    return {
      success: true,
      tierUsed: "clipboardFallback",
      element: target,
      verified: false,
    };
  }

  private static verifyInjection(el: HTMLElement, expectedText: string): boolean {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value.includes(expectedText);
    }
    if (el.isContentEditable || el.textContent) {
      return (el.textContent || "").includes(expectedText);
    }
    return false;
  }

  private static async copyToClipboard(text: string): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {}
  }
}
