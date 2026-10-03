/**
 * Dynamic Page Action Inferer
 *
 * Autonomously inspects the host webpage DOM in the background to understand
 * the current website and infer the most probable user actions.
 *
 * Replaces hardcoded suggestion pills with real, dynamically derived actions
 * from buttons, inputs, links, headings, and application state.
 */

import { ToolDefinition } from "./types";
import { isWidgetElement } from "./domUtils";

export interface InferredAction {
  id: string;
  label: string;
  prompt: string;
  category: "click" | "input" | "navigate" | "inspect";
  sourceElement?: string;
  confidence: number;
}

export interface PageAnalysisResult {
  pageTitle: string;
  pageHeading: string;
  totalInteractiveCount: number;
  buttonsFound: number;
  inputsFound: number;
  linksFound: number;
  inferredActions: InferredAction[];
  analyzedAt: number;
  status: "idle" | "scanning" | "inferring" | "ready";
  statusMessage: string;
}

export class PageActionInferer {
  private lastAnalysis: PageAnalysisResult | null = null;
  private listeners: Array<(result: PageAnalysisResult) => void> = [];

  subscribe(listener: (result: PageAnalysisResult) => void): () => void {
    this.listeners.push(listener);
    if (this.lastAnalysis) {
      listener(this.lastAnalysis);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(result: PageAnalysisResult) {
    this.lastAnalysis = result;
    for (const listener of this.listeners) {
      listener(result);
    }
  }

  /**
   * Run background DOM discovery and action inference
   */
  async analyzePage(customTools: ToolDefinition[] = []): Promise<PageAnalysisResult> {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return this.emptyResult();
    }

    // Phase 1: Transparent Scanning Status
    this.notify({
      pageTitle: document.title || "Webpage",
      pageHeading: "",
      totalInteractiveCount: 0,
      buttonsFound: 0,
      inputsFound: 0,
      linksFound: 0,
      inferredActions: [],
      analyzedAt: Date.now(),
      status: "scanning",
      statusMessage: "Inspecting current website layout, buttons, and interactive elements...",
    });

    // Run asynchronously so we don't block the main thread
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Phase 2: Extract DOM Context
    const pageTitle = document.title || "Web Application";
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";
    const h2 = document.querySelector("h2")?.textContent?.trim() || "";
    const pageHeading = h1 || h2 || pageTitle;

    // Collect interactive elements
    const buttons = Array.from(
      document.querySelectorAll("button, [role='button'], input[type='submit']")
    ).filter((el) => !isWidgetElement(el)) as HTMLElement[];

    const inputs = Array.from(
      document.querySelectorAll("input:not([type='hidden']):not([type='submit']), textarea, select")
    ).filter((el) => !isWidgetElement(el)) as HTMLInputElement[];

    const navLinks = Array.from(
      document.querySelectorAll("nav a, header a, a[href^='/'], a[href^='#']")
    ).filter((el) => !isWidgetElement(el)) as HTMLAnchorElement[];

    const totalInteractive = buttons.length + inputs.length + navLinks.length;

    // Phase 3: Infer Probable Actions
    this.notify({
      pageTitle,
      pageHeading,
      totalInteractiveCount: totalInteractive,
      buttonsFound: buttons.length,
      inputsFound: inputs.length,
      linksFound: navLinks.length,
      inferredActions: [],
      analyzedAt: Date.now(),
      status: "inferring",
      statusMessage: `Found ${buttons.length} buttons and ${inputs.length} inputs. Inferring most probable actions...`,
    });

    const inferred: InferredAction[] = [];

    // 1. Analyze Buttons & Nearby Card Context
    for (const btn of buttons.slice(0, 10)) {
      const btnText = (btn.textContent || btn.getAttribute("aria-label") || "").trim();
      if (!btnText || btnText.length > 40) continue;

      // Check if button is inside a product/item card with a title
      const card = btn.closest(".card, article, [class*='item'], [class*='product'], div");
      let itemTitle = "";
      if (card) {
        const titleEl = card.querySelector("h2, h3, h4, .title, strong");
        if (titleEl && titleEl !== btn) {
          itemTitle = (titleEl.textContent || "").trim();
        }
      }

      if (/add to cart/i.test(btnText)) {
        if (itemTitle) {
          inferred.push({
            id: `act_${inferred.length}`,
            label: `Add ${itemTitle} to cart`,
            prompt: `Add 2 ${itemTitle} to my cart`,
            category: "click",
            sourceElement: btn.id ? `#${btn.id}` : `button:contains('${btnText}')`,
            confidence: 0.95,
          });
        } else {
          inferred.push({
            id: `act_${inferred.length}`,
            label: `Click "${btnText}"`,
            prompt: `Click the "${btnText}" button on the page`,
            category: "click",
            sourceElement: btn.id ? `#${btn.id}` : undefined,
            confidence: 0.85,
          });
        }
      } else if (/checkout|buy|purchase/i.test(btnText)) {
        inferred.push({
          id: `act_${inferred.length}`,
          label: `Proceed to checkout`,
          prompt: `Click the checkout button and proceed`,
          category: "click",
          sourceElement: btn.id ? `#${btn.id}` : undefined,
          confidence: 0.92,
        });
      } else if (/sign up|subscribe|join|register/i.test(btnText)) {
        inferred.push({
          id: `act_${inferred.length}`,
          label: `${btnText}`,
          prompt: `Help me ${btnText.toLowerCase()} on this page`,
          category: "click",
          sourceElement: btn.id ? `#${btn.id}` : undefined,
          confidence: 0.88,
        });
      }
    }

    // 2. Analyze Inputs (Search bars, form fields)
    for (const input of inputs.slice(0, 5)) {
      const placeholder = input.placeholder || input.getAttribute("aria-label") || input.name || "";
      const isSearch =
        input.type === "search" ||
        /search|find|query/i.test(input.id || "") ||
        /search|find|query/i.test(placeholder);

      if (isSearch) {
        // Look for examples or extract keywords from placeholder (e.g. "try: 'headphones', 'smartwatch'")
        const tryMatch = placeholder.match(/(?:try|e\.g\.|example):\s*['"]?([a-zA-Z\s]+)['"]?/i);
        const searchSample = tryMatch ? tryMatch[1].trim() : "headphones";

        inferred.push({
          id: `act_${inferred.length}`,
          label: `Search for "${searchSample}"`,
          prompt: `Search for "${searchSample}" in the catalog search bar`,
          category: "input",
          sourceElement: input.id ? `#${input.id}` : "input[type='search']",
          confidence: 0.9,
        });
      }
    }

    // 3. Analyze Routes & Navigation
    for (const link of navLinks.slice(0, 8)) {
      const text = (link.textContent || "").trim();
      const href = link.getAttribute("href") || "";
      if (text && href && !href.startsWith("javascript:") && text.length < 25) {
        if (/checkout|cart|store|products|pricing|docs|settings|account/i.test(text + href)) {
          inferred.push({
            id: `act_${inferred.length}`,
            label: `Navigate to ${text}`,
            prompt: `Navigate to ${href} (${text})`,
            category: "navigate",
            sourceElement: `a[href='${href}']`,
            confidence: 0.86,
          });
        }
      }
    }

    // 4. Incorporate Host-Registered Tools
    for (const tool of customTools) {
      if (tool.function.name === "addToCart" && !inferred.some((a) => a.prompt.includes("cart"))) {
        inferred.push({
          id: `act_${inferred.length}`,
          label: `Add items to cart`,
          prompt: `Add 2 items to my cart`,
          category: "click",
          confidence: 0.88,
        });
      } else if (tool.function.name === "navigateTo" && !inferred.some((a) => a.category === "navigate")) {
        inferred.push({
          id: `act_${inferred.length}`,
          label: `Navigate site route`,
          prompt: `Navigate to /products`,
          category: "navigate",
          confidence: 0.85,
        });
      }
    }

    // 5. Always provide the universal page inspection action
    inferred.push({
      id: `act_${inferred.length}`,
      label: `Snapshot page elements`,
      prompt: `Snapshot the interactive elements on this page and explain what I can do here`,
      category: "inspect",
      confidence: 0.8,
    });

    // Deduplicate & sort by confidence, take top 4
    const uniqueActions = inferred
      .filter((act, idx, arr) => arr.findIndex((x) => x.prompt === act.prompt) === idx)
      .slice(0, 4);

    const finalResult: PageAnalysisResult = {
      pageTitle,
      pageHeading,
      totalInteractiveCount: totalInteractive,
      buttonsFound: buttons.length,
      inputsFound: inputs.length,
      linksFound: navLinks.length,
      inferredActions: uniqueActions,
      analyzedAt: Date.now(),
      status: "ready",
      statusMessage: `Inferred ${uniqueActions.length} actions from ${totalInteractive} elements on "${pageHeading || pageTitle}".`,
    };

    this.notify(finalResult);
    return finalResult;
  }

  private emptyResult(): PageAnalysisResult {
    return {
      pageTitle: "",
      pageHeading: "",
      totalInteractiveCount: 0,
      buttonsFound: 0,
      inputsFound: 0,
      linksFound: 0,
      inferredActions: [],
      analyzedAt: Date.now(),
      status: "idle",
      statusMessage: "Page analysis idle",
    };
  }
}

export const pageActionInferer = new PageActionInferer();
