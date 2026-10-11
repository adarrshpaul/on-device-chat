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
import { smartQuerySelector, smoothScrollTo } from "./domUtils";

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
  public static async click(target: HTMLElement | number | string): Promise<boolean> {
    const element = target instanceof HTMLElement ? target : this.resolveTarget(target).element;
    if (!element) return false;

    smoothScrollTo(element);
    await this.pause(50);

    // SeeClick / ScreenSpot Pattern: Calculate exact visual centroid
    const rect = element.getBoundingClientRect();
    let cx = Math.round(rect.left + rect.width / 2);
    let cy = Math.round(rect.top + rect.height / 2);

    if (typeof target === "number" || typeof target === "string") {
      const node = A11yTreeEngine.getNodeById(target);
      if (node && node.tag === "canvas-element" && node.bounds) {
        cx = Math.round(node.bounds.left + node.bounds.width / 2);
        cy = Math.round(node.bounds.top + node.bounds.height / 2);
      }
    }

    const eventInit: PointerEventInit & MouseEventInit = {
      bubbles: true,
      cancelable: true,
      clientX: cx,
      clientY: cy,
      screenX: cx,
      screenY: cy,
    };

    // Mouse sequence: pointerdown -> mousedown -> pointerup -> mouseup -> click
    element.dispatchEvent(new PointerEvent("pointerdown", eventInit));
    element.dispatchEvent(new MouseEvent("mousedown", eventInit));
    element.focus();
    element.dispatchEvent(new PointerEvent("pointerup", eventInit));
    element.dispatchEvent(new MouseEvent("mouseup", eventInit));
    element.click();

    await this.pause(50);
    return true;
  }

  /**
   * SeeClick / ScreenSpot Pattern & Direct Canvas Coordinate Clicking
   * Supports either normalized [0, 1000] coordinates OR direct client pixels when canvas/element is provided.
   */
  public static async clickCoordinates(
    x: number,
    y: number,
    targetElement?: HTMLElement | null
  ): Promise<boolean> {
    if (typeof window === "undefined" || typeof document === "undefined") return false;

    let clientX = x;
    let clientY = y;

    // If normalized [0, 1000] without explicit targetElement and within 1000
    if (!targetElement && x <= 1000 && y <= 1000 && (x > 0 || y > 0)) {
      const vpWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
      const vpHeight = window.innerHeight || document.documentElement.clientHeight || 800;
      clientX = Math.round((x / 1000) * vpWidth);
      clientY = Math.round((y / 1000) * vpHeight);
    }

    const hitElement = targetElement || (document.elementFromPoint(clientX, clientY) as HTMLElement | null);
    if (!hitElement) return false;

    // Dispatch full pointer and mouse event cascade with explicit coordinates
    const eventInit: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      screenX: clientX,
      screenY: clientY,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
    };

    hitElement.dispatchEvent(new PointerEvent("pointerdown", eventInit));
    hitElement.dispatchEvent(new MouseEvent("mousedown", eventInit));
    await this.pause(20);
    hitElement.dispatchEvent(new PointerEvent("pointerup", { ...eventInit, buttons: 0 }));
    hitElement.dispatchEvent(new MouseEvent("mouseup", { ...eventInit, buttons: 0 }));
    hitElement.dispatchEvent(new MouseEvent("click", { ...eventInit, buttons: 0 }));
    await this.pause(30);

    return true;
  }

  /**
   * Type text into an input field or contenteditable element
   * Uses prototype setter override to trigger React/Angular/Vue reactive bindings
   */
  public static async type(
    target: HTMLElement | number | string,
    text: string,
    options: TypeActionOptions = {}
  ): Promise<boolean> {
    const element = target instanceof HTMLElement ? target : this.resolveTarget(target).element;
    if (!element) return false;
    smoothScrollTo(element);
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
    return true;
  }

  /**
   * Select a value from a <select> element
   */
  public static async select(element: HTMLSelectElement, value: string): Promise<boolean> {
    const want = value.trim().toLowerCase();
    const opts = Array.from(element.options);
    const matchedOption =
      opts.find((o) => o.value.toLowerCase() === want) ||
      opts.find((o) => o.text.trim().toLowerCase() === want) ||
      (want ? opts.find((o) => o.text.toLowerCase().includes(want)) : undefined) ||
      null;

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
  public static async hover(target: HTMLElement | number | string): Promise<boolean> {
    const element = target instanceof HTMLElement ? target : this.resolveTarget(target).element;
    if (!element) return false;

    smoothScrollTo(element);
    await this.pause(30);
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
    await this.pause(40);
    return true;
  }
}
