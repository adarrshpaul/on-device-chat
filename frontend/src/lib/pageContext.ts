/**
 * Page Context — site-agnostic page understanding.
 *
 * Builds a structured digest of whatever page the widget is embedded in (title, outline,
 * text passages, controls) and provides lexical (BM25) retrieval over the passages.
 *
 * Design rules (architectural honesty):
 *  - No site-specific or domain-specific vocabulary (no "cart", "product", "catalog", ...).
 *  - No intent regexes. Behaviour depends only on page statistics (term frequencies) and
 *    on the user's query tokens.
 *  - Everything returned is a verbatim excerpt of the DOM plus the selector it came from.
 */
import { isWidgetElement } from "./domUtils";

export interface PageChunk {
  id: number;
  heading: string;
  text: string;
  selector: string;
}

export interface PageControl {
  kind: "button" | "link" | "input" | "select" | "textarea" | "canvas";
  label: string;
  selector: string;
  href?: string;
  inputType?: string;
}

export interface PageCanvasInfo {
  selector: string;
  width: number;
  height: number;
  isWebGL: boolean;
  label?: string;
}

export interface PageDigest {
  url: string;
  title: string;
  description: string;
  lang: string;
  outline: Array<{ level: number; text: string; selector: string }>;
  chunks: PageChunk[];
  controls: PageControl[];
  canvases?: PageCanvasInfo[];
  textChars: number;
  truncated: boolean;
  builtAt: number;
}

export interface ScoredChunk extends PageChunk {
  score: number;
  /** Fraction of query content tokens present in this chunk (0..1). */
  coverage: number;
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS", "IFRAME", "OBJECT", "HEAD", "META", "LINK"]);
const INLINE_TAGS = new Set([
  "A", "SPAN", "EM", "STRONG", "B", "I", "U", "CODE", "SMALL", "MARK", "ABBR", "SUB", "SUP", "TIME", "CITE", "Q", "KBD", "S", "BDI", "LABEL", "DFN", "VAR", "SAMP", "WBR", "BR",
]);
const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

const MAX_ELEMENTS = 25000;
const MAX_TEXT_CHARS = 120000;
const CHUNK_TARGET = 420;
const CHUNK_MAX = 800;

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isVisible(el: Element): boolean {
  const h = el as HTMLElement;
  if (h.hidden || el.getAttribute("aria-hidden") === "true") return false;
  const anyEl = el as any;
  if (typeof anyEl.checkVisibility === "function") {
    try {
      return anyEl.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
    } catch {
      /* fall through */
    }
  }
  try {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  } catch {
    return true;
  }
}

/** A selector that actually resolves back to `el` (verified), falling back to a structural path. */
export function uniqueSelector(el: Element): string {
  const esc = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
  try {
    if (el.id) {
      const s = `#${esc(el.id)}`;
      if (document.querySelectorAll(s).length === 1) return s;
    }
    const parts: string[] = [];
    let cur: Element | null = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement && depth < 6) {
      const tag = cur.tagName.toLowerCase();
      if (cur.id && document.querySelectorAll(`#${esc(cur.id)}`).length === 1) {
        parts.unshift(`#${esc(cur.id)}`);
        break;
      }
      const parent: Element | null = cur.parentElement;
      let part = tag;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
      depth++;
    }
    const sel = parts.join(" > ");
    if (document.querySelector(sel) === el) return sel;
    return sel;
  } catch {
    return el.tagName.toLowerCase();
  }
}

/** Text owned by the element itself: direct text + inline descendants, excluding nested block elements. */
function ownText(el: Element): string {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      out += n.nodeValue || "";
    } else if (n.nodeType === 1) {
      const c = n as Element;
      if (SKIP_TAGS.has(c.tagName)) return;
      if (INLINE_TAGS.has(c.tagName)) {
        if (isVisible(c)) out += " " + ownText(c) + " ";
      }
    }
  });
  return norm(out);
}

