/**
 * DOM Utilities for Autonomous Web Agent Harness
 *
 * Provides fault-tolerant selector resolution, prevents DOMException crashes
 * on invalid LLM selectors, and excludes internal widget UI from agent operations.
 */

/** Realm-safe element check: `instanceof HTMLElement` is false for elements from same-origin iframes */
export function isElementNode(value: unknown): value is HTMLElement {
  if (typeof value !== "object" || value === null) return false;
  if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) return true;
  return (value as Node).nodeType === 1;
}

/** Realm-safe check for <input> / <textarea> (also accepts this realm's classes, e.g. test doubles) */
export function isTextField(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (typeof HTMLInputElement !== "undefined" && el instanceof HTMLInputElement) return true;
  if (typeof HTMLTextAreaElement !== "undefined" && el instanceof HTMLTextAreaElement) return true;
  const tag = (el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA";
}

const MAX_SEARCH_ROOTS = 200;

/**
 * Every root a selector should search, starting with `rootDoc`: open shadow roots (at any depth)
 * and documents of same-origin iframes. Closed shadow roots and cross-origin frames are not
 * reachable from page script by design and are skipped.
 */
export function collectSearchRoots(rootDoc?: Document): Array<Document | ShadowRoot> {
  const doc = rootDoc || (typeof document !== "undefined" ? document : null);
  if (!doc) return [];
  const roots: Array<Document | ShadowRoot> = [];
  const queue: Array<Document | ShadowRoot> = [doc];
  while (queue.length > 0 && roots.length < MAX_SEARCH_ROOTS) {
    const root = queue.shift()!;
    roots.push(root);
    const ownerDoc = root.nodeType === 9 ? (root as Document) : (root.ownerDocument as Document | null);
    // Minimal or mock DOMs without tree walking: search the root itself only
    if (!ownerDoc || typeof ownerDoc.createTreeWalker !== "function" || typeof NodeFilter === "undefined") continue;
    const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode() as Element | null; node; node = walker.nextNode() as Element | null) {
      if (node.shadowRoot) queue.push(node.shadowRoot);
      if (node.tagName === "IFRAME" || node.tagName === "FRAME") {
        try {
          const frameDoc = (node as HTMLIFrameElement).contentDocument;
          if (frameDoc && frameDoc.documentElement) queue.push(frameDoc);
        } catch {
          // Cross-origin frame: not readable from this realm
        }
      }
    }
  }
  return roots;
}

