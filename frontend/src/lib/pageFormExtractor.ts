/**
 * Page Form & Interactive Element Extractor
 *
 * Powers Workflow Studio target/value suggestions:
 * 1. Scans the live DOM (never widget chrome) for fields, actions, and landmarks.
 * 2. Resolves human-readable labels (label[for], aria, WBM table cells, name attrs).
 * 3. Emits replay-verified selectors: every selector round-trips through smartQuerySelector to its element.
 * 4. Groups fields into forms (native <form>, role=form/search, implicit fieldset/table groups)
 *    so a whole form can be synthesized into workflow steps in one click.
 */

import type { WorkflowStep } from "./types";
import { isWidgetElement, smartQuerySelector } from "./domUtils";
import { uniqueSelector } from "./pageContext";

export type PageElementKind = "text" | "secret" | "textarea" | "select" | "toggle" | "button" | "link" | "landmark";

export interface PageElement {
  key: string;
  kind: PageElementKind;
  label: string;
  selector: string;
  tag: string;
  element: HTMLElement;
  inputType?: string;
  placeholder?: string;
  /** Display value (selected option text for <select>); never populated for passwords */
  value?: string;
  checked?: boolean;
  options?: { value: string; text: string }[];
  /** Values offered by an associated <datalist> */
  datalist?: string[];
  required?: boolean;
  disabled?: boolean;
  formKey?: string;
  /** Disambiguating context, e.g. product name for a repeated "Add to cart" button */
  context?: string;
}

export interface PageFormGroup {
  key: string;
  title: string;
  container: HTMLElement;
  fields: PageElement[];
  submit?: PageElement;
}

export interface PageScan {
  url: string;
  scannedAt: number;
  elements: PageElement[];
  forms: PageFormGroup[];
}

const BUTTON_INPUT_TYPES = new Set(["button", "submit", "reset", "image"]);
const FIELD_QUERY = "input:not([type='hidden']), textarea, select, [contenteditable='true'], [contenteditable='']";
const ACTION_QUERY = "button, a[href], [role='button'], [role='link'], [role='tab'], [role='menuitem'], [role='switch'], [role='checkbox'], input[type='submit'], input[type='button']";
const LANDMARK_QUERY = "h1, h2, h3, main, nav, footer, section[id], [role='region'][aria-label], [role='tabpanel']";
const ENTITY_QUERY = "tr, li, article, [role='row'], [role='listitem'], [class*='card'], [class*='product'], [class*='item']";

const MAX_FIELDS = 150;
const MAX_ACTIONS = 150;
const MAX_LANDMARKS = 40;

const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim();
const esc = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
const attrEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Framework-generated ids (React :r1:, Angular mat-input-12, hashes) are unstable across reloads. */
function looksGenerated(id: string): boolean {
  return /^:|\d{3,}|^[a-f0-9]{8,}$|^(mat|cdk|ember|ng|react|rc|headlessui|radix)-/i.test(id);
}

function isVisible(el: HTMLElement): boolean {
  if (isWidgetElement(el)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function humanize(raw: string): string {
  return norm(raw.replace(/\[\]$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-.[\]]+/g, " ")).replace(/^./, (c) => c.toUpperCase());
}

/** Text of an element excluding nested controls (so a wrapping <label> doesn't echo option text). */
function textWithoutControls(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("input, select, textarea, button, script, style").forEach((n) => n.remove());
  return norm(clone.textContent).replace(/[:*]\s*$/, "").trim();
}

function labelForField(el: HTMLElement): string {
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = norm(labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" "));
    if (text) return text;
  }
  const aria = norm(el.getAttribute("aria-label"));
  if (aria) return aria;

  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length > 0) {
    const text = textWithoutControls(labels[0]);
    if (text) return text;
  }

  // WBM parameter tables: <tr><td>Parameter</td><td><input></td></tr>
  const cell = el.closest("td, th");
  if (cell) {
    for (let prev = cell.previousElementSibling; prev; prev = prev.previousElementSibling) {
      const text = textWithoutControls(prev);
      if (text) return text.slice(0, 60);
    }
  }

  // Stacked layouts: label-ish text immediately before the control
  const prevSibling = el.previousElementSibling;
  if (prevSibling && !prevSibling.matches(FIELD_QUERY)) {
    const text = textWithoutControls(prevSibling);
    if (text && text.length <= 50) return text;
  }

  const placeholder = norm(el.getAttribute("placeholder"));
  if (placeholder) return placeholder;
  const title = norm(el.getAttribute("title"));
  if (title) return title;
  const name = el.getAttribute("name") || el.id;
  if (name && !looksGenerated(name)) return humanize(name);
  return humanize((el as HTMLInputElement).type || el.tagName.toLowerCase());
}

