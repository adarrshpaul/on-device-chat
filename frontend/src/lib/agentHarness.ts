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

import { recipeStore } from "./recipeStore";
import { expertJudge, AgentStepTrace, EvalTrace } from "./expertJudge";
import { ModelTier, ToolDefinition } from "./types";
import { smartQuerySelector, smartQuerySelectorAll, getCleanElementSelector, isWidgetElement } from "./domUtils";
import { VisionService } from "./visionService";
import { buildHarnessPrompt } from "./harnessPrompt";
import { parseHarnessDecision, HarnessToolCall } from "./harnessDecisionParser";

export type { HarnessToolCall };

export interface HarnessExecutionResult {
  final: string;
  trajectory: AgentStepTrace[];
  isMacro: boolean;
  totalDurationMs: number;
}

export interface HarnessConfig {
  maxSteps?: number;
  onAskUser?: (question: string) => Promise<string>;
  onStepProgress?: (step: number, tool: string, observation: string) => void;
  customHostTools?: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  customToolDefs?: ToolDefinition[];
}

export class AgentHarness {
  private maxSteps: number;
  private onAskUser?: (question: string) => Promise<string>;
  private onStepProgress?: (step: number, tool: string, observation: string) => void;
  private customHostTools: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  private customToolDefs: ToolDefinition[];
  private memoryStore: Map<string, string> = new Map();
  private currentUserGoal: string = "";

  constructor(config: HarnessConfig = {}) {
    this.maxSteps = config.maxSteps || 10;
    this.onAskUser = config.onAskUser;
    this.onStepProgress = config.onStepProgress;
    this.customHostTools = config.customHostTools || {};
    this.customToolDefs = config.customToolDefs || [];
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
    if (!code) return "Error: No code provided to sandbox.";

    // Guard against dangerous JavaScript sandbox escapes (Giskard Prompt Injection & Security)
    const forbiddenPatterns = [
      /\b(window|document|globalThis|self|top|parent)\b/i,
      /\b(fetch|XMLHttpRequest|WebSocket|Worker)\b/i,
      /\b(localStorage|sessionStorage|indexedDB|cookieStore)\b/i,
      /\b(constructor|__proto__|prototype)\b/i,
      /\b(Function|eval|import|process)\b/i,
      /\.cookie\b/i,
      /\.location\b/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(code)) {
        return `SecurityError: Sandbox execution blocked. Prohibited property or global identifier '${pattern.source}'. The sandbox is strictly isolated.`;
      }
    }

    try {
      // Evaluate in a strictly scoped Function with shadowed globals and null context
      const sandboxFn = new Function(
        "context",
        `"use strict";
        const window = undefined, document = undefined, fetch = undefined, localStorage = undefined, sessionStorage = undefined, globalThis = undefined, self = undefined;
        try {
          return (function() {
            return (${code});
          }).call(null);
        } catch(e) {
          return "Sandbox runtime error: " + e.message;
        }`
      );
      const res = sandboxFn(rawArgs.context || {});
      const strRes = typeof res === "object" ? JSON.stringify(res) : String(res);
      return strRes.slice(0, 1000);
    } catch (err: any) {
      return `Sandbox syntax error: ${err.message}`;
    }
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

      case "snapshot": {
        // Build a lightweight accessibility/element tree of host elements (excluding agent widget)
        const interactive = smartQuerySelectorAll(
          "button, a, input, select, textarea, [role='button'], h1, h2, h3"
        ).slice(0, 30);

        const summary = interactive.map((el) => {
          const tag = el.tagName.toLowerCase();
          const cleanSel = getCleanElementSelector(el);
          const text = (el.textContent || (el as HTMLInputElement).placeholder || (el as HTMLInputElement).value || "").trim().slice(0, 40);
          return `[selector: "${cleanSel}"] <${tag}> "${text}"`;
        });

        const fullDump = summary.join("\n");
        return this.compactObservation(fullDump, `Interactive elements on host page (${summary.length} items found)`);
      }

      case "click": {
        if (!selector) return "Error: selector required for click action.";
        const el = smartQuerySelector(selector);
        if (!el) return `Click failed: element "${selector}" not found on page.`;
        highlightElement(el, "Clicked");
        el.click();
        return `Successfully clicked element "${selector}".`;
      }

      case "type": {
        if (!selector) return "Error: selector required for type action.";
        const el = smartQuerySelector(selector) as HTMLInputElement;
        if (!el) return `Type failed: input "${selector}" not found on page.`;
        highlightElement(el, "Typing");
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return `Successfully typed "${value}" into "${selector}".`;
      }

      case "extract": {
        if (!selector) return "Error: selector required for extract action.";
        const elements = smartQuerySelectorAll(selector);
        if (elements.length === 0) return `No elements found matching "${selector}".`;
        const texts = elements.map((e) => (e.textContent || "").trim()).filter(Boolean);
        const dump = texts.join("\n---\n");
        return this.compactObservation(dump, `Extracted ${texts.length} items from "${selector}"`);
      }

