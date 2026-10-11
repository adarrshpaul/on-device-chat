/**
 * Macro Recorder Engine ("Teach 1 → Batch N")
 *
 * Captures user actions on a single DOM entity (Item 1), computes relative
 * sub-element selectors within that entity, discovers all sibling entities,
 * and compiles the sequence into an executable, parameterized BatchProposal.
 */

import type { WorkflowStep, BatchEntityItem, BatchProposal } from "./types";
import { BatchProposalManager } from "./batchEngine";

export interface RecordedDomAction {
  type: "click" | "input" | "change";
  targetSelector: string;
  relativeSelector: string;
  value?: string;
  tagName: string;
  textSnippet: string;
  timestamp: number;
}

export interface MacroRecordingSession {
  isActive: boolean;
  entityRoot: HTMLElement | null;
  entitySelector: string;
  entityName: string;
  actions: RecordedDomAction[];
  startTime: number;
}

export class MacroRecorder {
  private static session: MacroRecordingSession | null = null;
  private static bannerEl: HTMLElement | null = null;
  private static onStopCallback: ((proposal: BatchProposal) => void) | null = null;

  private static handleClick = (e: MouseEvent) => {
    if (!MacroRecorder.session || !MacroRecorder.session.isActive) return;

    const target = e.target as HTMLElement;
    if (!target) return;

    // Ignore clicks inside chat widget or floating banners
    if (target.closest("#gemma4-widget-root") || target.closest(".g4-widget-container") || target.closest("#g4-macro-recorder-banner")) {
      return;
    }

    MacroRecorder.recordAction(target, "click");
  };

  private static handleInput = (e: Event) => {
    if (!MacroRecorder.session || !MacroRecorder.session.isActive) return;

    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!target) return;

    if (target.closest("#gemma4-widget-root") || target.closest(".g4-widget-container") || target.closest("#g4-macro-recorder-banner")) {
      return;
    }