function labelForAction(el: HTMLElement): string {
  const aria = norm(el.getAttribute("aria-label"));
  if (aria) return aria;
  if (el instanceof HTMLInputElement) return norm(el.value) || humanize(el.type);
  const text = norm(el.innerText || el.textContent);
  if (text) return text.slice(0, 60);
  const title = norm(el.getAttribute("title"));
  if (title) return title;
  const img = el.querySelector("img[alt], svg title");
  return norm(img?.getAttribute("alt") || img?.textContent) || el.tagName.toLowerCase();
}

/** Short name of the repeating entity (table row, product card) an element sits in. */
function entityContext(el: HTMLElement): string | undefined {
  const entity = el.parentElement?.closest(ENTITY_QUERY);
  if (!entity || entity === document.body) return undefined;
  const heading = entity.querySelector("h1, h2, h3, h4, h5, [class*='title'], [class*='name'], td, a");
  const text = norm(heading?.textContent).slice(0, 40);
  return text && text !== labelForAction(el) ? text : undefined;
}

function resolvesTo(selector: string, el: Element): boolean {
  try {
    return smartQuerySelector(selector) === el;
  } catch {
    return false;
  }
}

/**
 * Most human-readable selector that replays back to exactly this element.
 * Order: stable id → test ids → name → aria-label → placeholder → visible text → structural path.
 */
export function buildStableSelector(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const candidates: string[] = [];

  if (el.id && !looksGenerated(el.id)) candidates.push(`#${esc(el.id)}`);
  for (const attr of ["data-testid", "data-test", "data-qa", "data-cy"]) {
    const v = el.getAttribute(attr);
    if (v) candidates.push(`[${attr}='${attrEsc(v)}']`);
  }
  const name = el.getAttribute("name");
  if (name) {
    candidates.push(`${tag}[name='${attrEsc(name)}']`);
    const form = el.closest("form");
    if (form?.id && !looksGenerated(form.id)) candidates.push(`#${esc(form.id)} ${tag}[name='${attrEsc(name)}']`);
  }
  const aria = el.getAttribute("aria-label");
  if (aria) candidates.push(`${tag}[aria-label='${attrEsc(aria)}']`);
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) candidates.push(`${tag}[placeholder='${attrEsc(placeholder)}']`);
  if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") {
    const text = norm(el.textContent).slice(0, 40);
    if (text && !/['"]/.test(text)) candidates.push(`${tag} '${text}'`);
  }

  for (const c of candidates) {
    if (resolvesTo(c, el)) return c;
  }
  return uniqueSelector(el);
}

function kindOf(el: HTMLElement): PageElementKind | null {
  const tag = el.tagName.toLowerCase();
  if (tag === "select") return "select";
  if (tag === "textarea" || el.isContentEditable) return "textarea";
  if (tag === "input") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    if (type === "password") return "secret";
    if (type === "checkbox" || type === "radio") return "toggle";
    if (BUTTON_INPUT_TYPES.has(type)) return "button";
    if (type === "file") return null;
    return "text";
  }
  if (tag === "a") return "link";
  const role = el.getAttribute("role");
  if (role === "switch" || role === "checkbox") return "toggle";
  if (role === "link") return "link";
  if (tag === "button" || role === "button" || role === "tab" || role === "menuitem") return "button";
  return "landmark";
}