      case "see":
      case "look":
      case "visual":
      case "ocr": {
        const prompt = String(rawArgs.prompt || rawArgs.question || "Describe what is visually displayed on this page or element.");
        try {
          const visionResult = await VisionService.describeVisualScene(selector, prompt);
          return `[Visual Observation (${visionResult.engineUsed}, ${visionResult.durationMs}ms)]: ${visionResult.text}`;
        } catch (err: any) {
          return `Vision analysis failed: ${err.message}`;
        }
      }

      default:
        return `Unknown browse action "${action}". Allowed: inspect, snapshot, click, type, extract, see, ocr.`;
    }
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
   * Observation Compaction: Writes heavy observations (>1000 chars) to memory
   * and returns a short summary with reference ID so local LLM context does not bloat.
   */
  private compactObservation(rawText: string, label: string): string {
    if (rawText.length < 800) {
      return rawText;
    }
    const memKey = `mem://snap_${Date.now()}`;
    this.memoryStore.set(memKey, rawText);
    const preview = rawText.slice(0, 300).replace(/\n/g, " ");
    return `[Compacted ${rawText.length} chars to ${memKey}]. ${label}: ${preview}... (use read { target: "${memKey}" } if full details needed)`;
  }

  /**
   * Dispatch tool call to the corresponding primitive or custom host tool
   */
  async executeTool(toolName: string, rawArgs: Record<string, unknown> = {}): Promise<string> {
    const args = (typeof rawArgs === "object" && rawArgs !== null) ? rawArgs : {};

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
            const genericWords = ["item", "items", "product", "products", "one", "this", "it", "to", "cart", "a", "an", "the"];
            const categoryNouns = ["watch", "headphones", "headphone", "keyboard", "keyboards", "shoes", "phone", "laptop", "accessory", "gear", "device"];
            if (!genericWords.includes(requestedItem) && requestedItem.length > 2) {
              const itemWords = requestedItem.split(/\s+/).filter(w => !genericWords.includes(w));
              // Distinguish specific model/brand words from generic category nouns
              const specificWords = itemWords.filter(w => !categoryNouns.includes(w));
              const termsToCheck = specificWords.length > 0 ? specificWords : itemWords;
              const existsOnPage = termsToCheck.some(w => catalogTexts.includes(w));
              if (!existsOnPage && termsToCheck.length > 0) {
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

    // 2. Dispatch to 5 Primitives
    switch (toolName) {
      case "read":
        return this.primitiveRead(args);
      case "write":
      case "edit":
        return this.primitiveWrite(args);
      case "sandbox":
      case "bash":
        return this.primitiveSandbox(args);
      case "browse":
        return this.primitiveBrowse(args);
      case "search":
        return this.primitiveSearch(args);
      case "ask":
        return this.primitiveAsk(args);
      default:
        return `Unknown tool "${toolName}". Available primitives: read, write, sandbox, browse, search, ask.`;
    }
  }

  /**
   * Build the compact system prompt instructing the model to emit JSON tool calls
   */
  /**
   * Build the compact system prompt instructing the model to emit JSON tool calls
   */
  async getHarnessPrompt(userGoal?: string): Promise<string> {
    return buildHarnessPrompt(this.customToolDefs, userGoal);
  }

  /**
   * Robust JSON extractor: parses tool decisions even when wrapped in markdown or Chain-of-Thought prose
   */
  parseHarnessDecision(raw: string, userGoal?: string): HarnessToolCall {
    return parseHarnessDecision(raw, userGoal || this.currentUserGoal);
  }

  /**
   * Run the harness loop wrapping the given text-generation model function.
   * "The model stays a text function. The harness is the loop, the tools, the memory, and the permission check."
   */
  async runLoop(
    userGoal: string,
    modelPredictor: (messages: Array<{ role: string; content: string }>) => Promise<string>,
    activeTier: ModelTier = ModelTier.TIER_0_GEMINI_NANO
  ): Promise<HarnessExecutionResult> {
    this.currentUserGoal = userGoal;
    const startTime = performance.now();
    const siteOrigin = typeof window !== "undefined" ? window.location.origin : "web";

    // 1. Check if a deterministic macro/recipe matches this intent
    const matchingMacro = await recipeStore.findMatchingMacro(siteOrigin, userGoal);
    if (matchingMacro) {
      console.log(`[Harness] Found compiled site macro for "${userGoal}". Executing deterministically!`);
      const trajectory: AgentStepTrace[] = [];

      for (let i = 0; i < matchingMacro.actions.length; i++) {
        const action = matchingMacro.actions[i];
        const stepStart = performance.now();
        const obs = await this.executeTool(action.tool, action.args);
        trajectory.push({
          step: i + 1,
          tool: action.tool,
          args: action.args,
          observationSummary: obs.slice(0, 150),
          durationMs: Math.round(performance.now() - stepStart),
        });
        if (this.onStepProgress) {
          this.onStepProgress(i + 1, action.tool, obs);
        }
      }

      matchingMacro.executionCount++;
      matchingMacro.lastSuccessAt = Date.now();
      await recipeStore.saveMacroRecipe(matchingMacro);

      const finalMsg = `Executed verified site recipe for "${userGoal}" (${matchingMacro.actions.length} steps).`;
      return {
        final: finalMsg,
        trajectory,
        isMacro: true,
        totalDurationMs: Math.round(performance.now() - startTime),
      };
    }

    // 2. Model Harness Loop
    const systemPrompt = await this.getHarnessPrompt(userGoal);
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userGoal },
    ];

    const trajectory: AgentStepTrace[] = [];
    let lastToolCallSignature = "";
    let consecutiveFailures = 0;
    const failedCallSignatures = new Set<string>();

    // Patterns that indicate a tool call failed / returned nothing useful
    const FAILURE_PATTERNS = [
      "not found",
      "0 results",
      "0 occurrences",
      "error:",
      "syntax error",
      "failed:",
      "unknown tool",
      "does not appear",
    ];

    const isFailureObservation = (obs: string): boolean => {
      const lower = obs.toLowerCase();
      return FAILURE_PATTERNS.some((p) => lower.includes(p));
    };

    for (let step = 0; step < this.maxSteps; step++) {
      const stepStart = performance.now();
      const rawPrediction = await modelPredictor(messages);

      // Parse JSON decision with robust CoT extractor
      const decision = this.parseHarnessDecision(rawPrediction, userGoal);

      // Check if finished
      if (decision.final) {
        let cleanFinal = decision.final;
        if (cleanFinal.includes("[selector:") || cleanFinal.startsWith("[selector:")) {
          const visionStep = trajectory.find((t) => t.observationSummary?.includes("[Visual Observation"));
          if (visionStep) {
            cleanFinal = visionStep.observationSummary.replace(/^\[Visual Observation \([^)]+\)\]:\s*/, "");
          } else {
            const scene = VisionService.extractVisualScene();
            cleanFinal = `I can see "${scene.title}" with main heading "${scene.headings[0] || 'Catalog'}", featuring products like ${scene.items.slice(0, 2).join(' and ') || 'items'}.`;
          }
        }

        const duration = Math.round(performance.now() - startTime);

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

        return {
          final: cleanFinal,
          trajectory,
          isMacro: false,
          totalDurationMs: duration,
        };
      }

      // Cycle detector: Prevent model from calling identical tool and args consecutively
      const currentCallSignature = `${decision.tool}:${JSON.stringify(decision.args)}`;
      if (currentCallSignature === lastToolCallSignature) {
        const lastStep = trajectory[trajectory.length - 1];
        let successOutput = lastStep?.observationSummary
          ? lastStep.observationSummary
          : `Action "${decision.tool}" completed successfully.`;

        if (successOutput.includes("[selector:") || successOutput.startsWith("[selector:")) {
          const visionStep = trajectory.find((t) => t.observationSummary?.includes("[Visual Observation"));
          if (visionStep) {
            successOutput = visionStep.observationSummary.replace(/^\[Visual Observation \([^)]+\)\]:\s*/, "");
          } else {
            const scene = VisionService.extractVisualScene();
            successOutput = `I can see "${scene.title}" with main heading "${scene.headings[0] || 'Catalog'}", featuring products like ${scene.items.slice(0, 2).join(' and ') || 'items'}.`;
          }
        }

        const duration = Math.round(performance.now() - startTime);
        const trace: EvalTrace = {
          id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          siteOrigin,
          userGoal,
          trajectory,
          finalOutput: successOutput,
          activeTier,
        };
        await expertJudge.logTrace(trace);

        return {
          final: successOutput,
          trajectory,
          isMacro: false,
          totalDurationMs: duration,
        };
      }
      lastToolCallSignature = currentCallSignature;

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

      // Host runs the tool ("capability is a function the host runs")
      const observation = await this.executeTool(decision.tool, decision.args);
      const stepDuration = Math.round(performance.now() - stepStart);

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
        this.onStepProgress(step + 1, decision.tool, observation);
      }

      // Fix 2: Track consecutive failures
      if (isFailureObservation(observation)) {
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

          return {
            final: failMsg,
            trajectory,
            isMacro: false,
            totalDurationMs: Math.round(performance.now() - startTime),
          };
        }
      } else {
        // Reset consecutive failure counter on success
        consecutiveFailures = 0;
      }

      // Append compact observation for next iteration with enriched context
      messages.push({
        role: "assistant",
        content: JSON.stringify({ tool: decision.tool, args: decision.args }),
      });

      const failureWarning = consecutiveFailures > 0
        ? `\n⚠️ Warning: ${consecutiveFailures} consecutive tool calls have failed. If the target "${userGoal}" cannot be found, respond with {"final": "I could not find '<item>' on this page."} instead of trying unrelated approaches.`
        : "";

      messages.push({
        role: "user",
        content: `Tool Result (${decision.tool}): ${observation}${failureWarning}\n\nTask Goal was: "${userGoal}". If the goal has been fulfilled, respond with {"final": "<user summary>"}. Otherwise emit next tool call.`,
      });
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

    return {
      final: maxStepMsg,
      trajectory,
      isMacro: false,
      totalDurationMs: Math.round(performance.now() - startTime),
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

