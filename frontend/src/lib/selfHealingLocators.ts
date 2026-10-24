/**
 * Self-Healing Element Locators (TASK-114)
 *
 * Implements resilient multi-strategy element targeting for dynamic SPAs.
 * Instead of brittle single-selector failures, elements are captured with 5 strategies:
 * 1. testId: data-testid, data-test, data-qa, data-cy attributes (Confidence: 0.99)
 * 2. roleAndName: WAI-ARIA role + accessible name (Confidence: 0.95)
 * 3. text: visible innerText or value matching (Confidence: 0.85)
 * 4. css: clean CSS selector (Confidence: 0.75)
 * 5. relativeAnchor: nearby landmark or heading text anchor (Confidence: 0.65)
 *
 * On replay or navigation, strategies are tried in order. If the primary selector fails
 * (e.g. dynamic class hash change), the locator self-heals using secondary strategies.
 */

import { smartQuerySelector, getCleanElementSelector, isWidgetElement } from "./domUtils.ts";

export interface SelfHealingLocator {
  testId?: string;
  roleAndName?: { role: string; name: string };
  text?: string;
  css?: string;
  relativeAnchor?: {
    anchorText: string;
    targetTag: string;
  };
}

export type LocatorStrategy = "testId" | "roleAndName" | "text" | "css" | "relativeAnchor" | "none";

export interface ResolvedLocatorResult {
  element: HTMLElement | null;
  strategyUsed: LocatorStrategy;
  confidence: number;
  healed: boolean; // True if primary strategy failed and a fallback succeeded
  matchDescription: string;
}

export class SelfHealingLocatorEngine {
  /**
   * Generates a 5-tier resilient locator definition for any DOM element.
   */
  public static generateLocator(el: HTMLElement): SelfHealingLocator {
    const loc: SelfHealingLocator = {};

    // 1. testId attribute
    const testIdAttr = el.getAttribute("data-testid")
      || el.getAttribute("data-test")
      || el.getAttribute("data-qa")
      || el.getAttribute("data-cy");
    if (testIdAttr) {
      loc.testId = testIdAttr;
    }

    // 2. role and accessible name
    const role = el.getAttribute("role") || el.tagName.toLowerCase();
    const name = el.getAttribute("aria-label")
      || el.getAttribute("title")
      || el.innerText?.slice(0, 50).trim()
      || (el as HTMLInputElement).placeholder
      || "";
    if (role && name) {
      loc.roleAndName = { role, name: name.replace(/\s+/g, " ") };
    }

    // 3. Normalized text
    const text = el.innerText?.slice(0, 60).trim();
    if (text && text.length > 1 && text.length < 50) {
      loc.text = text;
    }

    // 4. Clean CSS selector
    loc.css = getCleanElementSelector(el);

    // 5. Relative anchor (nearest heading or label)
    const anchor = this.findNearestAnchor(el);
    if (anchor) {
      loc.relativeAnchor = anchor;
    }

    return loc;
  }

