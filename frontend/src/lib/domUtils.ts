/**
 * DOM Utilities for Autonomous Web Agent Harness
 *
 * Provides fault-tolerant selector resolution, prevents DOMException crashes
 * on invalid LLM selectors, and excludes internal widget UI from agent operations.
 */

export function isWidgetElement(el: Element | null): boolean {
  if (!el) return false;
  return !!el.closest?.("[data-g4-widget], .g4-widget-container, #gemma4-widget-root, #chat-widget, #g4-agent-spotlight");
}

/**
 * Generates a clean, valid, copy-pasteable CSS selector for any DOM element.
 * Guarantees that class names containing Tailwind brackets [..] or slashes are not emitted as raw selectors.
 */
export function getCleanElementSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id && /^[a-zA-Z0-9_-]+$/.test(el.id)) {
    return `#${el.id}`;
  }
  if (el.getAttribute("aria-label")) {
    const label = el.getAttribute("aria-label")!.trim().replace(/'/g, "\\'");
    return `${tag}[aria-label='${label}']`;
  }
  if (el.getAttribute("title")) {
    const title = el.getAttribute("title")!.trim().replace(/'/g, "\\'");
    return `${tag}[title='${title}']`;
  }
  if (el.getAttribute("name")) {
    return `${tag}[name='${el.getAttribute("name")}']`;
  }
  if (tag === "a" && el.getAttribute("href") && !el.getAttribute("href")?.startsWith("javascript:")) {
    return `a[href='${el.getAttribute("href")}']`;
  }
  if (el.getAttribute("data-id")) {
    return `${tag}[data-id='${el.getAttribute("data-id")}']`;
  }
  if (el.getAttribute("data-row-id")) {
    return `${tag}[data-row-id='${el.getAttribute("data-row-id")}']`;
  }

  const rawText = (el.textContent || (el as HTMLInputElement).value || "").trim().slice(0, 30);

  // Look for a clean, non-utility class
  const safeClass = Array.from(el.classList).find((c) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c) && !c.includes("[") && !c.includes("/") && !c.includes(":"));
  if (safeClass) {
    // If multiple elements share this class, attach the text so smartQuerySelector matches the exact one
    if (rawText && typeof document !== "undefined" && document.querySelectorAll(`.${safeClass}`).length > 1) {
      return `${tag}.${safeClass} '${rawText}'`;
    }
    return `${tag}.${safeClass}`;
  }

  if (rawText) {
    return `${tag} '${rawText}'`;
  }

  return tag;
}

/**
 * Fault-tolerant querySelector.
 * Never throws DOMException (e.g., on unescaped Tailwind brackets or hallucinated selectors).
 * Supports:
 * 1. Native querySelector
 * 2. Direct ID matching (#id or plain id)
 * 3. Sanitized CSS class queries
 * 4. Case-insensitive attribute queries (aria-label, title)
 * 5. Full semantic matching over accessible names, classes, data attributes, and token overlaps
 */
