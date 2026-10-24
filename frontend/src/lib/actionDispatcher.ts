/**
 * Human Interaction Dispatcher
 *
 * Uses browser-trusted input when a TrustedInputBridge is installed (Chrome extension + CDP),
 * otherwise synthetic DOM events (isTrusted === false; some sites ignore those).
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
import { smartQuerySelector, smoothScrollTo, isElementNode, isTextField, topLevelRect } from "./domUtils";

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

/**
 * Provider of browser-trusted input (isTrusted === true), e.g. the Chrome extension's
 * Chrome DevTools Protocol bridge. Coordinates are CSS pixels in the top-level viewport.
 * Each method resolves false when the provider could not deliver the input.
 */
export interface TrustedInputBridge {
  click(x: number, y: number): Promise<boolean>;
  hover(x: number, y: number): Promise<boolean>;
  insertText(text: string): Promise<boolean>;
  pressKey(key: "Enter" | "Tab" | "Escape" | "Backspace"): Promise<boolean>;
}

export type InputMode = "trusted" | "synthetic";

/** True when `node` is `ancestor` or inside it, crossing open shadow-root boundaries */
function composedContains(ancestor: Node, node: Node | null): boolean {
  let cur: Node | null = node;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parentNode || (cur instanceof ShadowRoot ? cur.host : null);
  }
  return false;
}

export class ActionDispatcher {
  private static trustedBridge: TrustedInputBridge | null = null;

  /** How the most recent click / type / hover was delivered; harness observations report it */
  public static lastInputMode: InputMode = "synthetic";

  /** Installs (or removes, with null) a trusted input provider. Without one, events are synthetic. */
  public static setTrustedInputBridge(bridge: TrustedInputBridge | null): void {
    this.trustedBridge = bridge;
  }

  public static hasTrustedInput(): boolean {
    return this.trustedBridge !== null;
  }

  /**
   * Viewport point for a trusted pointer event on `element`, or null when trusted input cannot
   * safely hit it: no bridge, running inside an iframe (bridge coordinates are top-frame), zero
   * size, or another element covers the centre (a real click would land on the overlay).
   */
  private static async trustedPoint(element: HTMLElement): Promise<{ x: number; y: number } | null> {
    if (!this.trustedBridge || typeof window === "undefined" || window !== window.top) return null;
    // Instant scroll: smooth scrolling would still be moving when the coordinates are used
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior });
    await this.pause(30);
    const local = element.getBoundingClientRect();
    if (local.width === 0 || local.height === 0) return null;

    // Occlusion check in the element's own document (it may sit in a same-origin iframe)
    const ownerDoc = element.ownerDocument || document;
    const lx = local.left + local.width / 2;
    const ly = local.top + local.height / 2;
    let hit = ownerDoc.elementFromPoint(lx, ly);
    while (hit && hit.shadowRoot) {
      const inner = hit.shadowRoot.elementFromPoint(lx, ly);
      if (!inner || inner === hit) break;
      hit = inner;
    }
    if (!hit || !(composedContains(element, hit) || composedContains(hit, element))) return null;

    // The click itself is delivered at top-level viewport coordinates
    const rect = topLevelRect(element);
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    if (ownerDoc !== document) {
      // ...where the outermost frame element must be what is actually on top
      let frameEl: Element | null = null;
      let win: Window | null = ownerDoc.defaultView;
      while (win && win !== window) {
        frameEl = win.frameElement;
        win = frameEl && frameEl.ownerDocument ? frameEl.ownerDocument.defaultView : null;
      }
      const topHit = document.elementFromPoint(x, y);
      if (!frameEl || topHit !== frameEl) return null;
    }
    return { x, y };
  }

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
    const element = isElementNode(target) ? target : this.resolveTarget(target).element;
    if (!element) return false;

    const isCanvasNode = (typeof target === "number" || typeof target === "string")
      && A11yTreeEngine.getNodeById(target)?.tag === "canvas-element";
    if (!isCanvasNode) {
      const point = await this.trustedPoint(element);
      if (point && this.trustedBridge && await this.trustedBridge.click(point.x, point.y)) {
        this.lastInputMode = "trusted";
        await this.pause(50);
        return true;
      }
    }
    this.lastInputMode = "synthetic";

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

    if (this.trustedBridge && window === window.top && await this.trustedBridge.click(clientX, clientY)) {
      this.lastInputMode = "trusted";
      await this.pause(30);
      return true;
    }
    this.lastInputMode = "synthetic";

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
    const element = isElementNode(target) ? target : this.resolveTarget(target).element;
    if (!element) return false;

    if (await this.typeTrusted(element, text, options)) {
      this.lastInputMode = "trusted";
      await this.pause(40);
      return true;
    }
    this.lastInputMode = "synthetic";

    smoothScrollTo(element);
    await this.pause(30);

    element.focus();
    element.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

    if (isTextField(element)) {
      const field = element as HTMLInputElement;
      if (options.clearFirst) {
        field.value = "";
      }

      const targetValue = options.clearFirst ? text : field.value + text;

      // Invoke the native prototype setter to bypass React/Angular getter/setter wrappers.
      // Taken from the element's own prototype so it also works for elements in same-origin iframes.
      const prototype = Object.getPrototypeOf(element);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, targetValue);
      } else {
        field.value = targetValue;
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
   * Trusted typing: real click to focus, select existing text when clearing, then CDP insertText.
   * Returns true only if the field afterwards actually contains the text; otherwise the caller
   * falls back to synthetic typing.
   */
  private static async typeTrusted(element: HTMLElement, text: string, options: TypeActionOptions): Promise<boolean> {
    const bridge = this.trustedBridge;
    if (!bridge) return false;
    const point = await this.trustedPoint(element);
    if (!point || !(await bridge.click(point.x, point.y))) return false;
    await this.pause(30);

    const isField = isTextField(element);
    if (options.clearFirst) {
      if (isField) {
        (element as HTMLInputElement).select();
      } else if (element.isContentEditable) {
        // The element's own document: a top-level selection would be ignored inside an iframe
        const doc = element.ownerDocument || document;
        const range = doc.createRange();
        range.selectNodeContents(element);
        const sel = doc.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    if (!(await bridge.insertText(text))) return false;
    await this.pause(30);

    const current = isField ? (element as HTMLInputElement).value : element.innerText.replace(/\n$/, "");
    // When clearing, anything but an exact match means the old text survived: fall back to synthetic
    if (options.clearFirst ? current !== text : !current.includes(text)) return false;
    if (options.pressEnter) await bridge.pressKey("Enter");
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
    const element = isElementNode(target) ? target : this.resolveTarget(target).element;
    if (!element) return false;

    const point = await this.trustedPoint(element);
    if (point && this.trustedBridge && await this.trustedBridge.hover(point.x, point.y)) {
      this.lastInputMode = "trusted";
      await this.pause(40);
      return true;
    }
    this.lastInputMode = "synthetic";

    smoothScrollTo(element);
    await this.pause(30);
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
    await this.pause(40);
    return true;
  }
}