  /**
   * Attempts to resolve an element using the multi-strategy hierarchy.
   */
  public static resolveLocator(
    locator: SelfHealingLocator | string,
    root?: ParentNode
  ): ResolvedLocatorResult {
    const targetRoot = root || (typeof document !== "undefined" ? document : null);
    if (!targetRoot) {
      return {
        element: null,
        strategyUsed: "none",
        confidence: 0,
        healed: false,
        matchDescription: "No DOM root available",
      };
    }

    // Handle plain string selector fallback
    if (typeof locator === "string") {
      const el = smartQuerySelector(locator, targetRoot);
      return {
        element: el,
        strategyUsed: el ? "css" : "none",
        confidence: el ? 0.75 : 0,
        healed: false,
        matchDescription: el ? `Matched via raw selector "${locator}"` : `Not found for "${locator}"`,
      };
    }

    let primaryFailed = false;

    // --- Strategy 1: testId ---
    if (locator.testId) {
      try {
        const query = `[data-testid="${locator.testId}"], [data-test="${locator.testId}"], [data-qa="${locator.testId}"], [data-cy="${locator.testId}"]`;
        const el = targetRoot.querySelector(query);
        if (el && !isWidgetElement(el)) {
          return {
            element: el as HTMLElement,
            strategyUsed: "testId",
            confidence: 0.99,
            healed: false,
            matchDescription: `Matched testId "${locator.testId}"`,
          };
        }
      } catch {}
      primaryFailed = true;
    }

    // --- Strategy 2: roleAndName ---
    if (locator.roleAndName) {
      const { role, name } = locator.roleAndName;
      const candidates = targetRoot.querySelectorAll(
        `[role="${role}"], ${role}, button, a, input, select`
      );
      const nameLower = name.toLowerCase().trim();

      for (const el of Array.from(candidates) as HTMLElement[]) {
        if (isWidgetElement(el)) continue;
        const accessibleName = (
          el.getAttribute("aria-label")
          || el.getAttribute("title")
          || el.innerText
          || (el as HTMLInputElement).placeholder
          || ""
        ).toLowerCase().trim();

        if (accessibleName === nameLower || accessibleName.includes(nameLower)) {
          return {
            element: el,
            strategyUsed: "roleAndName",
            confidence: 0.95,
            healed: primaryFailed,
            matchDescription: `Self-healed via role="${role}" and name="${name}"`,
          };
        }
      }
      primaryFailed = true;
    }

    // --- Strategy 3: text ---
    if (locator.text) {
      const textLower = locator.text.toLowerCase().trim();
      const candidates = targetRoot.querySelectorAll("button, a, span, label, [role='button'], div, p");
      for (const el of Array.from(candidates) as HTMLElement[]) {
        if (isWidgetElement(el)) continue;
        const t = el.innerText?.toLowerCase().trim();
        if (t === textLower) {
          return {
            element: el,
            strategyUsed: "text",
            confidence: 0.85,
            healed: primaryFailed,
            matchDescription: `Self-healed via visible text "${locator.text}"`,
          };
        }
      }
      primaryFailed = true;
    }

    // --- Strategy 4: clean CSS ---
    if (locator.css) {
      try {
        const el = smartQuerySelector(locator.css, targetRoot);
        if (el && !isWidgetElement(el)) {
          return {
            element: el,
            strategyUsed: "css",
            confidence: 0.75,
            healed: primaryFailed,
            matchDescription: `Self-healed via clean CSS selector "${locator.css}"`,
          };
        }
      } catch {}
      primaryFailed = true;
    }

    // --- Strategy 5: relativeAnchor ---
    if (locator.relativeAnchor) {
      const { anchorText, targetTag } = locator.relativeAnchor;
      const anchorEl = this.findAnchorByText(anchorText, targetRoot);
      if (anchorEl) {
        // Find nearest sibling or parent container containing targetTag
        const container = anchorEl.closest("section, article, form, div, tr, li") || anchorEl.parentElement;
        if (container) {
          const match = container.querySelector(targetTag);
          if (match && !isWidgetElement(match)) {
            return {
              element: match as HTMLElement,
              strategyUsed: "relativeAnchor",
              confidence: 0.65,
              healed: true,
              matchDescription: `Self-healed via relative anchor "${anchorText}" -> ${targetTag}`,
            };
          }
        }
      }
    }

    return {
      element: null,
      strategyUsed: "none",
      confidence: 0,
      healed: false,
      matchDescription: "All locator strategies failed to resolve target",
    };
  }

  /**
   * Converts a SelfHealingLocator into a modern Playwright locator expression string.
   */
  public static toPlaywrightSelector(loc: SelfHealingLocator): string {
    if (loc.testId) {
      return `page.getByTestId('${loc.testId}')`;
    }
    if (loc.roleAndName) {
      const role = loc.roleAndName.role.toLowerCase();
      const validRoles = ["button", "link", "textbox", "checkbox", "radio", "heading", "combobox", "tab"];
      if (validRoles.includes(role)) {
        return `page.getByRole('${role}', { name: '${loc.roleAndName.name.replace(/'/g, "\\'")}' })`;
      }
    }
    if (loc.text) {
      return `page.getByText('${loc.text.replace(/'/g, "\\'")}')`;
    }
    if (loc.css) {
      return `page.locator('${loc.css.replace(/'/g, "\\'")}')`;
    }
    return `page.locator('*')`;
  }

  private static findNearestAnchor(el: HTMLElement): { anchorText: string; targetTag: string } | null {
    if (typeof document === "undefined") return null;
    let cur: HTMLElement | null = el.parentElement;
    while (cur && cur !== document.body) {
      const heading = cur.querySelector("h1, h2, h3, h4, label, th");
      if (heading && heading !== el) {
        const text = (heading as HTMLElement).innerText?.slice(0, 30).trim();
        if (text) {
          return { anchorText: text, targetTag: el.tagName.toLowerCase() };
        }
      }
      cur = cur.parentElement;
    }
    return null;
  }

  private static findAnchorByText(text: string, root: ParentNode): HTMLElement | null {
    const textLower = text.toLowerCase().trim();
    const headings = root.querySelectorAll("h1, h2, h3, h4, label, th, legend");
    for (const h of Array.from(headings) as HTMLElement[]) {
      if (h.innerText?.toLowerCase().includes(textLower)) {
        return h;
      }
    }
    return null;
  }
}
