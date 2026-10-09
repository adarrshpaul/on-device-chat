/**
 * Synthetic Human Interaction Dispatcher
 *
 * Implements robust client-side event dispatching for modern reactive web apps
 * (React 19 SyntheticEvents, Angular Signals, Vue 3 Reactivity).
 *
 * Guarantees:
 * 1. Prototype Property Descriptor setters (bypasses framework input hijacking).
 * 2. Full synthetic event sequences (focus -> keydown -> input -> change -> blur).
 * 3. Human emulation (smooth scroll, micro-delays for framework change-detection).
 * 4. Unified target resolution (Integer ID [1..N] via A11yTree OR CSS selector fallback).
 */

import { A11yTreeEngine } from "./a11yTree";
import { smartQuerySelector } from "./domUtils";

export interface TargetResolutionResult {
  element: HTMLElement | null;
  identifierDescription: string;
  matchedVia: "a11y-id" | "css-selector" | "none";
}

export interface TypeActionOptions {
  clearFirst?: boolean;
  pressEnter?: boolean;
  delayMs?: number;
}

export class ActionDispatcher {
  /**
   * Resolve a target from an argument that may be an integer ID or a CSS selector
   */
  public static resolveTarget(rawTarget: unknown): TargetResolutionResult {
    if (rawTarget === undefined || rawTarget === null) {
      return { element: null, identifierDescription: "undefined", matchedVia: "none" };
    }

    // 1. Check if target is a number or numeric string (A11y Node ID)
    const numericId = Number(rawTarget);
    if (!isNaN(numericId) && numericId > 0 && Number.isInteger(numericId)) {
      const a11yNode = A11yTreeEngine.getNodeById(numericId);
      if (a11yNode && a11yNode.element.isConnected) {
        return {
          element: a11yNode.element,
          identifierDescription: `[${a11yNode.id}] ${a11yNode.role} "${a11yNode.name}"`,
          matchedVia: "a11y-id",
        };
      }
    }

    // 2. Check if target is a CSS selector string
    if (typeof rawTarget === "string" && rawTarget.trim().length > 0) {
      const clean = rawTarget.trim();
      // Check if string is "[3]" or "3"
      const bracketMatch = clean.match(/^\[?(\d+)\]?$/);
      if (bracketMatch) {
        const id = parseInt(bracketMatch[1], 10);
        const a11yNode = A11yTreeEngine.getNodeById(id);
        if (a11yNode && a11yNode.element.isConnected) {
          return {
            element: a11yNode.element,
            identifierDescription: `[${a11yNode.id}] ${a11yNode.role} "${a11yNode.name}"`,
            matchedVia: "a11y-id",
          };
        }
      }

      const el = smartQuerySelector(clean);
      if (el) {
        return {
          element: el,
          identifierDescription: `selector "${clean}"`,
          matchedVia: "css-selector",
        };
      }
    }

    return {
      element: null,
      identifierDescription: String(rawTarget),
      matchedVia: "none",
    };
  }

  /**
   * Micro-pause to allow asynchronous framework render cycles to hydrate
   */
  private static async pause(ms: number = 30): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Click an element with visual highlight and human mouse events
   */
  public static async click(element: HTMLElement): Promise<void> {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    await this.pause(50);

    // Mouse sequence: pointerdown -> mousedown -> pointerup -> mouseup -> click
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    element.focus();
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    element.click();

    await this.pause(50);
  }

  /**
   * Type text into an input field or contenteditable element
   * Uses prototype setter override to trigger React/Angular/Vue reactive bindings
   */
  public static async type(
    element: HTMLElement,
    text: string,
    options: TypeActionOptions = {}
  ): Promise<void> {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    await this.pause(30);

    element.focus();
    element.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (options.clearFirst) {
        element.value = "";
      }

      const targetValue = options.clearFirst ? text : element.value + text;

      // Invoke native prototype setter to bypass React/Angular getter/setter wrappers
      const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, targetValue);
      } else {
        element.value = targetValue;
      }

      // Dispatch full reactive input cycle
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      element.dispatchEvent(new Event("change", { bubbles: true }));

      if (options.pressEnter) {
        element.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          })
        );
        element.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          })
        );
      }
    } else if (element.isContentEditable) {
      element.innerText = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }

    await this.pause(40);
  }

  /**
   * Select a value from a <select> element
   */
  public static async select(element: HTMLSelectElement, value: string): Promise<boolean> {
    let matchedOption: HTMLOptionElement | null = null;
    const lower = value.toLowerCase();

    for (let i = 0; i < element.options.length; i++) {
      const opt = element.options[i];
      if (opt.value.toLowerCase() === lower || opt.text.toLowerCase().includes(lower)) {
        matchedOption = opt;
        break;
      }
    }

    if (matchedOption) {
      element.value = matchedOption.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    return false;
  }

  /**
   * Hover over an element with mouseover and mouseenter events
   */
  public static async hover(element: HTMLElement): Promise<void> {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    await this.pause(30);
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
    await this.pause(40);
  }
}