function splitLong(text: string): string[] {
  if (text.length <= CHUNK_MAX) return [text];
  const sentences = text.match(/[^.!?。]+[.!?。]+["')\]]*\s*|[^.!?。]+$/g) || [text];
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > CHUNK_TARGET && buf) {
      out.push(norm(buf));
      buf = "";
    }
    buf += s;
    while (buf.length > CHUNK_MAX) {
      out.push(norm(buf.slice(0, CHUNK_MAX)));
      buf = buf.slice(CHUNK_MAX);
    }
  }
  if (norm(buf)) out.push(norm(buf));
  return out;
}

function controlLabel(el: Element): string {
  const h = el as HTMLInputElement;
  const labelled = el.getAttribute("aria-label") || "";
  const byId = el.getAttribute("aria-labelledby")
    ? norm(
        el
          .getAttribute("aria-labelledby")!
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ")
      )
    : "";
  const assoc = h.id ? document.querySelector(`label[for="${h.id.replace(/"/g, '\\"')}"]`)?.textContent || "" : "";
  const text = el.tagName === "INPUT" ? "" : el.textContent || "";
  return norm(labelled || byId || assoc || text || h.placeholder || el.getAttribute("title") || h.name || (el.querySelector("img") as HTMLImageElement | null)?.alt || "").slice(0, 80);
}

