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
  if (el.getAttribute("name")) {
    return `${tag}[name='${el.getAttribute("name")}']`;
  }
  if (tag === "a" && el.getAttribute("href")) {
    return `a[href='${el.getAttribute("href")}']`;
  }
  if (el.getAttribute("data-id")) {
    return `${tag}[data-id='${el.getAttribute("data-id")}']`;
  }

  // Look for a clean, non-utility class
  const safeClass = Array.from(el.classList).find((c) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c) && !c.includes("[") && !c.includes("/") && !c.includes(":"));
  if (safeClass) {
    return `${tag}.${safeClass}`;
  }

  return tag;
}

/**
 * Fault-tolerant querySelector.
 * Never throws DOMException (e.g., on unescaped Tailwind brackets or hallucinated selectors).
 * Supports:
 * 1. Native querySelector
 * 2. ID matching (#id or plain id)
 * 3. CSS escaping for special characters (brackets, slashes)
 * 4. Semantic text / button / link text matching fallback
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

  // 4. Semantic text matching fallback:
  // When model generates something like "#button.text-[10px].Run Batch Judge" or "button 'Add to Cart'"
  try {
    const tagMatch = selector.match(/^(button|a|input|select|h[1-6]|span|div|p)\b/i);
    const targetTag = tagMatch ? tagMatch[1].toLowerCase() : "*";

    // Extract target text
    let searchPhrase = selector;
    const quoteMatch = selector.match(/['"]([^'"]+)['"]/);
    if (quoteMatch) {
      searchPhrase = quoteMatch[1];
    } else {
      // Strip leading tag, CSS symbols, and brackets
      searchPhrase = searchPhrase
        .replace(/^(button|a|input|select|h[1-6]|span|div|p)\b/i, "")
        .replace(/[#.:[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (searchPhrase && searchPhrase.length > 1) {
      const phraseLower = searchPhrase.toLowerCase();
      const candidates = Array.from(root.querySelectorAll(targetTag)) as HTMLElement[];

      // Priority A: exact text or button value match
      const exactMatch = candidates.find((el) => {
        if (isWidgetElement(el)) return false;
        const txt = (el.textContent || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || "").trim().toLowerCase();
        return txt === phraseLower;
      });
      if (exactMatch) return exactMatch;

      // Priority B: substring match
      const subMatch = candidates.find((el) => {
        if (isWidgetElement(el)) return false;
        const txt = (el.textContent || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || "").trim().toLowerCase();
        return txt.length > 0 && (txt.includes(phraseLower) || phraseLower.includes(txt));
      });
      if (subMatch) return subMatch;
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
