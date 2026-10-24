/**
 * Action Classifier (TASK-117)
 *
 * Implements Open/Closed Principle (OCP):
 * Pure, table-driven classification mapping DOM targets and tool payloads
 * to safety categories with 0 hardcoded site selectors (Rule 9 compliant).
 *
 * Prioritizes irreversible pattern matching strictly BEFORE any benign/safe
 * substring checks to prevent bypass vulnerabilities like "Next: Place order"
 * or "Show more and buy now".
 */

export type IrreversibleCategory =
  | "financial"
  | "destructive"
  | "communication"
  | "transfer";

export interface SafetyClassification {
  isIrreversible: boolean;
  category?: IrreversibleCategory;
  reason?: string;
  targetDescription: string;
  actionType: "click" | "type" | "submit" | "navigate" | "select" | "coordinate_click" | "other";
  origin: string;
}

export interface SafetyActionTarget {
  actionType: "click" | "type" | "submit" | "navigate" | "select" | "coordinate_click" | "other";
  element?: HTMLElement | null;
  targetDescription?: string;
  url?: string;
  value?: string;
  origin?: string;
  coordinates?: { x: number; y: number };
  pressEnter?: boolean;
}

interface RuleEntry {
  category: IrreversibleCategory;
  pattern: RegExp;
  reasonPrefix: string;
}

// Table of Irreversible Classification Rules (OCP Compliant)
const CLASSIFICATION_RULES: RuleEntry[] = [
  // 1. Destructive actions: deletion, drop, purge, close account, revoke
  {
    category: "destructive",
    pattern:
      /\b(?:delet(?:e|ion)(?:\s+(?:account|user|all|item|row|project|database|profile|repo))?|confirm\s+delet(?:e|ion)|close\s+account|remove(?:\s+(?:account|user|all|member))?|destroy|drop\s+table|erase|purge|terminate(?:\s+(?:account|contract))?|cancel\s+(?:subscription|membership|account|plan)|wipe(?:\s+(?:data|all|drive))?|reset\s+(?:to\s+factory|all|account)|revoke(?:\s+(?:key|token|access|cert|credential|permission))?)\b/i,
    reasonPrefix: "Destructive action detected",
  },

  // 2. Financial actions: pay, checkout, buy, order, charge
  {
    category: "financial",
    pattern:
      /\b(?:check\s*out|pay(?:ment)?|purchase|buy(?:\s+now)?|place\s+order|confirm\s+order|complete\s+order|subscribe(?:\s+now)?|charge\s+card|submit\s+payment|make\s+payment|buy\s+license|show\s+more\s+and\s+buy\s+now|next:?\s+place\s+order)\b/i,
    reasonPrefix: "Financial payment / purchase action detected",
  },

  // 3. Transfer actions: transfer funds, wire, withdraw
  {
    category: "transfer",
    pattern:
      /\b(?:transfer(?:\s+(?:funds|money|ownership|domain))?|wire\s+transfer|withdraw(?:\s+funds)?)\b/i,
    reasonPrefix: "Asset / fund transfer action detected",
  },

  // 4. Communication actions: send email/message, broadcast, tweet
  {
    category: "communication",
    pattern:
      /\b(?:send(?:\s+(?:message|email|invite|dispatch|money))?|publish(?:\s+(?:post|article|release|package))?|broadcast|tweet|post\s+(?:comment|reply|status))\b/i,
    reasonPrefix: "Public or irreversible communication action detected",
  },
];

// Dangerous URL path segments that indicate financial checkout or deletion endpoints
const IRREVERSIBLE_URL_REGEX =
  /\/(?:checkout|pay(?:ment)?|purchase|buy|delete-account|terminate|transfer-funds|send-message)\b/i;

// Strictly safe patterns that are checked ONLY when none of the irreversible rules match
const SAFE_CONTEXT_REGEX =
  /^(?:search|view\s+orders?|order\s+history|track\s+order|read\s+post|view\s+post|cancel(?:\s+dialog|\s+modal)?$|close(?:\s+dialog|\s+modal|\s+drawer)?$|dismiss|filter|sort|next|previous|prev|back|expand|collapse|copy|download(?:\s+receipt|\s+resume)?|details|inspect|see\s+more|show\s+more)$/i;