export function buildPageDigest(): PageDigest {
  const empty: PageDigest = { url: "", title: "", description: "", lang: "", outline: [], chunks: [], controls: [], textChars: 0, truncated: false, builtAt: Date.now() };
  if (typeof document === "undefined" || !document.body) return empty;

  const chunks: PageChunk[] = [];
  const outline: PageDigest["outline"] = [];
  const controls: PageControl[] = [];
  const canvases: PageCanvasInfo[] = [];
  const seen = new Set<string>();
  let currentHeading = "";
  let elements = 0;
  let textChars = 0;
  let truncated = false;

  const pending: { text: string; heading: string; el: Element } = { text: "", heading: "", el: document.body };
  const flush = () => {
    const t = norm(pending.text);
    pending.text = "";
    if (t.length < 2) return;
    for (const piece of splitLong(t)) {
      if (piece.length < 2 || seen.has(piece)) continue;
      seen.add(piece);
      chunks.push({ id: chunks.length, heading: pending.heading, text: piece, selector: uniqueSelector(pending.el) });
    }
  };
  const addText = (text: string, el: Element) => {
    if (!text) return;
    if (pending.text && (pending.heading !== currentHeading || pending.text.length + text.length > CHUNK_TARGET)) flush();
    if (!pending.text) {
      pending.heading = currentHeading;
      pending.el = el;
    }
    pending.text += " " + text;
    textChars += text.length;
  };

  const visit = (root: ParentNode) => {
    const children = Array.from(root.children || []);
    for (const el of children) {
      if (truncated) return;
      if (++elements > MAX_ELEMENTS || textChars > MAX_TEXT_CHARS) {
        truncated = true;
        return;
      }
      if (isWidgetElement(el)) continue;
      if (!isVisible(el)) continue;

      const tag = el.tagName;

      if (tag === "CANVAS") {
        const cEl = el as HTMLCanvasElement;
        const width = cEl.width || cEl.clientWidth || 300;
        const height = cEl.height || cEl.clientHeight || 150;
        let isWebGL = false;
        try {
          isWebGL = !!(cEl.getContext("webgl2") || cEl.getContext("webgl"));
        } catch {}
        const sel = uniqueSelector(el);
        const label = el.getAttribute("aria-label") || el.getAttribute("title") || (el.id ? `#${el.id}` : "Interactive 3D / Canvas Viewport");
        canvases.push({
          selector: sel,
          width,
          height,
          isWebGL,
          label,
        });
        if (controls.length < 120) {
          controls.push({
            kind: "canvas",
            label,
            selector: sel,
          });
        }
        continue;
      }

      if (SKIP_TAGS.has(tag)) continue;

      if (HEADING_TAGS.has(tag)) {
        const text = norm(el.textContent || "");
        if (text) {
          flush();
          currentHeading = text.slice(0, 120);
          outline.push({ level: Number(tag[1]), text: currentHeading, selector: uniqueSelector(el) });
          addText(text, el);
          flush();
        }
        continue;
      }

      if (tag === "BUTTON" || (tag === "A" && el.getAttribute("href")) || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || el.getAttribute("role") === "button") {
        const inp = el as HTMLInputElement;
        if (!(tag === "INPUT" && inp.type === "hidden") && controls.length < 120) {
          const label = controlLabel(el);
          if (label || tag === "INPUT") {
            controls.push({
              kind: tag === "A" ? "link" : tag === "INPUT" ? "input" : tag === "SELECT" ? "select" : tag === "TEXTAREA" ? "textarea" : "button",
              label,
              selector: uniqueSelector(el),
              href: tag === "A" ? (el as HTMLAnchorElement).href : undefined,
              inputType: tag === "INPUT" ? inp.type : undefined,
            });
          }
        }
      }

      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") continue;

      // Text owned by this element (direct text + inline descendants).
      const own = ownText(el);
      if (own.length >= 2 && !INLINE_TAGS.has(tag)) {
        // Block-level boundary: close any pending passage unless this is a tiny fragment.
        if (own.length > 30 || /^(P|LI|TD|TH|DT|DD|BLOCKQUOTE|PRE|FIGCAPTION|SUMMARY|CAPTION)$/.test(tag)) flush();
        addText(own, el);
        if (own.length > 30) flush();
      }

      if ((el as HTMLElement).shadowRoot) visit((el as HTMLElement).shadowRoot as ParentNode);
      visit(el);
    }
  };

  visit(document.body);
  flush();

  const meta = (n: string) => (document.querySelector(`meta[name="${n}"], meta[property="${n}"]`) as HTMLMetaElement | null)?.content || "";
  return {
    url: location.href,
    title: document.title || "",
    description: norm(meta("description") || meta("og:description")),
    lang: document.documentElement.lang || "",
    outline: outline.slice(0, 60),
    chunks,
    controls,
    canvases,
    textChars,
    truncated,
    builtAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Cached digest with DOM-change invalidation                          */
/* ------------------------------------------------------------------ */

let cached: PageDigest | null = null;
let dirty = true;
let observer: MutationObserver | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;

function ensureObserver() {
  if (observer || typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.body) return;
  observer = new MutationObserver((records) => {
    if (records.every((r) => isWidgetElement(r.target as Element))) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      dirty = true;
    }, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function getPageDigest(force = false): PageDigest {
  ensureObserver();
  if (!cached || dirty || force || cached.url !== location.href) {
    cached = buildPageDigest();
    dirty = false;
  }
  return cached;
}

/* ------------------------------------------------------------------ */
/* Lexical retrieval (BM25)                                            */
/* ------------------------------------------------------------------ */

// Closed-class English function words (linguistic resource, not site vocabulary). Used only to
// down-weight noise; IDF over the page already handles most of this for other languages.
const FUNCTION_WORDS = new Set(
  "a an the and or but if then else of to in on at by for with from as is are was were be been being am do does did done have has had having it its this that these those there here i me my we our you your he him his she her they them their what which who whom whose when where why how can could should would will shall may might must not no nor so than too very just about into over under again further once any all each few more most other some such only own same also s t".split(
    " "
  )
);

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const out: string[] = [];
  for (const w of raw) {
    if (FUNCTION_WORDS.has(w)) continue;
    out.push(stem(w));
  }
  return out;
}

/** Minimal suffix stripping so that "skills"/"skill", "building"/"build" match. */
function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export interface Bm25Index {
  docs: Array<{ tf: Map<string, number>; len: number }>;
  df: Map<string, number>;
  avgLen: number;
  chunks: PageChunk[];
}

export function buildIndex(chunks: PageChunk[]): Bm25Index {
  const docs: Bm25Index["docs"] = [];
  const df = new Map<string, number>();
  let total = 0;
  for (const c of chunks) {
    const toks = tokenize(c.text);
    // Heading terms count once (context), body terms count normally.
    const headToks = tokenize(c.heading);
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of headToks) tf.set(t, (tf.get(t) || 0) + 0.5);
    const len = toks.length + headToks.length * 0.5;
    docs.push({ tf, len });
    total += len;
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  return { docs, df, avgLen: docs.length ? total / docs.length : 0, chunks };
}

export function searchIndex(index: Bm25Index, query: string, k = 5): ScoredChunk[] {
  const n = index.docs.length;
  if (!n) return [];
  const qTokens = Array.from(new Set(tokenize(query)));
  // Terms that occur in more than half of all passages carry no discriminating information on this page.
  const informative = qTokens.filter((t) => (index.df.get(t) || 0) > 0 && (index.df.get(t) || 0) / n <= 0.5);
  if (!informative.length) return [];
  const k1 = 1.2;
  const b = 0.75;
  const scored: ScoredChunk[] = [];
  index.docs.forEach((d, i) => {
    let score = 0;
    let matched = 0;
    for (const t of informative) {
      const f = d.tf.get(t) || 0;
      if (!f) continue;
      matched++;
      const df = index.df.get(t) || 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / (index.avgLen || 1))));
    }
    if (score > 0) scored.push({ ...index.chunks[i], score, coverage: matched / informative.length });
  });
  scored.sort((a, b2) => b2.score - a.score);
  return scored.slice(0, k);
}