/** Describe any element (used by scanning and by the point-and-click picker). */
export function describeElement(el: HTMLElement, key = "picked"): PageElement {
  const kind = kindOf(el) ?? "landmark";
  const tag = el.tagName.toLowerCase();
  const base: PageElement = {
    key,
    kind,
    tag,
    element: el,
    selector: buildStableSelector(el),
    label: "",
    disabled: (el as HTMLInputElement).disabled || el.getAttribute("aria-disabled") === "true" || undefined,
  };

  if (kind === "button" || kind === "link") {
    base.label = labelForAction(el);
    base.context = entityContext(el);
    return base;
  }
  if (kind === "landmark") {
    base.label = norm(el.getAttribute("aria-label")) || norm(el.querySelector("h1, h2, h3")?.textContent || el.textContent).slice(0, 60) || tag;
    return base;
  }

  base.label = labelForField(el);
  base.placeholder = norm(el.getAttribute("placeholder")) || undefined;
  base.required = (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true" || undefined;

  if (el instanceof HTMLInputElement) {
    base.inputType = el.type;
    if (kind === "toggle") base.checked = el.checked;
    else if (kind !== "secret") base.value = el.value || undefined;
    if (el.list) {
      base.datalist = Array.from(el.list.querySelectorAll("option"))
        .map((o) => (o as HTMLOptionElement).value)
        .filter(Boolean)
        .slice(0, 12);
    }
  } else if (el instanceof HTMLTextAreaElement) {
    base.value = el.value || undefined;
  } else if (el instanceof HTMLSelectElement) {
    base.options = Array.from(el.options)
      .filter((o) => !o.disabled && (o.value || norm(o.text)))
      .map((o) => ({ value: o.value, text: norm(o.text) || o.value }));
    base.value = el.selectedOptions[0] ? norm(el.selectedOptions[0].text) : undefined;
  } else if (el.isContentEditable) {
    base.value = norm(el.innerText).slice(0, 80) || undefined;
  }
  return base;
}

function formTitle(container: HTMLElement, fields: PageElement[], submit?: PageElement): string {
  const explicit =
    norm(container.getAttribute("aria-label")) ||
    norm(container.querySelector("legend, caption")?.textContent) ||
    norm(container.querySelector("h1, h2, h3, h4")?.textContent);
  if (explicit) return explicit.slice(0, 40);

  // Nearest heading preceding the container in document order
  let prev: Element | null = container;
  for (let hops = 0; prev && hops < 6; hops++) {
    for (let sib = prev.previousElementSibling; sib; sib = sib.previousElementSibling) {
      const h = sib.matches("h1, h2, h3, h4") ? sib : sib.querySelector("h1, h2, h3, h4");
      if (h && norm(h.textContent)) return norm(h.textContent).slice(0, 40);
    }
    prev = prev.parentElement;
  }

  if (container.getAttribute("role") === "search" || fields.some((f) => f.inputType === "search")) return "Search";
  if (fields.some((f) => f.kind === "secret")) return "Sign in";
  if (submit) return submit.label;
  return fields.map((f) => f.label).slice(0, 2).join(" & ");
}

function findSubmit(container: HTMLElement, actions: PageElement[]): PageElement | undefined {
  const inside = actions.filter((a) => a.kind === "button" && container.contains(a.element));
  if (inside.length === 0) return undefined;
  const explicit = inside.find((a) => {
    const t = (a.element.getAttribute("type") || "").toLowerCase();
    return t === "submit" || (a.tag === "button" && !t && container.tagName === "FORM");
  });
  return explicit ?? inside[inside.length - 1];
}

/** Scan the live page. Pure read — no DOM mutation. */
export function scanPage(): PageScan {
  if (typeof document === "undefined") return { url: "", scannedAt: Date.now(), elements: [], forms: [] };

  let seq = 0;
  const fields: PageElement[] = [];
  const actions: PageElement[] = [];
  const landmarks: PageElement[] = [];

  for (const el of Array.from(document.querySelectorAll<HTMLElement>(FIELD_QUERY))) {
    if (fields.length >= MAX_FIELDS) break;
    const kind = kindOf(el);
    if (!kind || kind === "button" || !isVisible(el)) continue;
    fields.push(describeElement(el, `f${seq++}`));
  }

  const actionEls = new Set<HTMLElement>();
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(ACTION_QUERY))) {
    if (actions.length >= MAX_ACTIONS) break;
    if (!isVisible(el)) continue;
    const outer = el.parentElement?.closest<HTMLElement>("button, a[href]");
    if (outer && actionEls.has(outer)) continue; // span[role=button] inside <button>
    actionEls.add(el);
    const d = describeElement(el, `a${seq++}`);
    if (d.kind === "toggle") fields.push(d);
    else if (d.label) actions.push(d);
  }

  for (const el of Array.from(document.querySelectorAll<HTMLElement>(LANDMARK_QUERY))) {
    if (landmarks.length >= MAX_LANDMARKS) break;
    if (!isVisible(el)) continue;
    const d = describeElement(el, `l${seq++}`);
    d.kind = "landmark";
    if (d.label) landmarks.push(d);
  }

  // Group fields: explicit form containers first, then implicit WBM/fieldset/dialog groups
  const groups = new Map<HTMLElement, PageElement[]>();
  for (const f of fields) {
    const container =
      f.element.closest<HTMLElement>("form, [role='form'], [role='search']") ||
      f.element.closest<HTMLElement>("fieldset, table, [role='dialog'], dialog, section");
    if (!container || isWidgetElement(container)) continue;
    groups.set(container, [...(groups.get(container) || []), f]);
  }

  const forms: PageFormGroup[] = [];
  for (const [container, groupFields] of groups) {
    const explicit = container.matches("form, [role='form'], [role='search']");
    if (!explicit && groupFields.length < 2) continue;
    const submit = findSubmit(container, actions);
    const key = `form${forms.length}`;
    groupFields.forEach((f) => (f.formKey = key));
    if (submit) submit.formKey = key;
    forms.push({ key, title: formTitle(container, groupFields, submit), container, fields: groupFields, submit });
  }

  return { url: location.href, scannedAt: Date.now(), elements: [...fields, ...actions, ...landmarks], forms };
}

