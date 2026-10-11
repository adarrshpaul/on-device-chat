/**
 * Point-and-click element picker + hover preview outline for Workflow Studio.
 * Overlays are tagged data-eo-widget so they never appear in scans or agent grounding.
 */

import { isWidgetElement } from "./domUtils";

const INTERACTIVE =
  "button, a[href], input, select, textarea, label, [role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='tab'], [role='menuitem'], [contenteditable='true']";

function overlayBox(id: string, color: string): HTMLDivElement {
  let box = document.getElementById(id) as HTMLDivElement | null;
  if (!box) {
    box = document.createElement("div");
    box.id = id;
    box.setAttribute("data-eo-widget", "true");
    box.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;border:2px solid ${color};border-radius:6px;background:${color}1f;transition:all 70ms ease-out;display:none;`;
    const tag = document.createElement("span");
    tag.style.cssText = `position:absolute;top:-22px;left:-2px;background:${color};color:#0b0f1c;font:600 10px/1 ui-sans-serif,system-ui,sans-serif;padding:4px 7px;border-radius:5px;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis;`;
    box.appendChild(tag);
    document.body.appendChild(box);
  }
  return box;
}

function place(box: HTMLDivElement, el: HTMLElement, label?: string): void {
  const r = el.getBoundingClientRect();
  box.style.display = "block";
  box.style.top = `${r.top - 3}px`;
  box.style.left = `${r.left - 3}px`;
  box.style.width = `${r.width + 6}px`;
  box.style.height = `${r.height + 6}px`;
  const tag = box.firstElementChild as HTMLSpanElement;
  tag.style.display = label ? "block" : "none";
  tag.textContent = label || ""; // textContent, never innerHTML: page text is untrusted
}

function shortLabel(el: HTMLElement): string {
  const text = (el.getAttribute("aria-label") || (el as HTMLInputElement).placeholder || el.innerText || "").trim().replace(/\s+/g, " ");
  return `${el.tagName.toLowerCase()}${text ? ` · ${text.slice(0, 40)}` : ""}`;
}

/** Hover preview from the target combobox. No scrolling, no cursor glide. */
export function previewElement(el: HTMLElement | null): void {
  if (typeof document === "undefined") return;
  const box = overlayBox("eo-target-preview", "#a855f7");
  if (!el || !el.isConnected) {
    box.style.display = "none";
    return;
  }
  place(box, el);
}

/** Starts the picker; returns a stop function. Exactly one of onPick/onCancel fires. */
export function startElementPicker(opts: { onPick: (el: HTMLElement) => void; onCancel?: () => void }): () => void {
  const box = overlayBox("eo-picker-box", "#22d3ee");
  const banner = document.createElement("div");
  banner.setAttribute("data-eo-widget", "true");
  banner.style.cssText =
    "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#0b0f1c;border:1px solid #22d3ee;color:#e2e8f0;font:500 11px ui-sans-serif,system-ui,sans-serif;padding:6px 14px;border-radius:9999px;box-shadow:0 8px 24px rgba(34,211,238,.25);pointer-events:none;";
  banner.textContent = "Click an element to use it as the step target · Esc to cancel";
  document.body.appendChild(banner);

  const style = document.createElement("style");
  style.textContent = "html.eo-picking, html.eo-picking *:not([data-eo-widget]):not([data-eo-widget] *) { cursor: crosshair !important; }";
  document.head.appendChild(style);
  document.documentElement.classList.add("eo-picking");

  let current: HTMLElement | null = null;

  const resolve = (t: EventTarget | null): HTMLElement | null => {
    if (!(t instanceof HTMLElement) || isWidgetElement(t)) return null;
    const hit = t.closest<HTMLElement>(INTERACTIVE) || t;
    if (hit instanceof HTMLLabelElement && hit.control) return hit.control as HTMLElement;
    return hit;
  };

  const onMove = (e: PointerEvent) => {
    current = resolve(e.target);
    if (current) place(box, current, shortLabel(current));
    else box.style.display = "none";
  };
  const swallow = (e: Event) => {
    if (resolve(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  const onClick = (e: MouseEvent) => {
    const el = resolve(e.target);
    if (!el) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    stop();
    opts.onPick(el);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    stop();
    opts.onCancel?.();
  };
  const onScroll = () => current && place(box, current, shortLabel(current));

  const swallowed = ["pointerdown", "mousedown", "pointerup", "mouseup", "touchstart", "submit"];
  window.addEventListener("pointermove", onMove, true);
  swallowed.forEach((t) => window.addEventListener(t, swallow, true));
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onScroll, true);

  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("pointermove", onMove, true);
    swallowed.forEach((t) => window.removeEventListener(t, swallow, true));
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onScroll, true);
    document.documentElement.classList.remove("eo-picking");
    style.remove();
    banner.remove();
    box.style.display = "none";
  }
  return stop;
}