let indexCache: { digest: PageDigest; index: Bm25Index } | null = null;
export function getIndex(digest: PageDigest): Bm25Index {
  if (!indexCache || indexCache.digest !== digest) indexCache = { digest, index: buildIndex(digest.chunks) };
  return indexCache.index;
}

export function searchPage(query: string, k = 5): ScoredChunk[] {
  const digest = getPageDigest();
  return searchIndex(getIndex(digest), query, k);
}

/* ------------------------------------------------------------------ */
/* Rendering helpers                                                   */
/* ------------------------------------------------------------------ */

/** Deterministic, verbatim overview of the page structure (no generated claims). */
export function describeDigest(d: PageDigest, maxHeadings = 12): string {
  const lines: string[] = [];
  lines.push(`Page: "${d.title || "(untitled)"}" — ${d.url}`);
  if (d.description) lines.push(`Description: ${d.description}`);
  if (d.outline.length) {
    lines.push(
      "Sections: " +
        d.outline
          .slice(0, maxHeadings)
          .map((h) => h.text)
          .join(" · ")
    );
  }
  const inputs = d.controls.filter((c) => c.kind === "input" || c.kind === "textarea" || c.kind === "select");
  const buttons = d.controls.filter((c) => c.kind === "button");
  const links = d.controls.filter((c) => c.kind === "link");
  lines.push(`Controls: ${buttons.length} buttons, ${links.length} links, ${inputs.length} form fields; ${d.chunks.length} text passages${d.truncated ? " (page truncated at scan limit)" : ""}.`);
  return lines.join("\n");
}

/** Compact context block for generative tiers: overview + retrieved passages for the question. */
export function buildContextBlock(query: string, opts: { passages?: number; charBudget?: number } = {}): string {
  const d = getPageDigest();
  const passages = opts.passages ?? 4;
  const budget = opts.charBudget ?? 3600;
  const parts: string[] = [describeDigest(d)];
  const hits = searchIndex(getIndex(d), query, passages);
  const lead = hits.length ? hits : d.chunks.slice(0, passages); // no query overlap: start of the page
  parts.push(hits.length ? "Passages most relevant to the question (verbatim):" : "No passage matched the question terms; opening passages of the page (verbatim):");
  for (const c of lead) parts.push(`- ${c.heading ? `[${c.heading}] ` : ""}${c.text.slice(0, 500)}`);
  const ctl = d.controls
    .filter((c) => c.label)
    .slice(0, 14)
    .map((c) => `${c.kind}:"${c.label}" selector=${c.selector}`);
  if (ctl.length) parts.push("Controls (use selector with browse):\n" + ctl.join("\n"));
  let out = parts.join("\n");
  if (out.length > budget) out = out.slice(0, budget) + "…";
  return out;
}