/** querySelectorAll across the document, open shadow roots and same-origin iframes */
export function deepQuerySelectorAll<T extends Element = HTMLElement>(selector: string, rootDoc: Document = document): T[] {
  const out: T[] = [];
  for (const root of collectSearchRoots(rootDoc)) {
    try {
      out.push(...Array.from(root.querySelectorAll<T>(selector)));
    } catch {
      return out; // invalid selector: same result for every root
    }
  }
  return out;
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

/** Bounding rect in TOP-level viewport coordinates (adds the offsets of same-origin iframes) */
export function topLevelRect(el: Element): ViewportRect {
  const r = el.getBoundingClientRect();
  let left = r.left;
  let top = r.top;
  let win: Window | null = el.ownerDocument ? el.ownerDocument.defaultView : null;
  while (win && win !== win.top) {
    let frameEl: Element | null = null;
    try {
      frameEl = win.frameElement;
    } catch {
      break;
    }
    if (!frameEl) break;
    const fr = frameEl.getBoundingClientRect();
    left += fr.left + (frameEl as HTMLElement).clientLeft;
    top += fr.top + (frameEl as HTMLElement).clientTop;
    win = frameEl.ownerDocument ? frameEl.ownerDocument.defaultView : null;
  }
  return { left, top, width: r.width, height: r.height, right: left + r.width, bottom: top + r.height };
}

const WIDGET_SELECTOR = "[data-eo-widget], [data-g4-widget], .eo-widget-container, .g4-widget-container, #edge-operator-root, #gemma4-widget-root, #chat-widget, #eo-agent-spotlight, #g4-agent-spotlight, edge-operator, on-device-chat";

export function isWidgetElement(el: Element | null): boolean {
  // closest() stops at shadow boundaries and the widget renders inside its own shadow root,
  // so check each level and then continue from the shadow host
  let cur: Element | null = el;
  while (cur) {
    if (cur.closest?.(WIDGET_SELECTOR)) return true;
    const root = cur.getRootNode ? cur.getRootNode() : null;
    cur = root && (root as ShadowRoot).host ? (root as ShadowRoot).host : null;
  }
  return false;
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
  const safeClass = Array.from(el.classList || []).find((c) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c) && !c.includes("[") && !c.includes("/") && !c.includes(":"));
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
export function smartQuerySelector(rawSelector: string, root?: ParentNode, deep = true): HTMLElement | null {
  const targetRoot = root || (typeof document !== "undefined" ? document : null);
  if (!targetRoot || !rawSelector || typeof rawSelector !== "string") return null;
  const selector = rawSelector.trim();

  // 1. Direct native querySelector
  try {
    const el = targetRoot.querySelector(selector);
    if (el && !isWidgetElement(el)) return el as HTMLElement;
  } catch {
    // Syntax error in rawSelector — continue to smart recovery
  }

  // 2. Direct ID lookup (handles #foo or just foo)
  const idClean = selector.replace(/^[#]/, "").trim();
  if (/^[a-zA-Z0-9_-]+$/.test(idClean)) {
    try {
      const el = (targetRoot as any).getElementById
        ? (targetRoot as Document).getElementById(idClean)
        : targetRoot.querySelector(`#${idClean}`);
      if (el && !isWidgetElement(el)) return el as HTMLElement;
    } catch {}
  }

  // 3. Remove Tailwind bracketed classes if present: e.g. "button.text-[10px]" -> "button"
  try {
    const sanitized = selector
      .replace(/(\.[\w-]+)?\[[\w-%]+\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (sanitized && sanitized !== selector) {
      const el = targetRoot.querySelector(sanitized);
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
        const attrMatches = targetRoot.querySelectorAll(
          `${targetTag}[aria-label*="${phraseLower}" i], ${targetTag}[title*="${phraseLower}" i], [aria-label*="${phraseLower}" i]`
        );
        for (const el of Array.from(attrMatches) as HTMLElement[]) {
          if (!isWidgetElement(el)) return el;
        }
      } catch {}
    }

    // Inspect candidates across DOM
    const candidateQuery = targetTag === "*" ? "button, a, input, select, textarea, [role='button'], [tabindex='0'], nav li, header li" : targetTag;
    const candidates = Array.from(targetRoot.querySelectorAll(candidateQuery)) as HTMLElement[];

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

  // Not in the light DOM: repeat the same strategies inside open shadow roots and same-origin iframes
  if (deep && typeof document !== "undefined" && root === document) {
    for (const extraRoot of collectSearchRoots(document).slice(1)) {
      const el = smartQuerySelector(rawSelector, extraRoot, false);
      if (el) return el;
    }
  }

  return null;
}

/**
 * Fault-tolerant querySelectorAll that automatically filters out widget UI.
 */
export function smartQuerySelectorAll(rawSelector: string, root?: ParentNode): HTMLElement[] {
  const targetRoot = root || (typeof document !== "undefined" ? document : null);
  if (!targetRoot || !rawSelector || typeof rawSelector !== "string") return [];
  try {
    const elements = Array.from(targetRoot.querySelectorAll(rawSelector)) as HTMLElement[];
    return elements.filter((el) => !isWidgetElement(el));
  } catch {
    const single = smartQuerySelector(rawSelector, targetRoot);
    return single ? [single] : [];
  }
}

/**
 * Flawless Smooth Scroll to Element or Coordinate
 * Coordinates with host smooth scroll libraries (Lenis, GSAP ScrollTrigger)
 * or falls back to native smooth scrolling.
 */
export function smoothScrollTo(target: HTMLElement | number | string, offset = 0): boolean {
  if (typeof window === "undefined") return false;

  const lenis = (window as any).lenis;

  // 1. Numeric coordinate target
  if (typeof target === "number") {
    const dest = Math.max(0, target + offset);
    if (lenis && typeof lenis.scrollTo === "function") {
      try {
        lenis.scrollTo(dest, { immediate: false, duration: 1.0 });
        return true;
      } catch {}
    }
    window.scrollTo({ top: dest, behavior: "smooth" });
    return true;
  }

  // 2. Element or selector target
  const el = isElementNode(target) ? target : smartQuerySelector(String(target));
  if (!el || isWidgetElement(el)) return false;

  let scrolled = false;
  if (lenis && typeof lenis.scrollTo === "function") {
    try {
      lenis.scrollTo(el, { offset, immediate: false, duration: 1.0 });
      scrolled = true;
    } catch {}
  }

  if (typeof el.scrollIntoView === "function") {
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      scrolled = true;
    } catch {}
  }

  const top = el.getBoundingClientRect().top + window.scrollY;
  try {
    window.scrollTo({ top: Math.max(0, top + offset), behavior: "smooth" });
    scrolled = true;
  } catch {}

  return scrolled;
}

/**
 * Injects required keyframes for the virtual human cursor and radar gaze indicator
 */
function ensureHumanNavStyles(): void {
  if (typeof document === "undefined") return;
  const styleId = "g4-agent-human-nav-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes g4-cursor-radar-pulse {
        0% { transform: scale(0.85); opacity: 0.9; }
        100% { transform: scale(2.2); opacity: 0; }
      }
      @keyframes g4-cursor-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      .g4-cursor-breathe {
        animation: g4-cursor-float 2.4s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }
}

let activeSpotlightTimer: any = null;

/**
 * Cleanly removes all human navigation visual indicators
 */
export function clearHumanNavigation(): void {
  if (typeof document === "undefined") return;
  if (activeSpotlightTimer) clearTimeout(activeSpotlightTimer);

  const spotlight = document.getElementById("g4-agent-spotlight");
  if (spotlight) {
    spotlight.style.opacity = "0";
    setTimeout(() => spotlight.remove(), 250);
  }

  const cursor = document.getElementById("g4-agent-human-cursor");
  if (cursor) {
    cursor.style.opacity = "0";
    setTimeout(() => cursor.remove(), 250);
  }
}

/**
 * Positions or glides the virtual Human Cursor across the viewport to the target element.
 */
export function glideHumanCursor(targetX: number, targetY: number, label: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  ensureHumanNavStyles();

  const cursorId = "g4-agent-human-cursor";
  let cursor = document.getElementById(cursorId);
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.id = cursorId;
    cursor.style.position = "fixed";
    cursor.style.top = "0";
    cursor.style.left = "0";
    cursor.style.zIndex = "9999999";
    cursor.style.pointerEvents = "none";
    cursor.style.opacity = "0";
    cursor.style.transition = "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease";
    cursor.style.transform = `translate3d(${Math.max(20, targetX - 50)}px, ${Math.max(20, targetY - 50)}px, 0)`;
    document.body.appendChild(cursor);
  }

  cursor.innerHTML = `
    <div class="g4-cursor-breathe" style="position: relative; display: flex; align-items: center; gap: 8px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45));">
      <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: -5px; border-radius: 50%; border: 1.5px solid #c084fc; animation: g4-cursor-radar-pulse 1.4s cubic-bezier(0, 0.2, 0.8, 1) infinite;"></div>
        <div style="width: 14px; height: 14px; border-radius: 50%; background: #9333ea; border: 2px solid #ffffff; box-shadow: 0 0 10px #c084fc;"></div>
      </div>
      <div style="background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(8px); border: 1px solid rgba(168, 85, 247, 0.5); color: #f8fafc; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; white-space: nowrap; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
        <span style="font-size: 12px;">👁️</span>
        <span>Observing: <strong style="color: #c084fc;">${label}</strong></span>
      </div>
    </div>
  `;

  // Animate into view and glide to target coordinates
  requestAnimationFrame(() => {
    if (cursor) {
      cursor.style.opacity = "1";
      cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    }
  });

  return cursor;
}

/**
 * Highlights a target DOM element with a smooth scroll, human cursor, and glowing spotlight overlay.
 */
export function spotlightElement(el: HTMLElement, label?: string): void {
  try {
    ensureHumanNavStyles();
    smoothScrollTo(el);

    if (typeof (window as any).inspect === "function") {
      (window as any).inspect(el);
    }

    const overlayId = "g4-agent-spotlight";
    let overlay = document.getElementById(overlayId);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = overlayId;
      overlay.style.position = "absolute";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "999998";
      overlay.style.border = "2px solid #a855f7";
      overlay.style.borderRadius = "10px";
      overlay.style.boxShadow = "0 0 0 4px rgba(168, 85, 247, 0.25), 0 0 25px rgba(168, 85, 247, 0.4)";
      overlay.style.transition = "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)";
      document.body.appendChild(overlay);
    }

    const rect = el.getBoundingClientRect();
    const docTop = rect.top + window.scrollY;
    const docLeft = rect.left + window.scrollX;

    overlay.style.top = `${Math.max(0, docTop - 4)}px`;
    overlay.style.left = `${Math.max(0, docLeft - 4)}px`;
    overlay.style.width = `${Math.max(40, rect.width + 8)}px`;
    overlay.style.height = `${Math.min(600, Math.max(30, rect.height + 8))}px`;
    overlay.style.opacity = "1";

    const badgeText = label || `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}>`;
    overlay.innerHTML = `<span style="position: absolute; top: -26px; left: 0; background: linear-gradient(135deg, #7c3aed, #9333ea); color: white; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; padding: 2px 9px; border-radius: 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.35); font-weight: 600; display: flex; align-items: center; gap: 4px;">🎯 ${badgeText}</span>`;

    // Position virtual cursor near top-center of target
    const targetCenterX = Math.min(window.innerWidth - 180, Math.max(30, rect.left + Math.min(rect.width / 2, 120)));
    const targetCenterY = Math.min(window.innerHeight - 80, Math.max(70, rect.top + Math.min(rect.height / 3, 60)));
    glideHumanCursor(targetCenterX, targetCenterY, badgeText);

    // Keep spotlight synchronized as scrolling settles
    const settleInterval = setInterval(() => {
      if (!el.isConnected || !overlay) {
        clearInterval(settleInterval);
        return;
      }
      const updatedRect = el.getBoundingClientRect();
      const updatedDocTop = updatedRect.top + window.scrollY;
      const updatedDocLeft = updatedRect.left + window.scrollX;
      overlay.style.top = `${Math.max(0, updatedDocTop - 4)}px`;
      overlay.style.left = `${Math.max(0, updatedDocLeft - 4)}px`;
    }, 150);

    setTimeout(() => clearInterval(settleInterval), 1500);

    if (activeSpotlightTimer) clearTimeout(activeSpotlightTimer);
    activeSpotlightTimer = setTimeout(() => {
      if (overlay) overlay.style.opacity = "0";
      const cursor = document.getElementById("g4-agent-human-cursor");
      if (cursor) cursor.style.opacity = "0";
    }, 3200);
  } catch {}
}

/**
 * Human-like autonomous navigation to an element:
 * Smoothly scrolls with Lenis / native, glides the virtual cursor, spotlights target,
 * and pauses for natural human reading time so the user can easily observe what is happening.
 */
export async function humanNavigateTo(
  el: HTMLElement,
  label?: string,
  pauseMs: number = 1800
): Promise<void> {
  if (!el || typeof window === "undefined") return;

  const displayLabel = label || `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}>`;
  spotlightElement(el, displayLabel);

  // Guarantee minimum 1600ms observation pause for human-comprehensible pacing
  const effectivePause = Math.max(1600, pauseMs);
  return new Promise((resolve) => setTimeout(resolve, effectivePause));
}

