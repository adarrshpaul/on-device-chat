/**
 * Universal Agent Harness for Web Applications
 *
 * Implements the Five Primitives architecture:
 * 1. `read` / `write` / `edit` — Local scratchpad notes, memory, state inspection
 * 2. `sandbox` — Sandboxed deterministic JS execution (no direct DOM tampering)
 * 3. `browse` — Inspect accessibility tree, snapshot, click, type, extract on any host website
 * 4. `search` — Find elements, headings, text across the active page
 * 5. `ask` — Stop when only the user knows
 *
 * Key Harness Guarantees:
 * - Separates "decide" (frozen model) from "do" (deterministic host code).
 * - Context compaction: Storing heavy observations (>1KB) into memory refs (mem://...)
 * - Loop guards: Detects consecutive identical calls and breaks cycles.
 * - Step cap: Hard cutoff (default 10 steps).
 * - Dynamic few-shot exemplars & deterministic macro execution.
 */

declare const chrome: any;

import { recipeStore, isActionGoal } from "./recipeStore";
import { expertJudge, AgentStepTrace, EvalTrace } from "./expertJudge";
import { ModelTier, ToolDefinition, DEFAULT_BROWSER_TOOLS, DecisionTrace } from "./types";
import { smartQuerySelector, smartQuerySelectorAll, getCleanElementSelector, isWidgetElement } from "./domUtils";
import { VisionService } from "./visionService";
import { buildHarnessPrompt } from "./harnessPrompt";
import { parseHarnessDecision, HarnessToolCall } from "./harnessDecisionParser";
import { ProbabilisticHarnessEngine } from "./probabilisticHarness";
import { A11yTreeEngine } from "./a11yTree";
import { SomOverlayManager } from "./somOverlay";
import { ActionDispatcher } from "./actionDispatcher";
import { StateDeltaVerifier } from "./stateDeltaVerifier";
import { runSandboxExpression } from "./safeExpression";
import { NavPersistenceManager, InFlightTaskState } from "./navPersistence";
import { SafetyGate } from "./safetyGate";
import { TodoManager, globalTodoManager, TodoStatus, PlanState } from "./todoManager";
import { ReasoningManager } from "./reasoningManager";
import { WaitManager } from "./waitManager.ts";
import { DataExtractor } from "./dataExtractor.ts";

export type { HarnessToolCall };

export interface HarnessExecutionResult {
  final: string;
  trajectory: AgentStepTrace[];
  isMacro: boolean;
  totalDurationMs: number;
  decision?: DecisionTrace;
  plan?: PlanState | null;
  thinking?: string;
  tokensSavedPct?: number;
}

export interface HarnessConfig {
  maxSteps?: number;
  onAskUser?: (question: string) => Promise<string>;
  onStepProgress?: (
    step: number,
    tool: string,
    observation: string,
    meta?: {
      durationMs?: number;
      args?: Record<string, unknown>;
      thinking?: string;
      planMilestone?: string;
    }
  ) => void;
  customHostTools?: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  customToolDefs?: ToolDefinition[];
  todoManager?: TodoManager;
  onPlanApprovalRequired?: (plan: PlanState) => Promise<boolean>;
}

export function isFailureObservation(obs: string): boolean {
  if (!obs || typeof obs !== "string") return false;
  const lower = obs.toLowerCase().trim();

  // Explicit tool execution error or failure prefixes
  if (
    lower.startsWith("error") ||
    lower.startsWith("failed") ||
    lower.includes("error executing tool") ||
    lower.includes("action blocked by safety gate") ||
    lower.includes("blocked by safety gate") ||
    lower.includes("timed out") ||
    lower.includes("execution timeout") ||
    lower.includes("unknown tool") ||
    lower.includes("unknown browse action") ||
    lower.includes("syntax error") ||
    lower.includes("click failed") ||
    lower.includes("hover failed") ||
    lower.includes("download failed") ||
    lower.includes("selector required") ||
    lower.includes("target [id] or selector required") ||
    lower.includes("irreversible action denied")
  ) {
    return true;
  }

  // Not found errors specifically tied to targets/elements/catalog
  if (
    lower.includes("not found on page") ||
    lower.includes("no matching download element") ||
    lower.includes("catalog verification failed") ||
    lower.includes("0 occurrences matching selector") ||
    lower.includes("does not appear in")
  ) {
    return true;
  }

  return false;
}