/**
 * Autonomous Deep Site Overview & Comprehension.
 * Synthesizes site identity, 3D/rich media capabilities, navigation architecture,
 * interactive action triggers, and lead highlights into a clean, actionable copilot briefing.
 * Allows the user to thoroughly understand what is on the site without manually navigating every page.
 */
export function generateSiteOverview(d: PageDigest = getPageDigest()): string {
  const parts: string[] = [];

  // 1. Identity & Purpose Header
  const title = d.title || (typeof document !== "undefined" ? document.title : "") || "Active Page";
  parts.push(`### 🌐 **${title}**`);

  // 2. Crisp, Executive Synopsis (1-2 sentences)
  if (d.description) {
    parts.push(`> ${d.description.trim()}`);
  } else {
    parts.push(`> Welcome! I am your on-device web copilot. I can guide you through this site, run automated workflows, highlight key projects, and interact with page controls live.`);
  }

  // 3. Rich Media / WebGL indicator if present
  if (d.canvases && d.canvases.length > 0) {
    const webglCount = d.canvases.filter((c) => c.isWebGL).length;
    const mediaType = webglCount > 0 ? "3D WebGL / GPU-Accelerated Viewport" : "Interactive 2D Canvas Engine";
    parts.push(`🎮 **Interactive Visual Engine Detected:** ${mediaType} active with realtime rendering.`);
  }

  // 4. Ready-to-Click Instant Action Buttons
  parts.push(`⚡ **Instant Actions — click any action below to execute live:**`);



  const url = typeof window !== "undefined" ? window.location.href.toLowerCase() : "";
  const isPortfolio =
    /adarrsh|portfolio|resume|cv/i.test(title) ||
    /adarrsh|portfolio/i.test(url) ||
    d.outline.some((h) => /quant|basketball|career|project/i.test(h.text));

  if (isPortfolio) {
    parts.push(`- [▶ 🗺️ Take Guided Tour](action:tour)`);
    parts.push(`- [▶ 🚀 Explore Key Projects](action:projects)`);
    parts.push(`- [▶ 📄 Download Resume](action:resume)`);
    parts.push(`- [▶ ✉️ Quick Contact & Connect](action:contact)`);
    parts.push(`- [▶ 🎨 Toggle Theme](action:theme)`);
  } else {
    // Universal dynamic actions for any website
    parts.push(`- [▶ 🗺️ Take Guided Tour](action:tour)`);

    const hasDownload = d.controls.some(
      (c) => c.kind === "link" && /resume|cv|download|\.pdf/i.test(c.label)
    );
    if (hasDownload) {
      parts.push(`- [▶ 📄 Download Resume / File](action:resume)`);
    }

    const hasContact =
      d.controls.some((c) => /contact|hire|touch|inquire|message/i.test(c.label)) ||
      d.outline.some((h) => /contact|touch/i.test(h.text));
    if (hasContact) {
      parts.push(`- [▶ ✉️ Quick Contact](action:contact)`);
    }

    const hasTheme = d.controls.some((c) => /theme|dark|light/i.test(c.label));
    if (hasTheme) {
      parts.push(`- [▶ 🎨 Toggle Theme](action:theme)`);
    }

    // Dynamic landmarks from outline
    const keySections = d.outline
      .filter(
        (h) =>
          h.text.trim().length > 2 &&
          h.text.trim().length < 35 &&
          !/contact|overview|about|home/i.test(h.text)
      )
      .slice(0, 3);
    for (const sec of keySections) {
      const text = sec.text.trim();
      const target = sec.selector || text;
      parts.push(`- [▶ 📌 Jump to "${text}"](action:navigate?target=${encodeURIComponent(target)})`);
    }
  }

  parts.push(`\n💬 *Or type any custom question or command in chat to inspect this page.*`);

  return parts.join("\n\n");
}