    MacroRecorder.recordAction(target, "input", target.value);
  };

  /**
   * Start recording user actions on Entity 1
   */
  static startRecording(options: {
    targetContainer?: string;
    onProposalReady?: (proposal: BatchProposal) => void;
  } = {}): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if (this.session && this.session.isActive) {
      this.stopRecording();
    }

    this.onStopCallback = options.onProposalReady || null;

    this.session = {
      isActive: true,
      entityRoot: null,
      entitySelector: "",
      entityName: "",
      actions: [],
      startTime: Date.now(),
    };

    // Attach capture-phase event listeners to observe user actions
    window.addEventListener("click", this.handleClick, true);
    window.addEventListener("input", this.handleInput, true);
    window.addEventListener("change", this.handleInput, true);

    this.renderRecordingBanner();
    console.log("[MacroRecorder] Recording started. Perform actions on Entity 1...");
  }

  /**
   * Record a single interaction step
   */
  private static recordAction(target: HTMLElement, type: "click" | "input" | "change", value?: string): void {
    if (!this.session) return;

    // 1. If entityRoot is not set yet, identify the root entity container
    if (!this.session.entityRoot) {
      const root = this.findEntityContainer(target);
      if (root) {
        this.session.entityRoot = root;
        this.session.entitySelector = this.computeSelector(root);
        this.session.entityName = this.extractEntityName(root);

        // Highlight entity container subtly
        root.style.outline = "2px dashed #a855f7";
        root.style.outlineOffset = "2px";
      }
    }

    const relativeSelector = this.session.entityRoot
      ? this.computeRelativeSelector(this.session.entityRoot, target)
      : "";

    const action: RecordedDomAction = {
      type,
      targetSelector: this.computeSelector(target),
      relativeSelector,
      value,
      tagName: target.tagName.toLowerCase(),
      textSnippet: target.textContent?.trim().slice(0, 30) || "",
      timestamp: Date.now(),
    };

    // Debounce fast repeated inputs on the same element
    const lastAction = this.session.actions[this.session.actions.length - 1];
    if (
      lastAction &&
      lastAction.targetSelector === action.targetSelector &&
      (type === "input" || type === "change") &&
      lastAction.type === type
    ) {
      lastAction.value = value;
      lastAction.timestamp = Date.now();
    } else {
      this.session.actions.push(action);
    }

    this.updateBannerCount();
  }

  /**
   * Stop recording and generate the BatchProposal
   */
  static stopRecording(): BatchProposal | null {
    if (typeof window === "undefined" || !this.session) return null;

    window.removeEventListener("click", this.handleClick, true);
    window.removeEventListener("input", this.handleInput, true);
    window.removeEventListener("change", this.handleInput, true);

    // Clean up container outline
    if (this.session.entityRoot) {
      this.session.entityRoot.style.outline = "";
      this.session.entityRoot.style.outlineOffset = "";
    }

    this.removeRecordingBanner();

    const recorded = this.session;
    this.session = null;

    if (recorded.actions.length === 0) {
      console.warn("[MacroRecorder] No actions were recorded.");
      return null;
    }

    // 2. Discover all sibling entities in the same table/grid
    const siblings = this.findSiblingEntities(recorded.entityRoot);

    // 3. Compile recorded actions into parameterized WorkflowStep[]
    const templateSteps = this.compileActionsToSteps(recorded.actions);

    // 4. Create BatchProposal
    const proposal = BatchProposalManager.createProposal({
      title: `Batch Macro (${recorded.actions.length} steps on ${siblings.length} items)`,
      intent: `Automated replay of user demonstration across ${siblings.length} sibling entities`,
      templateSteps,
      customEntities: siblings,
    });

    if (this.onStopCallback) {
      this.onStopCallback(proposal);
    }

    console.log("[MacroRecorder] Compiled BatchProposal:", proposal);
    return proposal;
  }

  /**
   * Determine whether recording is currently active
   */
  static isRecording(): boolean {
    return Boolean(this.session && this.session.isActive);
  }

  /**
   * Find the closest semantic entity container (tr, card, listitem, e-commerce item)
   */
  private static findEntityContainer(el: HTMLElement): HTMLElement {
    // 1. Check for standard tabular and semantic HTML containers
    const semanticCandidate = el.closest(
      "tr, [role='listitem'], [role='row'], [role='article'], article, li, [data-testid*='item'], [data-testid*='product']"
    ) as HTMLElement;
    if (semanticCandidate && semanticCandidate !== document.body) return semanticCandidate;

    // 2. Check for common e-commerce, developer, catalog, and dashboard class patterns
    const classCandidate = el.closest(
      "[data-component-type='s-search-result'], .s-result-item, article.Box-row, .Box-row, tr.athing, .inventory_item, .product_pod, .product-item, .product-card, .item-card, [class*='inventory_item'], [class*='product_pod'], [class*='product-item'], [class*='product_card'], [class*='product-card'], [class*='item-card']"
    ) as HTMLElement;
    if (classCandidate && classCandidate !== document.body) return classCandidate;

    // 3. Fallback: closest element with card, row, or item in class or data attributes
    const genericCandidate = el.closest(
      ".card, [class*='card'], [class*='row'], [class*='item'], [data-id], [data-sku], [data-item-id]"
    ) as HTMLElement;
    if (genericCandidate && genericCandidate !== document.body && genericCandidate !== el) return genericCandidate;

    // Fallback: parent element if reasonable
    return (el.parentElement as HTMLElement) || el;
  }

  /**
   * Find all sibling entities sharing the same parent and tag/structure
   */
  static findSiblingEntities(root: HTMLElement | null): BatchEntityItem[] {
    if (!root) return [];

    const tagName = root.tagName.toLowerCase();
    const classList = root.className && typeof root.className === "string"
      ? root.className.split(/\s+/).filter(c => c && !c.startsWith("ng-") && !c.includes("hover") && !c.includes("focus"))
      : [];
    const primaryClass = classList[0] || "";

    let matchSelector = "";
    if (tagName === "tr") {
      matchSelector = "tr";
    } else if (primaryClass) {
      matchSelector = `${tagName}.${primaryClass}`;
    } else {
      matchSelector = tagName;
    }

    let siblingElements: HTMLElement[] = [];
    let listContainer: HTMLElement | null = root.parentElement;

    // Multi-level ancestor scan: walk up until we find an ancestor container holding > 1 matching siblings
    while (listContainer && listContainer !== document.body) {
      // 1. Try tag + primaryClass
      let candidates = Array.from(listContainer.querySelectorAll(matchSelector)) as HTMLElement[];
      if (candidates.length > 1) {
        siblingElements = candidates;
        break;
      }

      // 2. Try primaryClass alone
      if (primaryClass) {
        candidates = Array.from(listContainer.querySelectorAll(`.${primaryClass}`)) as HTMLElement[];
        if (candidates.length > 1) {
          siblingElements = candidates;
          matchSelector = `.${primaryClass}`;
          break;
        }
      }

      // 3. Try tag alone if semantic (article, li, tr)
      if (tagName === "article" || tagName === "tr" || primaryClass.includes("product") || primaryClass.includes("item")) {
        const anyTag = Array.from(listContainer.querySelectorAll(tagName)) as HTMLElement[];
        if (anyTag.length > 1) {
          siblingElements = anyTag;
          matchSelector = tagName;
          break;
        }
      }

      listContainer = listContainer.parentElement;
    }

    if (siblingElements.length === 0 && root.parentElement) {
      siblingElements = Array.from(root.parentElement.children) as HTMLElement[];
    }

    const items: BatchEntityItem[] = [];

    siblingElements.forEach((el, idx) => {
      const text = el.textContent?.trim() || "";
      if (!text || text.length < 2) return;

      const name = this.extractEntityName(el) || `Item #${idx + 1}`;
      const statusEl = el.querySelector(".status, [data-status], .badge, [class*='status'], [class*='tag']");
      const status = statusEl?.textContent?.trim() || "ready";
      const id = el.id || el.getAttribute("data-id") || `entity_${idx + 1}`;

      // Stable selector generation for sibling item
      let selector = "";
      if (el.id) {
        selector = `#${el.id}`;
      } else if (el.getAttribute("data-id")) {
        selector = `[data-id="${el.getAttribute("data-id")}"]`;
      } else if (listContainer && listContainer.id) {
        selector = `#${listContainer.id} ${matchSelector}:nth-of-type(${idx + 1})`;
      } else if (primaryClass) {
        selector = `.${primaryClass}:nth-of-type(${idx + 1})`;
      } else {
        selector = `${tagName}:nth-of-type(${idx + 1})`;
      }

      items.push({
        id,
        name,
        status,
        selector,
        selected: true,
        variables: {
          entity_name: name,
          entity_id: id,
          entity_selector: selector,
          status,
        },
        executionState: "pending",
      });
    });

    return items;
  }

  /**
   * Compile recorded actions into parameterized WorkflowSteps
   */
  private static compileActionsToSteps(actions: RecordedDomAction[]): WorkflowStep[] {
    return actions.map((act, idx) => {
      // Target combines entity container selector with the relative selector inside it
      const target = act.relativeSelector
        ? `{{entity_selector}} ${act.relativeSelector}`.trim()
        : "{{entity_selector}}";

      let title = "";
      let action: "click" | "type" = "click";
      if (act.type === "click") {
        title = `Click ${act.textSnippet || act.tagName}`;
        action = "click";
      } else if (act.type === "input" || act.type === "change") {
        title = `Enter "${act.value || ''}"`;
        action = "type";
      } else {
        title = `Click ${act.tagName}`;
        action = "click";
      }

      return {
        id: `rec_step_${idx + 1}`,
        title: `${title} [{{entity_name}}]`,
        action,
        target,
        value: act.value,
        status: "idle",
      };
    });
  }

  /**
   * Compute selector relative to the entity container
   */
  private static computeRelativeSelector(container: HTMLElement, target: HTMLElement): string {
    if (container === target) return "";

    // 1. Check if target has a specific class or attribute inside container
    if (target.id) return `#${target.id}`;

    const tag = target.tagName.toLowerCase();

    // Check for distinct button / input names
    if (tag === "button" || tag === "input" || tag === "select" || tag === "a") {
      const nameAttr = target.getAttribute("name");
      if (nameAttr) return `${tag}[name='${nameAttr}']`;

      const typeAttr = target.getAttribute("type");
      if (typeAttr && typeAttr !== "text") return `${tag}[type='${typeAttr}']`;

      const roleAttr = target.getAttribute("role");
      if (roleAttr) return `${tag}[role='${roleAttr}']`;

      const actionAttr = target.getAttribute("data-action");
      if (actionAttr) return `[data-action='${actionAttr}']`;

      if (target.className && typeof target.className === "string") {
        const classes = target.className.split(/\s+/).filter(c => !c.startsWith("g4-") && c.length > 2);
        if (classes.length > 0) return `${tag}.${classes[0]}`;
      }
    }

    // 2. Fallback to child tree path within container
    let path = "";
    let curr: HTMLElement | null = target;

    while (curr && curr !== container) {
      const parent: HTMLElement | null = curr.parentElement;
      if (!parent) break;

      const currTag = curr.tagName.toLowerCase();
      const siblings = Array.from(parent.children).filter(c => c.tagName.toLowerCase() === currTag);
      const index = siblings.indexOf(curr) + 1;

      const segment = siblings.length > 1 ? `${currTag}:nth-of-type(${index})` : currTag;
      path = path ? `${segment} > ${path}` : segment;

      curr = parent;
    }

    return path;
  }

  /**
   * Compute absolute/unique DOM selector for an element
   */
  private static computeSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;

    const tag = el.tagName.toLowerCase();
    const parent = el.parentElement;
    if (!parent) return tag;

    const siblings = Array.from(parent.children).filter(c => c.tagName.toLowerCase() === tag);
    const index = siblings.indexOf(el) + 1;

    return `${tag}:nth-of-type(${index})`;
  }

  /**
   * Extract human-readable entity name from element
   */
  private static extractEntityName(el: HTMLElement): string {
    const heading = el.querySelector("h2, h3, h4, h5, .title, strong, a, [data-name]");
    const raw = heading?.textContent?.trim() || el.children[0]?.textContent?.trim() || el.textContent?.trim().slice(0, 40) || "Item";
    return raw.replace(/\s+/g, " ").slice(0, 60);
  }

  /**
   * Floating Recording Banner
   */
  private static renderRecordingBanner(): void {
    if (this.bannerEl) this.bannerEl.remove();

    this.bannerEl = document.createElement("div");
    this.bannerEl.id = "g4-macro-recorder-banner";
    this.bannerEl.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      border: 1px solid #a855f7;
      box-shadow: 0 10px 30px rgba(168, 85, 247, 0.35);
      border-radius: 9999px;
      padding: 8px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: #f8fafc;
    `;

    this.bannerEl.innerHTML = `
      <span style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1.5s infinite;"></span>
        <strong>Recording Macro:</strong> Perform action on Item 1 (<span id="g4-macro-step-count">0</span> steps)
      </span>
      <button id="g4-btn-stop-macro" style="background: #a855f7; color: #fff; border: none; border-radius: 9999px; padding: 4px 12px; font-weight: 700; cursor: pointer; font-size: 11px;">
        Done Recording ✔
      </button>
      <button id="g4-btn-cancel-macro" style="background: transparent; color: #94a3b8; border: none; cursor: pointer; font-size: 11px;">
        Cancel ✖
      </button>
    `;

    document.body.appendChild(this.bannerEl);

    document.getElementById("g4-btn-stop-macro")?.addEventListener("click", () => {
      MacroRecorder.stopRecording();
    });

    document.getElementById("g4-btn-cancel-macro")?.addEventListener("click", () => {
      MacroRecorder.cancelRecording();
    });
  }

  private static updateBannerCount(): void {
    const el = document.getElementById("g4-macro-step-count");
    if (el && this.session) {
      el.textContent = String(this.session.actions.length);
    }
  }

  private static removeRecordingBanner(): void {
    if (this.bannerEl) {
      this.bannerEl.remove();
      this.bannerEl = null;
    }
  }

  static cancelRecording(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("click", this.handleClick, true);
      window.removeEventListener("input", this.handleInput, true);
      window.removeEventListener("change", this.handleInput, true);
    }
    if (this.session && this.session.entityRoot) {
      this.session.entityRoot.style.outline = "";
      this.session.entityRoot.style.outlineOffset = "";
    }
    this.removeRecordingBanner();
    this.session = null;
    console.log("[MacroRecorder] Recording canceled.");
  }
}