export function isSafeNavigationUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("blob:")
  ) {
    return false;
  }
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return true;
  }
  try {
    const origin = typeof window !== "undefined" ? window.location.href : "https://localhost";
    const parsed = new URL(url, origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export class AgentHarness {
  private maxSteps: number;
  private onAskUser?: (question: string) => Promise<string>;
  private onStepProgress?: HarnessConfig["onStepProgress"];
  private customHostTools: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  private customToolDefs: ToolDefinition[];
  private memoryStore: Map<string, string> = new Map();
  private currentUserGoal: string = "";
  private currentConversationHistory: Array<{ role: string; content: string }> = [];
  private currentStepIndex: number = 0;
  private currentTrajectory: AgentStepTrace[] = [];
  private activeAbortController: AbortController | null = null;
  private todoManager: TodoManager;
  private onPlanApprovalRequired?: (plan: PlanState) => Promise<boolean>;

  constructor(config: HarnessConfig = {}) {
    this.maxSteps = config.maxSteps || 10;
    this.onAskUser = config.onAskUser;
    this.onStepProgress = config.onStepProgress;
    this.customHostTools = config.customHostTools || {};
    this.customToolDefs =
      config.customToolDefs && config.customToolDefs.length > 0
        ? config.customToolDefs
        : DEFAULT_BROWSER_TOOLS;
    this.todoManager = config.todoManager || globalTodoManager;
    this.onPlanApprovalRequired = config.onPlanApprovalRequired;
  }

  getTodoManager(): TodoManager {
    return this.todoManager;
  }

  /**
   * Cancel active loop (Inngest Singleton Concurrency / Steering pattern)
   */
  cancelActiveRun(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    SomOverlayManager.clearBadges();
  }

  /**
   * The Five Canonical Primitives
   */

  /** Primitive 1: read */
  private async primitiveRead(args: Record<string, unknown> = {}): Promise<string> {
    const rawArgs = args || {};
    const target = String(rawArgs.target || rawArgs.key || "notes");
    if (target.startsWith("mem://")) {
      const val = this.memoryStore.get(target);
      return val || `Memory ref ${target} not found.`;
    }
    if (target.startsWith("dom:")) {
      const selector = target.replace("dom:", "");
      const el = smartQuerySelector(selector);
      if (!el) return `Element ${selector} not found on page.`;
      return `Element <${el.tagName.toLowerCase()}> text: "${(el.textContent || "").trim().slice(0, 500)}"`;
    }
    const val = this.memoryStore.get(target);
    return val || `No note or memory found under "${target}".`;
  }

  /** Primitive 1: write / edit */
  private async primitiveWrite(args: Record<string, unknown> = {}): Promise<string> {
    const rawArgs = args || {};
    const target = String(rawArgs.target || rawArgs.key || "notes");
    const content = String(rawArgs.content ?? rawArgs.value ?? "");
    if (target.startsWith("dom:")) {
      const selector = target.replace("dom:", "");
      const el = smartQuerySelector(selector) as HTMLInputElement;
      if (!el) return `DOM element ${selector} not found.`;
      el.value = content;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return `Updated DOM input ${selector} with value.`;
    }
    this.memoryStore.set(target, content);
    return `Saved to memory under "${target}" (${content.length} chars).`;
  }

  /** Primitive 2: sandbox */
  private async primitiveSandbox(args: Record<string, unknown> = {}): Promise<string> {
    const rawArgs = args || {};
    const code = String(rawArgs.code || rawArgs.expression || "");
    const context = (rawArgs.context && typeof rawArgs.context === "object") ? rawArgs.context as Record<string, unknown> : {};
    // Arithmetic-only parser: no JavaScript engine, no access to the page realm (see safeExpression.ts)
    return runSandboxExpression(code, context).slice(0, 1000);
  }

  /** Primitive 3: browse (Inspect, Snapshot, Click, Type on any website) */
  private async primitiveBrowse(args: Record<string, unknown> = {}): Promise<string> {
    const rawArgs = args || {};
    let action = String(rawArgs.action || "").toLowerCase().trim();
    if (!action) {
      if (rawArgs.prompt || rawArgs.question) {
        action = "see";
      } else {
        action = "snapshot";
      }
    }
    const selector = rawArgs.selector ? String(rawArgs.selector) : "";
    const value = rawArgs.value !== undefined ? String(rawArgs.value) : "";

    const highlightElement = (el: HTMLElement, label?: string) => {
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
        overlay.innerHTML = `<span style="position: absolute; top: -22px; left: 0; background: #0284c7; color: white; font-family: monospace; font-size: 11px; padding: 2px 6px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">${badgeText} [${Math.round(rect.width)}×${Math.round(rect.height)}]</span>`;

        setTimeout(() => {
          if (overlay) {
            overlay.style.opacity = "0";
          }
        }, 2500);
      } catch {}
    };

    switch (action) {
      case "inspect": {
        if (!selector) return "Error: selector required for inspect action.";
        const el = smartQuerySelector(selector);
        if (!el) return `Inspect failed: element "${selector}" not found on page.`;

        highlightElement(el, `Inspected: ${selector}`);
        const rect = el.getBoundingClientRect();
        const inputEl = el as HTMLInputElement;

        const details = [
          `Tag: <${el.tagName.toLowerCase()}>`,
          el.id ? `ID: #${el.id}` : "",
          el.className ? `Class: .${String(el.className).split(" ").join(".")}` : "",
          `Visible: ${rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0}`,
          `Bounds: ${Math.round(rect.width)}x${Math.round(rect.height)} at (x:${Math.round(rect.left)}, y:${Math.round(rect.top)})`,
          inputEl.type ? `Type: ${inputEl.type}` : "",
          inputEl.placeholder ? `Placeholder: "${inputEl.placeholder}"` : "",
          inputEl.value !== undefined ? `Current Value: "${inputEl.value}"` : "",
          el.textContent ? `Text: "${el.textContent.trim().slice(0, 150)}"` : "",
          el.getAttribute("role") ? `ARIA Role: "${el.getAttribute("role")}"` : "",
          el.getAttribute("aria-label") ? `ARIA Label: "${el.getAttribute("aria-label")}"` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        return `Inspected element "${selector}": ${details}`;
      }

      case "explore":
      case "map":
      case "overview": {
        const { generateSiteOverview } = await import("./pageContext");
        const overview = generateSiteOverview();
        return overview;
      }

      case "snapshot": {
        // Build clean indexed accessibility tree [1..N] (Mind2Web / Stagehand standard)
        const nodes = A11yTreeEngine.scan({ viewportOnly: true, maxItems: 36 });
        const dump = A11yTreeEngine.formatForPrompt(nodes);
        return this.compactObservation(dump, `Interactive a11y tree (${nodes.length} elements mapped [1..${nodes.length}])`);
      }

      case "som":
      case "badge":
      case "badges": {
        // In-DOM Set-of-Marks visual overlay (Browser-Use / SeeClick standard)
        const nodes = A11yTreeEngine.scan({ viewportOnly: true, maxItems: 36 });
        SomOverlayManager.renderBadges(nodes, 4500);
        const dump = A11yTreeEngine.formatForPrompt(nodes);
        return `Rendered Set-of-Marks visual badges for ${nodes.length} elements:\n${dump}`;
      }

      case "click": {
        // SeeClick / ScreenSpot Pattern: Support normalized coordinate clicking [normX, normY]
        if (rawArgs.normX !== undefined && rawArgs.normY !== undefined) {
          const before = StateDeltaVerifier.captureSnapshot();
          const ok = await ActionDispatcher.clickCoordinates(Number(rawArgs.normX), Number(rawArgs.normY));
          const after = StateDeltaVerifier.captureSnapshot();
          const delta = StateDeltaVerifier.computeDelta(before, after);
          return ok
            ? `Successfully clicked at normalized coordinates (${rawArgs.normX}, ${rawArgs.normY}). State transition: ${delta.summary}.`
            : `Click failed at coordinates (${rawArgs.normX}, ${rawArgs.normY}): no target element found at location.`;
        }

        const rawTarget = rawArgs.target !== undefined ? rawArgs.target : (rawArgs.targetId !== undefined ? rawArgs.targetId : (rawArgs.id !== undefined ? rawArgs.id : selector));
        if (rawTarget === undefined || rawTarget === "") return "Error: target [ID] or selector required for click action.";
        const resolved = ActionDispatcher.resolveTarget(rawTarget);
        if (!resolved.element) {
          return `Click failed: target "${resolved.identifierDescription}" not found on page.`;
        }

        const safety = await SafetyGate.checkAndConfirm({
          actionType: "click",
          element: resolved.element,
          targetDescription: resolved.identifierDescription,
        });
        if (!safety.allowed) {
          return `Action blocked by Safety Gate: ${safety.reason || "Irreversible action denied by user."}`;
        }

        highlightElement(resolved.element, "Clicked");

        const before = StateDeltaVerifier.captureSnapshot();

        // Check if element is a navigation link leading to another page
        const anchor = resolved.element.closest("a") as HTMLAnchorElement | null;
        if (anchor && anchor.href && isSafeNavigationUrl(anchor.href) && !anchor.href.startsWith("#")) {
          const currentHref = typeof window !== "undefined" ? window.location.href : "";
          const isDifferentPage = anchor.href !== currentHref && !anchor.href.startsWith(currentHref + "#");
          if (isDifferentPage) {
            NavPersistenceManager.saveTask({
              id: `task_${Date.now()}`,
              userGoal: this.currentUserGoal,
              stepIndex: this.currentStepIndex + 1,
              maxSteps: this.maxSteps,
              trajectory: [...this.currentTrajectory],
              conversationHistory: this.currentConversationHistory,
              workingMemory: Object.fromEntries(this.memoryStore.entries()),
              originUrl: currentHref,
              targetUrl: anchor.href,
            });
          }
        }

        const repeatCount = typeof rawArgs.repeatCount === "number" && rawArgs.repeatCount > 0 ? rawArgs.repeatCount : 1;
        for (let r = 0; r < repeatCount; r++) {
          const clicked = await ActionDispatcher.click(resolved.element, { skipSafetyCheck: true });
          if (!clicked) {
            const failReason = ActionDispatcher.lastSafetyResult?.reason || "element click was dropped or not interactable";
            return `Click failed on ${resolved.identifierDescription}: ${failReason}.`;
          }
          if (r < repeatCount - 1) {
            await WaitManager.waitForDomSettle({ quietPeriodMs: 100, timeoutMs: 1000 });
          }
        }
        await WaitManager.waitForPageReady({ quietPeriodMs: 100, idlePeriodMs: 150, timeoutMs: 2000 });
        const after = StateDeltaVerifier.captureSnapshot();
        const delta = StateDeltaVerifier.computeDelta(before, after);

        return `Successfully clicked ${resolved.identifierDescription}${repeatCount > 1 ? ` (${repeatCount} times)` : ""} [${ActionDispatcher.lastInputMode} input]. State transition: ${delta.summary}.`;
      }

      case "type": {
        const rawTarget = rawArgs.target !== undefined ? rawArgs.target : (rawArgs.targetId !== undefined ? rawArgs.targetId : (rawArgs.id !== undefined ? rawArgs.id : selector));
        if (rawTarget === undefined || rawTarget === "") return "Error: target [ID] or selector required for type action.";
        const resolved = ActionDispatcher.resolveTarget(rawTarget);
        if (!resolved.element) {
          return `Type failed: target "${resolved.identifierDescription}" not found on page.`;
        }

        const safety = await SafetyGate.checkAndConfirm({
          actionType: "type",
          element: resolved.element,
          value,
          targetDescription: resolved.identifierDescription,
        });
        if (!safety.allowed) {
          return `Action blocked by Safety Gate: ${safety.reason || "Irreversible action denied by user."}`;
        }

        highlightElement(resolved.element, "Typing");

        const before = StateDeltaVerifier.captureSnapshot();
        await ActionDispatcher.type(resolved.element, value, {
          clearFirst: rawArgs.clear !== false,
          pressEnter: Boolean(rawArgs.enter || rawArgs.pressEnter),
        });
        const after = StateDeltaVerifier.captureSnapshot();
        const delta = StateDeltaVerifier.computeDelta(before, after);

        return `Successfully typed "${value}" into ${resolved.identifierDescription} [${ActionDispatcher.lastInputMode} input]. State transition: ${delta.summary}.`;
      }

      case "select": {
        const rawTarget = rawArgs.target !== undefined ? rawArgs.target : (rawArgs.targetId !== undefined ? rawArgs.targetId : (rawArgs.id !== undefined ? rawArgs.id : selector));
        if (rawTarget === undefined || rawTarget === "") return "Error: target [ID] or selector required for select action.";
        const resolved = ActionDispatcher.resolveTarget(rawTarget);
        if (!resolved.element || !(resolved.element instanceof HTMLSelectElement)) {
          return `Select failed: target "${resolved.identifierDescription}" is not a select element.`;
        }
        const success = await ActionDispatcher.select(resolved.element, value);
        if (!success) {
          return `Option "${value}" not found in ${resolved.identifierDescription}.`;
        }
        return `Selected "${value}" in ${resolved.identifierDescription}.`;
      }

      case "extract": {
        return this.primitiveExtract(rawArgs);
      }

      case "see":
      case "look":
      case "visual":
      case "ocr": {
        const prompt = String(rawArgs.prompt || rawArgs.question || "Describe what is visually displayed on this page or element.");
        // Render Set-of-Marks badges in DOM before vision analysis
        const nodes = A11yTreeEngine.scan({ viewportOnly: true, maxItems: 36 });
        SomOverlayManager.renderBadges(nodes, 4000);
        try {
          const visionResult = await VisionService.describeVisualScene(selector, prompt);
          return `[Visual Observation (${visionResult.engineUsed}, ${visionResult.durationMs}ms)]: ${visionResult.text}`;
        } catch (err: any) {
          return `Vision analysis failed: ${err.message}`;
        }
      }

      case "scroll": {
        const direction = String(rawArgs.direction || "down").toLowerCase();
        const amount = typeof rawArgs.amount === "number" ? rawArgs.amount : 600;
        if (selector) {
          const el = smartQuerySelector(selector);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            highlightElement(el, "Scrolled To");
            return `Scrolled element "${selector}" into view.`;
          }
        }
        if (typeof window !== "undefined") {
          if (direction === "top" || rawArgs.position === "top" || rawArgs.target === "top") {
            window.scrollTo({ top: 0, behavior: "smooth" });
            return `Scrolled window to top (scrollY: 0).`;
          }
          if (direction === "bottom" || rawArgs.position === "bottom" || rawArgs.target === "bottom") {
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            return `Scrolled window to bottom (scrollY: ${Math.round(document.body.scrollHeight)}).`;
          }
          const deltaY = direction === "up" ? -amount : amount;
          window.scrollBy({ top: deltaY, behavior: "smooth" });
          if (document.scrollingElement && document.scrollingElement !== document.documentElement) {
            document.scrollingElement.scrollBy({ top: deltaY, behavior: "smooth" });
          }
          return `Scrolled window ${direction} by ${Math.abs(deltaY)}px (new scrollY: ${Math.round(window.scrollY)}).`;
        }
        return "Scroll action executed.";
      }

      case "tour": {
        const { executeSiteTour } = await import("./siteTour");
        const tourResult = await executeSiteTour();
        return tourResult.guideMarkdown;
      }

      case "play_game":
      case "playgame":
      case "play": {
        return this.primitivePlayGame(rawArgs);
      }

      case "navigate":
      case "goto": {
        const url = String(rawArgs.url || rawArgs.href || selector || "").trim();
        if (!url) return "Error: URL or path required for navigate action.";
        if (!isSafeNavigationUrl(url)) {
          return `Error: Blocked navigation to unsafe scheme in "${url}". Only http:, https:, and relative routes are allowed.`;
        }

        const safety = await SafetyGate.checkAndConfirm({
          actionType: "navigate",
          url,
          targetDescription: `navigate -> ${url}`,
        });
        if (!safety.allowed) {
          return `Action blocked by Safety Gate: ${safety.reason || "Navigation to irreversible destination denied by user."}`;
        }

        if (typeof window !== "undefined") {
          // If hash navigation
          if (url.startsWith("#")) {
            window.location.hash = url;
            return `Navigated to hash anchor "${url}".`;
          }
          const currentHref = window.location.href;
          NavPersistenceManager.saveTask({
            id: `task_${Date.now()}`,
            userGoal: this.currentUserGoal,
            stepIndex: this.currentStepIndex + 1,
            maxSteps: this.maxSteps,
            trajectory: [...this.currentTrajectory],
            conversationHistory: this.currentConversationHistory,
            workingMemory: Object.fromEntries(this.memoryStore.entries()),
            originUrl: currentHref,
            targetUrl: url,
          });
          // Check for matching anchor element on page
          const link = document.querySelector(`a[href='${url}']`) as HTMLAnchorElement;
          if (link) {
            link.click();
            return `Clicked navigation link leading to "${url}".`;
          }
          window.location.href = url;
          return `Navigating browser window to "${url}".`;
        }
        return `Navigated to ${url}.`;
      }

      case "hover": {
        if (!selector) return "Error: selector required for hover action.";
        const el = smartQuerySelector(selector);
        if (!el) return `Hover failed: element "${selector}" not found on page.`;
        highlightElement(el, "Hovered");
        el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        return `Hovered over element "${selector}".`;
      }

      case "download": {
        const rawTarget = rawArgs.target !== undefined ? rawArgs.target : (rawArgs.targetId !== undefined ? rawArgs.targetId : (rawArgs.id !== undefined ? rawArgs.id : selector));
        let el: HTMLElement | null = null;
        if (rawTarget) {
          el = ActionDispatcher.resolveTarget(rawTarget).element;
        }
        if (!el && typeof document !== "undefined") {
          el = smartQuerySelector("a[download], a[href*='.pdf' i], a[href*='resume' i], a[href*='cv' i], [aria-label*='download' i]");
        }
        if (!el) {
          return "Download failed: No matching download element found on this page.";
        }
        highlightElement(el, "Downloaded");
        await ActionDispatcher.click(el);
        if (el instanceof HTMLAnchorElement && el.href) {
          try { el.click(); } catch {}
        }
        const cleanSel = getCleanElementSelector(el);
        const fileName = el.getAttribute("download") || (el as HTMLAnchorElement).href?.split("/").pop() || el.textContent?.trim() || "file";
        return `Successfully triggered download for "${fileName}" (${cleanSel}).`;
      }

      default:
        return `Unknown browse action "${action}". Allowed: inspect, snapshot, explore, map, overview, click, type, scroll, navigate, hover, extract, see, ocr, download, play_game.`;
    }
  }

  /** Primitive: playGame — Real-time continuous game controller */
  private async primitivePlayGame(args: Record<string, unknown> = {}): Promise<string> {
    const durationSec = typeof args.durationSec === "number" ? args.durationSec : 30;
    const targetScore = typeof args.targetScore === "number" ? args.targetScore : 100;

    const { CanvasGameController } = await import("./canvasGameController");
    const result = await CanvasGameController.playGame({
      durationSec,
      targetScore,
      abortSignal: this.activeAbortController?.signal,
      onProgress: (evt) => {
        if (this.onStepProgress) {
          this.onStepProgress(1, "playGame", `Score: ${evt.score} (Combo x${evt.combo}) — ${evt.statusText}`);
        }
      },
    });

    return JSON.stringify({
      finalScore: result.finalScore,
      totalJumps: result.totalJumps,
      maxCombo: result.maxCombo,
      durationSec: result.durationSec,
      summary: result.summary,
    });
  }

  /** Primitive 4: search */
  private async primitiveSearch(args: Record<string, unknown> = {}): Promise<string> {
    const rawArgs = args || {};
    let rawQuery = (rawArgs.query ?? rawArgs.q ?? rawArgs.keyword ?? rawArgs.text ?? "") as string;
    if (!rawQuery && this.currentUserGoal) {
      const quoted = this.currentUserGoal.match(/["']([^"']+)["']/);
      if (quoted) rawQuery = quoted[1];
    }
    const query = String(rawQuery || "").toLowerCase().trim();
    if (!query) return "Error: Search query is empty.";

    // Search visible text across the document body (excluding agent widget)
    const matchingElements: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let currentNode = walker.nextNode() as HTMLElement | null;

    while (currentNode && matchingElements.length < 15) {
      if (
        !isWidgetElement(currentNode) &&
        ["SCRIPT", "STYLE", "NOSCRIPT"].indexOf(currentNode.tagName) === -1 &&
        currentNode.children.length === 0
      ) {
        const text = (currentNode.textContent || "").trim();
        if (text.toLowerCase().includes(query)) {
          // Build an actionable CSS selector the model can use directly
          const selector = getCleanElementSelector(currentNode);
          matchingElements.push(`<${currentNode.tagName.toLowerCase()}> selector="${selector}" text="${text.slice(0, 80)}"`);
        }
      }
      currentNode = walker.nextNode() as HTMLElement | null;
    }

    if (matchingElements.length === 0) {
      return `Search found 0 results for "${rawArgs.query}". The term does not appear anywhere on this page.`;
    }

    const fullDump = matchingElements.join("\n");
    return this.compactObservation(fullDump, `Found ${matchingElements.length} matches for "${rawArgs.query}"`);
  }

  /** Primitive 5: ask */
  private async primitiveAsk(args: Record<string, unknown> = {}): Promise<string> {
    const rawArgs = args || {};
    const question = String(rawArgs.question || rawArgs.prompt || "");
    if (!this.onAskUser) {
      return `Waiting on user confirmation for: "${question}" (User input callback not attached)`;
    }
    const answer = await this.onAskUser(question);
    return `User replied: "${answer}"`;
  }

  /**
   * Observation Compaction (Inngest Utah Soft-Trim Pattern):
   * Preserves Head + Tail tokens with memory offloading so local LLM context does not bloat.
   */
  private compactObservation(rawText: string, label: string): string {
    if (rawText.length < 800) {
      return rawText;
    }
    const memKey = `mem://obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.memoryStore.set(memKey, rawText);
    const head = rawText.slice(0, 250).replace(/\n/g, " ");
    const tail = rawText.slice(-150).replace(/\n/g, " ");
    return `[Compacted ${rawText.length} chars to ${memKey}]. ${label}:\n[Head]: ${head}...\n[Tail]: ...${tail}\n(use read { target: "${memKey}" } if full observation required)`;
  }

  /** Primitive: update_task (Harness-held task list management, TASK-116 & TASK-117) */
  private async primitiveUpdateTask(args: Record<string, unknown> = {}): Promise<string> {
    const rawArgs = args || {};
    const rawTaskId = rawArgs.taskId || rawArgs.id || rawArgs.task;
    if (!rawTaskId) {
      return "Error: taskId (e.g. 1 or task_1) is required to update task status.";
    }
    const rawStatus = rawArgs.status ? String(rawArgs.status).toLowerCase() : null;
    if (!rawStatus) {
      return "Error: status (e.g. in_progress, completed, blocked) is required to update task status.";
    }
    const taskId = String(rawTaskId);
    const status: TodoStatus = (rawStatus === "blocked" || rawStatus === "failed")
      ? "blocked"
      : rawStatus === "in_progress"
      ? "in_progress"
      : "completed";
    const note = rawArgs.note ? String(rawArgs.note) : undefined;
    const ok = this.todoManager.updateTaskStatus(taskId, status, note);
    if (!ok) {
      return `Task "${taskId}" not found in current plan.`;
    }
    return `Updated task ${taskId} status to "${status}".`;
  }

  /** Primitive: wait (Real waits via DOM-settle and network idle, TASK-114) */
  private async primitiveWait(args: Record<string, unknown> = {}): Promise<string> {
    const quietMs = typeof args.quietPeriodMs === "number" ? args.quietPeriodMs : 200;
    const idleMs = typeof args.idlePeriodMs === "number" ? args.idlePeriodMs : 250;
    const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 5000;

    const res = await WaitManager.waitForPageReady({ quietPeriodMs: quietMs, idlePeriodMs: idleMs, timeoutMs });
    if (res.settled) {
      return `Page ready: DOM mutations and network requests settled in ${res.durationMs}ms.`;
    }
    return `Wait timeout reached (${res.durationMs}ms): ${res.reason || "DOM or network did not fully settle"}.`;
  }

  /** Primitive: extract (Structured data extraction from tables/grids to JSON/CSV, TASK-114) */
  private async primitiveExtract(args: Record<string, unknown> = {}): Promise<string> {
    const selector = typeof args.selector === "string" ? args.selector : undefined;
    const format = args.format === "csv" ? "csv" : "json";
    const maxRows = typeof args.maxRows === "number" && args.maxRows > 0 ? args.maxRows : 100;

    const result = DataExtractor.extractTable({ selector, maxRows });
    if (result.rowCount === 0) {
      return `Extract failed: no data table or repeating records found${selector ? ` for selector "${selector}"` : " on active page"}.`;
    }

    const output = format === "csv" ? result.csv : result.json;
    const summary = `Extracted ${result.rowCount} rows (${result.columnCount} columns: ${result.headers.slice(0, 5).join(", ")}${result.headers.length > 5 ? "..." : ""})`;

    return this.compactObservation(output, summary);
  }

  /** Primitive: openTab (Multi-page tab orchestration, TASK-114) */
  private async primitiveOpenTab(args: Record<string, unknown> = {}): Promise<string> {
    const url = String(args.url || "").trim();
    if (!url) return "Error: url is required for openTab.";

    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { target: "background", type: "TAB_OPERATION", action: "openTab", url },
          (resp: any) => resolve(resp || { ok: false, error: chrome.runtime?.lastError?.message })
        );
      });
      if (res.ok) {
        return `Opened new tab (ID: ${res.tab?.id || "unknown"}) with URL: ${url}`;
      }
      return `Failed to open tab via extension: ${res.error || "unknown error"}`;
    }

    if (typeof window !== "undefined") {
      try {
        window.open?.(url, "_blank");
      } catch {}
      return `Opened URL in new browser window/tab: ${url}`;
    }

    return `openTab unavailable in this environment: ${url}`;
  }

  /** Primitive: switchTab (Multi-tab switching by ID or URL pattern, TASK-114) */
  private async primitiveSwitchTab(args: Record<string, unknown> = {}): Promise<string> {
    const tabId = typeof args.tabId === "number" ? args.tabId : undefined;
    const urlPattern = typeof args.urlPattern === "string" ? args.urlPattern : undefined;

    if (!tabId && !urlPattern) {
      return "Error: either tabId or urlPattern is required for switchTab.";
    }

    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { target: "background", type: "TAB_OPERATION", action: "switchTab", tabId, urlPattern },
          (resp: any) => resolve(resp || { ok: false, error: chrome.runtime?.lastError?.message })
        );
      });
      if (res.ok) {
        return `Switched to tab (ID: ${res.tab?.id}, Title: "${res.tab?.title}", URL: ${res.tab?.url})`;
      }
      return `Failed to switch tab: ${res.error || "tab not found"}`;
    }

    return "switchTab requires EdgeOperator Chrome extension privileges.";
  }

  /** Primitive: closeTab (Close a tab, TASK-114) */
  private async primitiveCloseTab(args: Record<string, unknown> = {}): Promise<string> {
    const tabId = typeof args.tabId === "number" ? args.tabId : undefined;

    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { target: "background", type: "TAB_OPERATION", action: "closeTab", tabId },
          (resp: any) => resolve(resp || { ok: false, error: chrome.runtime?.lastError?.message })
        );
      });
      if (res.ok) {
        return `Successfully closed tab${tabId ? ` (ID: ${tabId})` : ""}.`;
      }
      return `Failed to close tab: ${res.error || "unknown error"}`;
    }

    if (typeof window !== "undefined") {
      window.close();
      return "Attempted to close active window.";
    }

    return "closeTab unavailable in this environment.";
  }

  /** Primitive: listTabs (Inspect all open tabs, TASK-114) */
  private async primitiveListTabs(_args: Record<string, unknown> = {}): Promise<string> {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { target: "background", type: "TAB_OPERATION", action: "listTabs" },
          (resp: any) => resolve(resp || { ok: false, error: chrome.runtime?.lastError?.message })
        );
      });
      if (res.ok && Array.isArray(res.tabs)) {
        const lines = res.tabs.map(
          (t: any) => `[${t.id}] ${t.active ? "*ACTIVE* " : ""}"${t.title}" - ${t.url}`
        );
        return `Open tabs (${res.tabs.length}):\n${lines.join("\n")}`;
      }
      return `Failed to list tabs: ${res.error || "unknown error"}`;
    }

    if (typeof window !== "undefined") {
      const loc = window.location?.href || "about:blank";
      const title = typeof document !== "undefined" ? document.title : "Document";
      return `Single active tab: "${title}" - ${loc}`;
    }

    return "No tabs available.";
  }

  /**
   * Dispatch tool call to the corresponding primitive or custom host tool
   */
  async executeTool(toolName: string, rawArgs: Record<string, unknown> = {}, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) {
      return `Action aborted: Tool "${toolName}" cancelled or timed out.`;
    }
    const args = (typeof rawArgs === "object" && rawArgs !== null) ? rawArgs : {};
    const startTime = Date.now();

    // Deterministic Pre-Tool Hook Chain (SafetyGate, permission modes, argument rewrite)
    const preHook = await SafetyGate.runPreHooks(toolName, args);
    if (!preHook.proceed) {
      return `Action blocked by Safety Gate: ${preHook.reason || "Action rejected by pre-tool hook."}`;
    }
    const finalArgs = (preHook.modifiedArgs || args) as Record<string, unknown>;

    if (signal?.aborted) {
      return `Action aborted: Tool "${toolName}" cancelled or timed out.`;
    }

    const result = await this.dispatchToolInternal(toolName, finalArgs, signal);

    // Deterministic Post-Tool Hook Chain (Logging, telemetry, validation)
    const durationMs = Date.now() - startTime;
    await SafetyGate.runPostHooks(toolName, finalArgs, result, durationMs);

    return result;
  }

  private async dispatchToolInternal(toolName: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) {
      return `Action aborted: Tool "${toolName}" cancelled or timed out.`;
    }
    // 1. Check custom host tools first
    if (this.customHostTools[toolName]) {
      // Security & boundary validation for common host tools
      if (toolName === "addToCart") {
        const qty = Number(args.quantity);
        if (isNaN(qty) || qty <= 0) {
          return JSON.stringify({ error: "Invalid quantity: must be a positive integer greater than 0." });
        }
        if (qty > 100) {
          return JSON.stringify({ error: "Quantity limit exceeded: maximum allowed quantity per order is 100." });
        }
        args.quantity = Math.floor(qty);

        // Catalog Grounding / Hallucination Verification:
        // If the user's initial prompt explicitly named a product (e.g. "flying carpet", "Rolex"),
        // verify that the requested item actually exists on this page before adding to cart.
        if (this.currentUserGoal && typeof document !== "undefined") {
          const goalLower = this.currentUserGoal.toLowerCase();
          const catalogElements = smartQuerySelectorAll("h2, h3, .card, [data-product]");
          const catalogTexts = catalogElements.map(el => (el.textContent || "").toLowerCase()).join(" ");

          const matchNonCatalog = goalLower.match(/\b(?:add|buy|get|purchase)\s+(?:\d+\s+)?(.+?)(?:\s+(?:to\s+(?:my\s+)?cart|please|now))?$/i);
          if (matchNonCatalog && matchNonCatalog[1]) {
            const requestedItem = matchNonCatalog[1].trim().toLowerCase();
            const genericWords = ["item", "items", "product", "products", "one", "this", "it", "to", "cart", "a", "an", "the", "my", "please", "now"];
            const itemWords = requestedItem.split(/\s+/).filter((w) => !genericWords.includes(w) && w.length > 2);
            if (itemWords.length > 0) {
              const pageBodyText = typeof document !== "undefined" && document.body ? document.body.innerText.toLowerCase() : "";
              const existsOnPage = itemWords.some((w) => catalogTexts.includes(w) || pageBodyText.includes(w));
              if (!existsOnPage) {
                return JSON.stringify({
                  error: `Catalog verification failed: "${requestedItem}" is not available in the store catalog on this page.`,
                });
              }
            }
          }
        }
      }

      if (toolName === "navigateTo") {
        const path = String(args.path || "").trim();
        if (!path || /^(javascript:|data:|vbscript:)/i.test(path) || path.includes("<script") || path.length > 80) {
          return JSON.stringify({ error: "Invalid destination path: must be a safe relative route." });
        }
      }

      try {
        const res = await this.customHostTools[toolName](args);
        return typeof res === "object" ? JSON.stringify(res) : String(res);
      } catch (err: any) {
        return `Custom tool ${toolName} error: ${err.message}`;
      }
    }

    // 2. Dispatch to Canonical Primitives and Direct Browser Tools
    switch (toolName) {
      case "read":
        return this.primitiveRead(args);
      case "write":
      case "edit":
      case "note":
        return this.primitiveWrite(args);
      case "sandbox":
      case "bash":
      case "eval":
      case "exec":
      case "run":
        return this.primitiveSandbox(args);
      case "browse":
        return this.primitiveBrowse(args);
      case "search":
      case "find":
        return this.primitiveSearch(args);
      case "ask":
        return this.primitiveAsk(args);
      case "update_task":
      case "update_todo":
      case "task":
        return this.primitiveUpdateTask(args);
      case "wait":
      case "sleep":
      case "pause":
        return this.primitiveWait(args);
      case "extract":
      case "extractData":
      case "extract_data":
      case "scrape":
        return this.primitiveExtract(args);
      case "openTab":
      case "open_tab":
        return this.primitiveOpenTab(args);
      case "switchTab":
      case "switch_tab":
        return this.primitiveSwitchTab(args);
      case "closeTab":
      case "close_tab":
        return this.primitiveCloseTab(args);
      case "listTabs":
      case "list_tabs":
        return this.primitiveListTabs(args);

      // First-Class Direct Browser Primitives
      case "playGame":
      case "play_game":
      case "play":
      case "autopilot":
        return this.primitivePlayGame(args);
      case "click":
        return this.primitiveBrowse({ action: "click", ...args });
      case "download":
        return this.primitiveBrowse({ action: "download", ...args });
      case "type":
      case "fill":
      case "input":
        return this.primitiveBrowse({ action: "type", ...args });
      case "select":
        return this.primitiveBrowse({ action: "select", ...args });
      case "scroll":
        return this.primitiveBrowse({ action: "scroll", ...args });
      case "som":
      case "badge":
      case "badges":
        return this.primitiveBrowse({ action: "som", ...args });
      case "navigate":
      case "goto":
      case "open":
        return this.primitiveBrowse({ action: "navigate", ...args });
      case "inspect":
        return this.primitiveBrowse({ action: "inspect", ...args });
      case "snapshot":
        return this.primitiveBrowse({ action: "snapshot", ...args });
      case "hover":
        return this.primitiveBrowse({ action: "hover", ...args });
      case "see":
      case "look":
      case "visual":
      case "ocr":
        return this.primitiveBrowse({ action: "see", ...args });
      case "overview":
      case "map":
      case "sitemap":
      case "explore":
        return this.primitiveBrowse({ action: "overview", ...args });
      case "tour":
      case "guide":
        return this.primitiveBrowse({ action: "tour", ...args });
      case "teleport":
      case "jump": {
        const { teleportToEngram, buildEngramMap } = await import("./engramNavigator");
        const map = buildEngramMap();
        const sel = String(args.selector || "");
        const target = map.nodes.find(
          (n) => n.selector === sel || n.title.toLowerCase().includes(sel.toLowerCase())
        );
        if (target) {
          teleportToEngram(target);
          return `Teleported to "${target.title}" (${target.selector}).`;
        }
        return `Teleport target "${sel}" not found in engram map.`;
      }
      default:
        return `Unknown tool "${toolName}". Available primitives: click, type, scroll, navigate, inspect, browse, search, read, write, sandbox, ask.`;
    }
  }

  /**
   * Build the compact system prompt instructing the model to emit JSON tool calls
   */
  async getHarnessPrompt(userGoal?: string): Promise<string> {
    let prompt = await buildHarnessPrompt(this.customToolDefs, userGoal);
    const planLine = this.todoManager.formatPromptLine();
    if (planLine) {
      prompt += `\n${planLine}\nUpdate task status: {"tool": "update_task", "args": {"taskId": "<id>", "status": "completed"}}`;
    }
    return prompt;
  }

  /**
   * Robust JSON extractor: parses tool decisions even when wrapped in markdown or Chain-of-Thought prose
   */
  parseHarnessDecision(raw: string, userGoal?: string): HarnessToolCall {
    return parseHarnessDecision(raw, userGoal || this.currentUserGoal);
  }

  /**
   * Check if a tool observation indicates failure
   */
  public static isFailureObservation(obs: string): boolean {
    return isFailureObservation(obs);
  }

  private isFailureObservation(obs: string): boolean {
    return isFailureObservation(obs);
  }

  /**
   * Synthesize clean, human-verifiable milestones for harness execution and UI tracking.
   */
  public synthesizeMilestones(goal: string): Array<{ title: string; id?: string }> {
    const clean = (goal || "").trim();
    const clauses = clean.split(/\s+(?:then|and then|after that)\s+/i);
    if (clauses.length >= 2) {
      return [
        { title: `Locate elements for: ${clauses[0].slice(0, 42)}`, id: "task_1" },
        ...clauses.slice(1).map((c, i) => ({
          title: `Execute: ${c.slice(0, 45)}`,
          id: `task_${i + 2}`,
        })),
        { title: "Verify state delta and compile summary", id: `task_${clauses.length + 1}` },
      ];
    }

    return [
      { title: `Auditing layout & targeting elements for: ${clean.slice(0, 36)}`, id: "task_1" },
      { title: `Executing browser interactions`, id: "task_2" },
      { title: `Verifying state transition and finalizing result`, id: "task_3" },
    ];
  }

  /**
   * Run the harness loop wrapping the given text-generation model function.
   * "The model stays a text function. The harness is the loop, the tools, the memory, and the permission check."
   */
  async runLoop(
    userGoal: string,
    modelPredictor: (messages: Array<{ role: string; content: string }>) => Promise<string>,
    activeTier: ModelTier = ModelTier.TIER_0_GEMINI_NANO,
    conversationHistory: Array<{ role: string; content: string }> = [],
    resumeSnapshot?: InFlightTaskState
  ): Promise<HarnessExecutionResult> {
    this.currentUserGoal = userGoal;
    // DeepSeek Rule: Sanitize historical dialogue across user turns
    const sanitizedHistory = ReasoningManager.sanitizeConversationHistory(conversationHistory);
    this.currentConversationHistory = sanitizedHistory;
    const startTime = performance.now();
    const siteOrigin = typeof window !== "undefined" ? window.location.origin : "web";

    // Inngest Singleton Concurrency pattern: cancel any in-flight execution
    this.cancelActiveRun();
    this.activeAbortController = new AbortController();
    const abortSignal = this.activeAbortController.signal;

    // Plan Management: Auto-synthesize plan milestones if none exists or previous completed
    let activePlan = this.todoManager.getPlan();
    if (!activePlan || activePlan.status === "completed" || activePlan.status === "failed") {
      const milestones = this.synthesizeMilestones(userGoal);
      activePlan = this.todoManager.createPlan(userGoal, milestones, true /* autoApprove */);
    }

    // Plan Approval Gate (TASK-116): User approves multi-task plan before acting
    if (activePlan && !activePlan.approved && activePlan.tasks.length > 1 && this.onPlanApprovalRequired) {
      const approved = await this.onPlanApprovalRequired(activePlan);
      if (!approved) {
        this.todoManager.rejectPlan("User cancelled plan execution.");
        return {
          final: "Execution paused: plan awaiting user approval.",
          trajectory: [],
          isMacro: false,
          totalDurationMs: Math.round(performance.now() - startTime),
        };
      }
      this.todoManager.approvePlan();
    }

    // 1. Check if a deterministic macro/recipe matches this intent (action goals only)
    if (isActionGoal(userGoal)) {
      const matchingMacro = await recipeStore.findMatchingMacro(siteOrigin, userGoal);
      if (matchingMacro) {
        console.log(`[Harness] Found compiled site macro for "${userGoal}". Executing deterministically!`);
        const trajectory: AgentStepTrace[] = [];
        let macroFailed = false;

        for (let i = 0; i < matchingMacro.actions.length; i++) {
          const action = matchingMacro.actions[i];
          const stepStart = performance.now();
          const obs = await this.executeTool(action.tool, action.args);
          const duration = Math.round(performance.now() - stepStart);

          if (this.isFailureObservation(obs)) {
            console.warn(`[Harness] Macro step ${i + 1} failed: "${obs}". Purging broken macro.`);
            macroFailed = true;
            try { await recipeStore.deleteMacro(matchingMacro.id); } catch {}
            break;
          }

          trajectory.push({
            step: i + 1,
            tool: action.tool,
            args: action.args,
            observationSummary: obs.slice(0, 150),
            durationMs: duration,
          });
          if (this.onStepProgress) {
            this.onStepProgress(i + 1, action.tool, obs);
          }
        }

        if (!macroFailed && trajectory.length > 0) {
          matchingMacro.executionCount++;
          matchingMacro.lastSuccessAt = Date.now();
          await recipeStore.saveMacroRecipe(matchingMacro);

          const finalMsg = `Executed verified site recipe for "${userGoal}" (${matchingMacro.actions.length} steps).`;
          const macroDecision: DecisionTrace = {
            type: "macro",
            title: "Host Recipe Verified (Deterministic)",
            selectedOption: `Execute "${matchingMacro.triggerPhrase}"`,
            confidence: 1.0,
            margin: 1.0,
            primitive: "choice",
            latencyMs: Math.round(performance.now() - startTime),
            engineUsed: "Host Recipe Store (0 Tokens)",
            distribution: [
              { label: `Recipe: "${matchingMacro.triggerPhrase}"`, score: 1.0, isWinner: true },
            ],
            hallucinationShield: {
              verified: true,
              check: `Deterministic ${matchingMacro.actions.length}-step macro executed without neural sampling`,
              probability: 1.0,
            },
            explanation: `Executed cached zero-token verified recipe for "${matchingMacro.triggerPhrase}". Deterministic execution on live DOM.`,
          };
          this.todoManager.updateTaskStatus("task_1", "completed");
          this.todoManager.updateTaskStatus("task_2", "completed");
          this.todoManager.updateTaskStatus("task_3", "completed");
          return {
            final: finalMsg,
            trajectory,
            isMacro: true,
            totalDurationMs: Math.round(performance.now() - startTime),
            decision: macroDecision,
            plan: this.todoManager.getPlan(),
          };
        }
        // If macro failed or was empty, fall through into the dynamic harness loop!
      }
    }

    // 2. Model Harness Loop (Provider Adapter Pattern: Persistent State Notebook)
    const workingMemory: {
      siteOrigin: string;
      currentScrollY: number;
      discoveredSelectors: string[];
      notes: string[];
    } = {
      siteOrigin,
      currentScrollY: typeof window !== "undefined" ? Math.round(window.scrollY) : 0,
      discoveredSelectors: [],
      notes: [],
    };

    // Grounding: extract visible interactive candidate elements using A11yTreeEngine [1..N]
    let initialCandidatesNotice = "";
    if (typeof document !== "undefined") {
      const a11yNodes = A11yTreeEngine.scan({ viewportOnly: true, maxItems: 24 });
      if (a11yNodes.length > 0) {
        initialCandidatesNotice = `\nInteractive Elements on Screen (Reference by numeric [ID] or selector):\n${SafetyGate.wrapUntrustedPageContent(A11yTreeEngine.formatForPrompt(a11yNodes))}`;
      }
    }

    const systemPrompt = await this.getHarnessPrompt(userGoal);
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // OpenHarness Pattern: Auto-Compacted Context Window Management
    // Bounds conversation tokens for lightweight on-device models while preserving prior user goals
    if (sanitizedHistory.length > 0) {
      const validTurns = sanitizedHistory.filter(
        (m) => (m.role === "user" || m.role === "assistant") && m.content
      );

      // Extract up to 5 prior completed goals (MAX_TRACKED_USER_GOALS = 5)
      const userGoals = validTurns
        .filter((m) => m.role === "user")
        .map((m) => m.content.slice(0, 80))
        .slice(-5);

      // Keep last 4 turns verbatim for prompt resolution
      const recentTurns = validTurns.slice(-4);
      if (recentTurns.length > 0) {
        const dialogSummary = recentTurns
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 250)}`)
          .join("\n");

        let contextBlock = `Prior Dialogue Context:\n${dialogSummary}`;
        if (userGoals.length > 1) {
          contextBlock = `Prior User Goals: [${userGoals.join(" -> ")}]\n${contextBlock}`;
        }

        messages.push({
          role: "system",
          content: contextBlock,
        });
      }
    }

    const startStep = resumeSnapshot ? Math.min(resumeSnapshot.stepIndex, this.maxSteps - 1) : 0;
    if (resumeSnapshot) {
      messages.push({
        role: "user",
        content: `Task Goal: "${userGoal}" (RESUMED from step ${startStep + 1} after navigation to ${siteOrigin}${typeof window !== "undefined" ? window.location.pathname : ""})\nPrior actions completed: ${resumeSnapshot.trajectory.map(t => `${t.tool}`).join(" -> ")}\nContinue fulfilling the goal from the current page state.\nInitial State: scrollY=${workingMemory.currentScrollY}${initialCandidatesNotice}`,
      });
      if (resumeSnapshot.workingMemory) {
        Object.assign(workingMemory, resumeSnapshot.workingMemory);
      }
    } else {
      messages.push({
        role: "user",
        content: `Task Goal: "${userGoal}"\nInitial State: scrollY=${workingMemory.currentScrollY}, origin=${siteOrigin}${initialCandidatesNotice}`,
      });
    }

    const trajectory: AgentStepTrace[] = resumeSnapshot
      ? resumeSnapshot.trajectory.map((t) => ({ ...t, args: t.args || {} }))
      : [];
    this.currentTrajectory = trajectory;
    let lastToolCallSignature = "";
    let consecutiveFailures = 0;
    const failedCallSignatures = new Set<string>();
    let lastScrollY = workingMemory.currentScrollY;

    let consecutiveIdenticalCalls = 0;
    let consecutiveZeroDeltaCalls = 0;
    let lastThinking = "";

    for (let step = startStep; step < this.maxSteps; step++) {
      this.currentStepIndex = step;
      if (abortSignal.aborted) {
        return {
          final: `Execution was cancelled for new user action.`,
          trajectory,
          isMacro: false,
          totalDurationMs: Math.round(performance.now() - startTime),
        };
      }

      const stepStart = performance.now();

      // Probabilistic Search & Ensembling:
      // Rather than fragile greedy single-shot decoding, run Pass@K / Best-of-N with deterministic verifiers
      const bestCandidate = await ProbabilisticHarnessEngine.sampleBestOfN(
        () => modelPredictor(messages),
        userGoal,
        2, // k=2 candidates (adaptive scaling: 1st sample short-circuits if verifier score >= 0.95)
        this.customToolDefs
      );

      const decision = bestCandidate.decision;

      // Check if finished
      if (decision.final) {
        let cleanFinal = decision.final;
        if (cleanFinal.includes("[selector:") || cleanFinal.startsWith("[selector:")) {
          const visionStep = trajectory.find((t) => t.observationSummary?.includes("[Visual Observation"));
          if (visionStep) {
            cleanFinal = visionStep.observationSummary.replace(/^\[Visual Observation \([^)]+\)\]:\s*/, "");
          } else {
            const scene = VisionService.extractVisualScene();
            cleanFinal = `Viewing "${scene.title}"${scene.headings[0] ? ` (${scene.headings[0]})` : ""}${scene.items.length > 0 ? `, featuring items such as ${scene.items.slice(0, 2).join(' and ')}` : ""}.`;
          }
        } else if (
          cleanFinal.startsWith("[1]") ||
          cleanFinal.includes('button "Toggle Theme"') ||
          cleanFinal.includes("Interactive a11y tree")
        ) {
          const scene = VisionService.extractVisualScene();
          cleanFinal = `I inspected the current page elements for "${scene.title}". If you would like me to navigate, click a control, or find information, please let me know!`;
        }

        // Strands Pattern: Automatic Macro Compilation
        // When a multi-step trajectory successfully achieves a user action without failures,
        // automatically compile and save it into recipeStore as a zero-latency deterministic site macro.
        const hasUnstableSelector = trajectory.some((t) => {
          const args = t.args as any;
          const sel = String(args?.selector || args?.target || "");
          return /^\s*\[?\d+\]?\s*$/.test(sel) || /^\d+$/.test(String(args?.targetId ?? ""));
        });

        if (
          !hasUnstableSelector &&
          isActionGoal(userGoal) &&
          trajectory.length >= 2 &&
          consecutiveFailures === 0 &&
          !cleanFinal.toLowerCase().includes("could not find") &&
          !cleanFinal.toLowerCase().includes("unable") &&
          trajectory.some((t) =>
            ["click", "type", "scroll", "navigate", "tour"].includes(t.tool) ||
            (t.tool === "browse" && ["click", "type", "scroll", "navigate", "tour"].includes((t.args as any)?.action))
          )
        ) {
          try {
            await recipeStore.saveMacroRecipe({
              id: `macro_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              siteOrigin,
              triggerPhrase: userGoal.toLowerCase().trim(),
              actions: trajectory.map((t) => ({ tool: t.tool, args: t.args })),
              executionCount: 1,
              lastSuccessAt: Date.now(),
            });
          } catch {
            // Non-fatal macro save
          }
        }

        // Auto-log trace into Expert Judge
        const trace: EvalTrace = {
          id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          siteOrigin,
          userGoal,
          trajectory,
          finalOutput: cleanFinal,
          activeTier,
        };
        await expertJudge.logTrace(trace);

        const duration = Math.round(performance.now() - startTime);

        let executionDecision: DecisionTrace | undefined;
        if (trajectory.length > 0) {
          const successfulSteps = trajectory.filter((s) => !isFailureObservation(s.observationSummary || ""));
          const successRatio = successfulSteps.length / trajectory.length;
          executionDecision = {
            type: "system1_gate",
            title: `Agent Execution (${trajectory.length} steps)`,
            selectedOption: `Completed trajectory (${trajectory.length} steps, ${duration}ms)`,
            confidence: Number(successRatio.toFixed(2)),
            margin: Number(Math.max(0, successRatio - 0.5).toFixed(2)),
            primitive: "choice",
            latencyMs: duration,
            engineUsed: "Agent Harness ReAct Loop",
            distribution: [
              { label: `Observed Action Trajectory (${successfulSteps.length}/${trajectory.length} steps succeeded)`, score: Number(successRatio.toFixed(2)), isWinner: true },
            ],
            hallucinationShield: {
              verified: successRatio > 0.6,
              check: `Empirical DOM state delta verification (${trajectory.length} steps executed on live DOM)`,
              probability: Number(successRatio.toFixed(2)),
            },
            explanation: `Executed ${trajectory.length} steps on DOM. Empirical success rate: ${Math.round(successRatio * 100)}%.`,
          };
        }

        this.todoManager.updateTaskStatus("task_2", "completed");
        this.todoManager.updateTaskStatus("task_3", "completed");

        SomOverlayManager.clearBadges();
        NavPersistenceManager.clearTask();
        return {
          final: cleanFinal,
          trajectory,
          isMacro: false,
          totalDurationMs: duration,
          decision: executionDecision,
          plan: this.todoManager.getPlan(),
          thinking: lastThinking,
        };
      }

      // Check if this exact call signature is repeated consecutively
      const currentCallSignature = `${decision.tool}:${JSON.stringify(decision.args)}`;
      const isIdenticalCall = currentCallSignature === lastToolCallSignature;
      lastToolCallSignature = currentCallSignature;
      if (isIdenticalCall) {
        consecutiveIdenticalCalls++;
        if (consecutiveIdenticalCalls >= 3) {
          failedCallSignatures.add(currentCallSignature);
        }
      } else {
        consecutiveIdenticalCalls = 0;
      }

      // Fix 3: Skip previously-failed identical calls — don't retry what already broke
      if (failedCallSignatures.has(currentCallSignature)) {
        const skipMsg = `Skipped: This exact call already failed earlier. Try a different approach or emit { "final": "..." }.`;
        messages.push({
          role: "assistant",
          content: JSON.stringify({ tool: decision.tool, args: decision.args }),
        });
        messages.push({
          role: "user",
          content: `${skipMsg}\n\nTask Goal was: "${userGoal}". If you cannot accomplish this, respond with {"final": "I could not find or complete '<specific item>' on this page."}.`,
        });
        consecutiveFailures++;

        // Check failure accumulator threshold even for skipped calls
        if (consecutiveFailures >= 3) {
          const failMsg = `I was unable to complete "${userGoal}" — multiple approaches failed. The requested item may not exist on this page.`;
          const trace: EvalTrace = {
            id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            siteOrigin,
            userGoal,
            trajectory,
            finalOutput: failMsg,
            activeTier,
          };
          await expertJudge.logTrace(trace);
          return {
            final: failMsg,
            trajectory,
            isMacro: false,
            totalDurationMs: Math.round(performance.now() - startTime),
          };
        }
        continue;
      }

      // Host runs the tool with pre/post environment state delta capture (bounded by OpenHarness 8s watchdog)
      const beforeState = StateDeltaVerifier.captureSnapshot();
      let observation: string;
      const stepAbortController = new AbortController();
      let stepTimeout: any;

      if (abortSignal) {
        if (abortSignal.aborted) {
          throw new Error("Execution aborted by user");
        }
        abortSignal.addEventListener("abort", () => stepAbortController.abort(), { once: true });
      }

      try {
        observation = await Promise.race([
          this.executeTool(decision.tool, decision.args, stepAbortController.signal),
          new Promise<string>((_, reject) => {
            stepTimeout = setTimeout(() => {
              stepAbortController.abort();
              reject(new Error(`Tool ${decision.tool} timed out after 8000ms`));
            }, 8000);
          }),
        ]);
      } catch (err: any) {
        stepAbortController.abort();
        observation = `Error executing tool "${decision.tool}": ${err?.message || "Execution timeout"}`;
      } finally {
        if (stepTimeout) clearTimeout(stepTimeout);
      }

      // OpenHarness & Claude Code Pattern: Per-Turn Tool-Output Truncation Budget (TASK-116 & TASK-117)
      // Large observations (>1200 chars) are stored in memory and summarized with a mem:// reference.
      // Explicit read(mem://...) requests are preserved in full without infinite re-truncation.
      const isReadingStoredMemory = decision.tool === "read" && String(decision.args?.target || "").startsWith("mem://");
      const MAX_OBSERVATION_CHARS = 1200;
      if (!isReadingStoredMemory && observation && observation.length > MAX_OBSERVATION_CHARS) {
        const memKey = `mem://obs_step${step + 1}_${Date.now().toString(36)}`;
        this.memoryStore.set(memKey, observation);
        const previewLimit = 400;
        observation = `${observation.slice(0, previewLimit)}\n... [Truncated ${observation.length - previewLimit} chars. Full observation (${observation.length} chars) stored in memory at "${memKey}". Call read(target="${memKey}") to inspect.]`;
      }
      const afterState = StateDeltaVerifier.captureSnapshot();
      const stateDelta = StateDeltaVerifier.computeDelta(beforeState, afterState);
      const stepDuration = Math.round(performance.now() - stepStart);

      // Dynamic Re-grounding per step: Refresh accessible elements map if DOM mutated
      if (typeof document !== "undefined" && stateDelta.hasStateChanged) {
        const freshNodes = A11yTreeEngine.scan({ viewportOnly: true, maxItems: 36 });
        if (freshNodes.length > 0) {
          const freshTreeDump = A11yTreeEngine.formatForPrompt(freshNodes);
          observation += `\n\n[Updated Page Interactive Elements after state transition]:\n${SafetyGate.wrapUntrustedPageContent(freshTreeDump)}`;
        }
      }

      // Cycle detector: Prevent model from calling identical tool and args consecutively IF it produces zero state change
      if (isIdenticalCall && !stateDelta.hasStateChanged) {
        consecutiveZeroDeltaCalls++;
        if (consecutiveZeroDeltaCalls >= 2) {
          const failMsg = `Execution stopped: Action "${decision.tool}" produced zero state change across ${consecutiveZeroDeltaCalls} consecutive attempts. The target element or state transition is unavailable on this page.`;
          const duration = Math.round(performance.now() - startTime);
          const trace: EvalTrace = {
            id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            siteOrigin,
            userGoal,
            trajectory,
            finalOutput: failMsg,
            activeTier,
          };
          await expertJudge.logTrace(trace);

          const activeTask = this.todoManager.getActiveTask();
          if (activeTask) {
            this.todoManager.updateTaskStatus(activeTask.id, "blocked", failMsg);
          }

          return {
            final: failMsg,
            trajectory,
            isMacro: false,
            totalDurationMs: duration,
            plan: this.todoManager.getPlan(),
            thinking: lastThinking,
          };
        }
      } else {
        consecutiveZeroDeltaCalls = 0;
      }

      // DevTools Console API Telemetry: Structured group & table logging
      if (typeof console !== "undefined" && typeof console.groupCollapsed === "function") {
        try {
          console.groupCollapsed(`🤖 [Agent Harness] Step ${step + 1}: ${decision.tool}`);
          if (decision.args && typeof decision.args === "object" && Object.keys(decision.args).length > 0 && typeof console.table === "function") {
            console.table(decision.args);
          }
          console.log("Observation:", observation);
          console.log(`Latency: ${stepDuration}ms | Consecutive Failures: ${consecutiveFailures}`);
          console.groupEnd();
        } catch {
          // Non-fatal telemetry catch
        }
      }

      trajectory.push({
        step: step + 1,
        tool: decision.tool,
        args: decision.args,
        observationSummary: observation.slice(0, 150),
        durationMs: stepDuration,
      });

      if (this.onStepProgress) {
        const activeMilestone = this.todoManager.getActiveTask()?.title;
        this.onStepProgress(step + 1, decision.tool, observation, {
          durationMs: stepDuration,
          args: decision.args,
          thinking: lastThinking,
          planMilestone: activeMilestone,
        });
      }

      // Fix 2: Track consecutive failures
      if (this.isFailureObservation(observation)) {
        consecutiveFailures++;
        failedCallSignatures.add(currentCallSignature);

        if (consecutiveFailures >= 3) {
          const failMsg = `I was unable to complete "${userGoal}" after ${consecutiveFailures} consecutive failed attempts. The requested item or action may not be available on this page.`;

          const trace: EvalTrace = {
            id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            siteOrigin,
            userGoal,
            trajectory,
            finalOutput: failMsg,
            activeTier,
          };
          await expertJudge.logTrace(trace);

          const activeTask = this.todoManager.getActiveTask();
          if (activeTask) {
            this.todoManager.updateTaskStatus(activeTask.id, "blocked", failMsg);
          }

          return {
            final: failMsg,
            trajectory,
            isMacro: false,
            totalDurationMs: Math.round(performance.now() - startTime),
            plan: this.todoManager.getPlan(),
            thinking: lastThinking,
          };
        }
      } else {
        // Reset consecutive failure counter on success
        consecutiveFailures = 0;
      }

      // NVIDIA AVO Pattern: Zero-Delta Supervisor Interception
      // Checks if an action produced zero effect on the page and immediately redirects the agent.
      let supervisorAdvice = "";
      const currentScrollY = typeof window !== "undefined" ? Math.round(window.scrollY) : 0;
      workingMemory.currentScrollY = currentScrollY;

      // Extract newly discovered actionable selectors into working memory
      const matches = observation.matchAll(/selector="([^"]+)"/g);
      for (const m of matches) {
        if (!workingMemory.discoveredSelectors.includes(m[1])) {
          workingMemory.discoveredSelectors.push(m[1]);
        }
      }

      if (decision.tool === "browse" && decision.args.action === "scroll" && Math.abs(currentScrollY - lastScrollY) < 10) {
        supervisorAdvice = `\n🔍 [Supervisor Notice]: Window did not scroll (already at bound). Try targeting a specific element selector or use search.`;
      }
      lastScrollY = currentScrollY;

      // DeepSeek Rule: Intra-turn tool loop preserves intermediate thinking for reasoning continuity
      const { thinking } = ReasoningManager.extractThinking(bestCandidate.raw);
      if (thinking) {
        lastThinking = thinking;
      }
      const loopAssistantMsg = ReasoningManager.formatLoopAssistantMessage(
        { tool: decision.tool, args: decision.args },
        thinking
      );

      // Append observation for next iteration with enriched context
      messages.push({
        role: "assistant",
        content: loopAssistantMsg.content,
      });

      const failureWarning = consecutiveFailures > 0
        ? `\n⚠️ Warning: ${consecutiveFailures} consecutive tool calls have failed. If the target "${userGoal}" cannot be found, respond with {"final": "I could not find '<item>' on this page."} instead of trying unrelated approaches.`
        : "";

      // Inngest Utah Pattern: Step Budget Warning
      const remainingSteps = this.maxSteps - (step + 1);
      const budgetWarning = (remainingSteps <= 2 && remainingSteps > 0)
        ? `\n⏳ Step Budget Warning: Only ${remainingSteps} step(s) remaining in execution budget. Synthesize gathered observations and emit {"final": "<summary>"} now.`
        : "";

      const stateNotebookSummary = workingMemory.discoveredSelectors.length > 0
        ? `\n[Working Notebook State]: Discovered ${workingMemory.discoveredSelectors.length} elements: ${workingMemory.discoveredSelectors.slice(-4).join(', ')}. ScrollY: ${currentScrollY}.`
        : "";

      messages.push({
        role: "user",
        content: `Tool Result (${decision.tool}): ${observation}${failureWarning}${budgetWarning}${supervisorAdvice}${stateNotebookSummary}\n\nTask Goal was: "${userGoal}". If the goal has been fulfilled, respond with {"final": "<user summary>"}. Otherwise emit next tool call.`,
      });

      // Context Engineering & Backpressure (HumanLayer & Manus pattern from awesome-harness-engineering):
      // Keep working memory bounded: preserve system prompt + initial user goal, but compact intermediate turns
      // when conversation depth exceeds 10 messages (>4 steps) to avoid token bloat and context drift.
      if (messages.length > 12) {
        const sys = messages[0];
        // Claude audit fix: find the actual task goal message, don't blindly assume messages[1]
        const goal = messages.find(
          (m) => m.role === "user" && typeof m.content === "string" && m.content.startsWith("Task Goal:")
        ) || messages[1] || {
          role: "user" as const,
          content: `Task Goal: "${userGoal}"`,
        };
        const recent = messages.slice(-6); // Keep last 3 full tool interaction turns
        const compactedSummary = {
          role: "user" as const,
          content: `[Context Handoff]: Previous ${trajectory.length - 3} steps executed: ${trajectory.slice(0, -3).map(t => `${t.tool}(${t.observationSummary.slice(0, 40)})`).join(' -> ')}. Current focus: continue fulfilling "${userGoal}".`
        };
        messages.splice(0, messages.length, sys, goal, compactedSummary, ...recent);
      }
    }

    const maxStepMsg = `Agent reached maximum step limit (${this.maxSteps}) without final resolution for "${userGoal}".`;

    const trace: EvalTrace = {
      id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      siteOrigin,
      userGoal,
      trajectory,
      finalOutput: maxStepMsg,
      activeTier,
    };
    await expertJudge.logTrace(trace);

    const activeTask = this.todoManager.getActiveTask();
    if (activeTask) {
      this.todoManager.updateTaskStatus(activeTask.id, "blocked", "Max steps reached without resolution");
    }

    SomOverlayManager.clearBadges();
    NavPersistenceManager.clearTask();
    return {
      final: maxStepMsg,
      trajectory,
      isMacro: false,
      totalDurationMs: Math.round(performance.now() - startTime),
      plan: this.todoManager.getPlan(),
      thinking: lastThinking,
    };
  }
}

// DevTools Console Utilities Companion
// Allows developers to inspect and query agent state directly from Chrome DevTools Console
if (typeof window !== "undefined") {
  (window as any).__G4_AGENT__ = {
    version: "0.1.0",
    getTraces: () => expertJudge.getAllTraces(),
    getMetrics: () => expertJudge.computeMetrics(),
    getLastTrace: async () => {
      const traces = await expertJudge.getAllTraces();
      return traces[traces.length - 1] || null;
    },
    inspectSpotlight: () => {
      const el = document.getElementById("g4-agent-spotlight");
      if (el && typeof (window as any).inspect === "function") {
        (window as any).inspect(el);
      }
      return el;
    },
  };
}