export function smartQuerySelector(rawSelector: string, root: ParentNode = document): HTMLElement | null {
  if (!rawSelector || typeof rawSelector !== "string") return null;
  const selector = rawSelector.trim();

  // 1. Direct native querySelector
  try {
    const el = root.querySelector(selector);
    if (el && !isWidgetElement(el)) return el as HTMLElement;
  } catch {
    // Syntax error in rawSelector — continue to smart recovery
  }

  // 2. Direct ID lookup (handles #foo or just foo)
  const idClean = selector.replace(/^[#]/, "").trim();
  if (/^[a-zA-Z0-9_-]+$/.test(idClean)) {
    const el = document.getElementById(idClean);
    if (el && !isWidgetElement(el)) return el;
  }

  // 3. Remove Tailwind bracketed classes if present: e.g. "button.text-[10px]" -> "button"
  try {
    const sanitized = selector
      .replace(/(\.[\w-]+)?\[[\w-%]+\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (sanitized && sanitized !== selector) {
      const el = root.querySelector(sanitized);
      if (el && !isWidgetElement(el)) return el as HTMLElement;
    }
  } catch {}

  // 4. Semantic attribute, accessible name, and token matching fallback
  try {
    const tagMatch = selector.match(/^(button|a|input|select|h[1-6]|span|div|p)\b/i);
    const targetTag = tagMatch ? tagMatch[1].toLowerCase() : "*";

    // Extract target phrase and tokens
    let searchPhrase = selector;
    const quoteMatch = selector.match(/['"]([^'"]+)['"]/);
    if (quoteMatch) {
      searchPhrase = quoteMatch[1];
    } else {
      searchPhrase = searchPhrase
        .replace(/^(button|a|input|select|h[1-6]|span|div|p)\b/i, "")
        .replace(/[#.:[\]]/g, " ")
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const phraseLower = searchPhrase.toLowerCase().trim();
    const tokens = phraseLower.split(/\s+/).filter((t) => t.length > 1);

    // Direct case-insensitive attribute match if phrase exists
    if (phraseLower) {
      try {
        const attrMatches = root.querySelectorAll(
          `${targetTag}[aria-label*="${phraseLower}" i], ${targetTag}[title*="${phraseLower}" i], [aria-label*="${phraseLower}" i]`
        );
        for (const el of Array.from(attrMatches) as HTMLElement[]) {
          if (!isWidgetElement(el)) return el;
        }
      } catch {}
    }

    // Inspect candidates across DOM
    const candidateQuery = targetTag === "*" ? "button, a, input, select, textarea, [role='button'], [tabindex='0'], nav li, header li" : targetTag;
    const candidates = Array.from(root.querySelectorAll(candidateQuery)) as HTMLElement[];

    interface ScoredCandidate {
      el: HTMLElement;
      score: number;
    }
    const scored: ScoredCandidate[] = [];

    for (const el of candidates) {
      if (isWidgetElement(el)) continue;

      const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase().trim();
      const title = (el.getAttribute("title") || "").toLowerCase().trim();
      const text = (el.textContent || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || "").toLowerCase().trim();
      const className = Array.from(el.classList).join(" ").toLowerCase();
      const dataRowId = (el.getAttribute("data-row-id") || "").toLowerCase();
      const angularClick = (el.getAttribute("(click)") || el.getAttribute("onclick") || "").toLowerCase();

      // Combined corpus for this element
      const corpus = `${ariaLabel} ${title} ${text} ${className} ${dataRowId} ${angularClick}`;

      // Priority A: Exact phrase match on accessible name or text
      if (phraseLower && (ariaLabel === phraseLower || text === phraseLower || title === phraseLower)) {
        return el;
      }

      // Priority B: Substring containment on accessible name
      if (phraseLower && (ariaLabel.includes(phraseLower) || title.includes(phraseLower) || text.includes(phraseLower))) {
        return el;
      }

      // Priority C: Token overlap
      if (tokens.length > 0) {
        let matchedTokenCount = 0;
        for (const tok of tokens) {
          if (corpus.includes(tok)) matchedTokenCount++;
        }
        if (matchedTokenCount === tokens.length) {
          // 100% token coverage
          return el;
        }
        if (matchedTokenCount > 0) {
          scored.push({ el, score: matchedTokenCount / tokens.length });
        }
      }

      // Priority D: Standard semantic web control shortcuts (accessible name & attributes)
      if (tokens.some((t) => ["theme", "dark", "light", "mode"].includes(t))) {
        if (
          ariaLabel.includes("theme") ||
          ariaLabel.includes("dark") ||
          ariaLabel.includes("light") ||
          title.includes("theme") ||
          className.includes("theme") ||
          className.includes("dark-mode") ||
          className.includes("color-scheme") ||
          el.id.toLowerCase().includes("theme")
        ) {
          return el;
        }
      }
      if (tokens.some((t) => ["menu", "hamburger", "nav"].includes(t))) {
        if (
          ariaLabel.includes("menu") ||
          ariaLabel.includes("nav") ||
          className.includes("menu") ||
          className.includes("hamburger") ||
          el.getAttribute("aria-expanded") !== null
        ) {
          return el;
        }
      }
      if (tokens.some((t) => ["search", "find", "query"].includes(t))) {
        if (
          (el as HTMLInputElement).type === "search" ||
          ariaLabel.includes("search") ||
          title.includes("search") ||
          className.includes("search") ||
          ((el as HTMLInputElement).placeholder && (el as HTMLInputElement).placeholder.toLowerCase().includes("search"))
        ) {
          return el;
        }
      }
      if (tokens.some((t) => ["cart", "checkout", "basket", "bag"].includes(t))) {
        if (
          ariaLabel.includes("cart") ||
          ariaLabel.includes("checkout") ||
          ariaLabel.includes("basket") ||
          title.includes("cart") ||
          className.includes("cart") ||
          ((el as HTMLAnchorElement).href && (el as HTMLAnchorElement).href.toLowerCase().includes("cart"))
        ) {
          return el;
        }
      }
      if (tokens.some((t) => ["close", "dismiss", "cancel"].includes(t))) {
        if (
          ariaLabel.includes("close") ||
          ariaLabel.includes("dismiss") ||
          title.includes("close") ||
          className.includes("close")
        ) {
          return el;
        }
      }
    }

    // Return candidate with highest token overlap score if above threshold
    if (scored.length > 0) {
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score >= 0.5) {
        return scored[0].el;
      }
    }
  } catch {}

  return null;
}

/**
 * Fault-tolerant querySelectorAll that automatically filters out widget UI.
 */
export function smartQuerySelectorAll(rawSelector: string, root: ParentNode = document): HTMLElement[] {
  if (!rawSelector || typeof rawSelector !== "string") return [];
  try {
    const elements = Array.from(root.querySelectorAll(rawSelector)) as HTMLElement[];
    return elements.filter((el) => !isWidgetElement(el));
  } catch {
    const single = smartQuerySelector(rawSelector, root);
    return single ? [single] : [];
  }
}

/**
 * Highlights a target DOM element with a smooth scroll and glowing spotlight overlay.
 */
export function spotlightElement(el: HTMLElement, label?: string): void {
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    if (typeof (window as any).inspect === "function") {
      (window as any).inspect(el);
    }

    const overlayId = "g4-agent-spotlight";
    let overlay = document.getElementById(overlayId);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = overlayId;
      overlay.style.position = "fixed";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "999999";
      overlay.style.border = "2px solid #38bdf8";
      overlay.style.borderRadius = "8px";
      overlay.style.boxShadow = "0 0 0 4px rgba(56, 189, 248, 0.35), 0 0 25px rgba(56, 189, 248, 0.5)";
      overlay.style.transition = "all 0.25s ease-out";
      document.body.appendChild(overlay);
    }

    const rect = el.getBoundingClientRect();
    overlay.style.top = `${Math.max(0, rect.top - 3)}px`;
    overlay.style.left = `${Math.max(0, rect.left - 3)}px`;
    overlay.style.width = `${rect.width + 6}px`;
    overlay.style.height = `${rect.height + 6}px`;
    overlay.style.opacity = "1";

    const badgeText = label || `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}>`;
    overlay.innerHTML = `<span style="position: absolute; top: -24px; left: 0; background: #0284c7; color: white; font-family: monospace; font-size: 11px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.4); font-weight: bold;">🎯 ${badgeText}</span>`;

    setTimeout(() => {
      if (overlay) {
        overlay.style.opacity = "0";
      }
    }, 2800);
  } catch {}
}