export const ACTION_TARGET_KINDS: Partial<Record<WorkflowStep["action"], PageElementKind[]>> = {
  type: ["text", "textarea", "secret"],
  select: ["select"],
  click: ["button", "link", "toggle"],
  scroll: ["landmark", "button", "link", "text", "textarea", "select"],
  teleport: ["landmark"],
  verify: ["landmark", "button", "link", "text", "textarea", "select", "toggle"],
};

/** Actions that cannot run without a target. */
export const TARGET_REQUIRED: ReadonlySet<WorkflowStep["action"]> = new Set(["click", "type", "select", "verify"]);

export function suggestionsForAction(scan: PageScan | null, action: WorkflowStep["action"]): PageElement[] {
  const kinds = ACTION_TARGET_KINDS[action];
  if (!scan || !kinds) return [];
  return scan.elements.filter((e) => kinds.includes(e.kind)).sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind));
}

/** The natural action for an element (used by the picker). */
export function inferActionFor(el: PageElement): WorkflowStep["action"] {
  switch (el.kind) {
    case "text":
    case "textarea":
    case "secret":
      return "type";
    case "select":
      return "select";
    case "button":
    case "link":
    case "toggle":
      return "click";
    default:
      return "scroll";
  }
}

export function defaultStepTitle(action: WorkflowStep["action"], el: PageElement): string {
  const name = el.context ? `${el.label} (${el.context})` : el.label;
  switch (action) {
    case "type":
      return `Enter ${name}`;
    case "select":
      return `Choose ${name}`;
    case "click":
      return el.kind === "toggle" ? `Toggle ${name}` : `Click ${name}`;
    case "verify":
      return `Verify ${name}`;
    default:
      return `Go to ${name}`;
  }
}

/** Find the scanned element a stored step target refers to (exact selector, then live resolution). */
export function matchTarget(scan: PageScan | null, target: string | undefined): PageElement | undefined {
  if (!scan || !target) return undefined;
  const exact = scan.elements.find((e) => e.selector === target);
  if (exact) return exact;
  const live = smartQuerySelector(target);
  return live ? scan.elements.find((e) => e.element === live) : undefined;
}

/**
 * One-click form → workflow synthesis. Captures the form's current state:
 * typed values are prefilled, changed toggles become clicks, passwords stay blank,
 * and the submit control (or Enter on the last field) closes the sequence.
 */
export function synthesizeFormSteps(form: PageFormGroup): WorkflowStep[] {
  const stamp = Date.now();
  const steps: WorkflowStep[] = [];

  form.fields.forEach((f, i) => {
    if (f.disabled) return;
    const id = `step_${stamp}_${i}`;
    if (f.kind === "toggle") {
      const input = f.element as HTMLInputElement;
      if (input.checked === input.defaultChecked) return;
      steps.push({ id, title: defaultStepTitle("click", f), action: "click", target: f.selector, delayMs: 300, status: "idle" });
    } else if (f.kind === "select") {
      const value = (f.element as HTMLSelectElement).value;
      steps.push({ id, title: defaultStepTitle("select", f), action: "select", target: f.selector, value, delayMs: 300, status: "idle" });
    } else {
      const value = f.kind === "secret" ? "" : f.value || "";
      steps.push({ id, title: defaultStepTitle("type", f), action: "type", target: f.selector, value, delayMs: 300, status: "idle" });
    }
  });

  if (form.submit) {
    steps.push({ id: `step_${stamp}_submit`, title: `Click ${form.submit.label}`, action: "click", target: form.submit.selector, delayMs: 300, status: "idle" });
  } else {
    const lastType = [...steps].reverse().find((s) => s.action === "type");
    if (lastType) lastType.pressEnter = true;
  }
  return steps;
}