export class ActionClassifier {
  /**
   * Determine current active origin safely without crashing in Node.js
   */
  public static getCurrentOrigin(): string {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return "http://localhost";
  }

  /**
   * Classify a target action to determine if it is irreversible.
   * Pure function: produces deterministic results without side effects.
   */
  public static classify(target: SafetyActionTarget): SafetyClassification {
    const origin = target.origin || this.getCurrentOrigin();
    const actionType = target.actionType;

    // 1. URL navigation inspection
    if (actionType === "navigate" || target.url) {
      const urlStr = target.url || "";
      if (IRREVERSIBLE_URL_REGEX.test(urlStr)) {
        return {
          isIrreversible: true,
          category: "financial",
          reason: `Navigation to payment or checkout endpoint ("${urlStr}")`,
          targetDescription: `navigate -> ${urlStr}`,
          actionType: "navigate",
          origin,
        };
      }
    }

    // 2. Coordinate Click element resolution
    let element = target.element;
    if (!element && target.coordinates && typeof document !== "undefined" && document.elementFromPoint) {
      try {
        element = document.elementFromPoint(target.coordinates.x, target.coordinates.y) as HTMLElement | null;
      } catch {
        // Element resolution failure fallback
      }
    }

    // 3. Extract all relevant semantic text from element and target descriptor
    const textPieces: string[] = [];

    if (target.targetDescription) {
      textPieces.push(target.targetDescription);
    }

    if (element) {
      const ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel) textPieces.push(ariaLabel);

      const title = element.getAttribute("title");
      if (title) textPieces.push(title);

      const innerText = element.innerText || element.textContent;
      if (innerText) textPieces.push(innerText.trim());

      const val = (element as HTMLInputElement).value;
      if (typeof val === "string" && val.length > 0) textPieces.push(val);

      const btnName = element.getAttribute("name");
      if (btnName) textPieces.push(btnName);

      const dataAction = element.getAttribute("data-action");
      if (dataAction) textPieces.push(dataAction);

      // Check form association
      const form = element.closest("form") as HTMLFormElement | null;
      if (form) {
        if (form.action) textPieces.push(form.action);
        const formAria = form.getAttribute("aria-label");
        if (formAria) textPieces.push(formAria);
      }

      // Check anchor link association
      const anchor = element.closest("a") as HTMLAnchorElement | null;
      if (anchor && anchor.href) {
        textPieces.push(anchor.href);
      }
    }

    // If typing with pressEnter, check if it submits a form or triggers action
    if (target.pressEnter && element) {
      const form = element.closest("form");
      if (form) {
        textPieces.push("submit form");
        if (form.action) textPieces.push(form.action);
      }
    }

    const combinedText = textPieces.join(" ").trim();
    const desc = target.targetDescription || combinedText.slice(0, 80) || `${actionType} target`;

    if (!combinedText) {
      return {
        isIrreversible: false,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // 4. Check Table-Driven Irreversible Rules FIRST (No safe context bypass allowed!)
    for (const rule of CLASSIFICATION_RULES) {
      if (rule.pattern.test(combinedText)) {
        const match = combinedText.match(rule.pattern);
        return {
          isIrreversible: true,
          category: rule.category,
          reason: `${rule.reasonPrefix} ("${match ? match[0] : "matched"}")`,
          targetDescription: desc,
          actionType,
          origin,
        };
      }
    }

    // 5. Standalone dismiss/cancel buttons in modals (only if NO irreversible pattern matched)
    const isSingleCancel = /^(?:cancel|close|dismiss|back|abort)$/i.test(combinedText.trim());
    if (isSingleCancel) {
      return {
        isIrreversible: false,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // 6. Safe Context check
    if (SAFE_CONTEXT_REGEX.test(combinedText.trim())) {
      return {
        isIrreversible: false,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // Default: not irreversible
    return {
      isIrreversible: false,
      targetDescription: desc,
      actionType,
      origin,
    };
  }
}
