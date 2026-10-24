/**
 * Irreversible-Action Safety Gate & Permission Harness (TASK-112 / Harness Item 7)
 *
 * Enforces human-in-the-loop confirmation before executing irreversible,
 * destructive, financial, or communication actions on live websites.
 *
 * Guarantees:
 * 1. Live target inspection: evaluates role, accessible name, form action,
 *    button label, and URL targets dynamically with 0 hardcoded site selectors (Rule 9).
 * 2. Fail-closed confirmation: blocks action execution unless confirmed by user
 *    or explicitly permitted by a persistent per-origin allowlist.
 * 3. Permission Modes (Claude Code style):
 *    - "ask_irreversible" (default): prompt only for irreversible/destructive/financial actions.
 *    - "ask_all": prompt for every mutation (click/type/select/navigate).
 *    - "plan_only": read-only plan mode, all mutations blocked.
 * 4. Pre/Post Tool Hook Architecture: deterministic middleware chain around executeTool.
 * 5. Prompt data-wrapping defense: wraps live webpage text in <page_content>
 *    data blocks to prevent prompt-injection command overrides.
 */

export type PermissionMode = "ask_irreversible" | "ask_all" | "plan_only";

export type IrreversibleCategory =
  | "financial"
  | "destructive"
  | "communication"
  | "transfer";

export interface SafetyClassification {
  isIrreversible: boolean;
  category?: IrreversibleCategory;
  reason?: string;
  targetDescription: string;
  actionType: "click" | "type" | "submit" | "navigate" | "select" | "other";
  origin: string;
}

export interface SafetyActionTarget {
  actionType: "click" | "type" | "submit" | "navigate" | "select" | "other";
  element?: HTMLElement | null;
  targetDescription?: string;
  url?: string;
  value?: string;
  origin?: string;
}

export interface SafetyCheckResult {
  allowed: boolean;
  classification: SafetyClassification;
  allowedVia?: "allowlist" | "user-confirm" | "not-irreversible";
  reason?: string;
}

export type SafetyConfirmHandler = (
  classification: SafetyClassification
) => Promise<boolean>;

export type PreToolHook = (
  tool: string,
  args: Record<string, any>
) => Promise<{
  proceed: boolean;
  modifiedArgs?: Record<string, any>;
  reason?: string;
}>;

export type PostToolHook = (
  tool: string,
  args: Record<string, any>,
  result: string,
  durationMs: number
) => Promise<void>;

// Destructive patterns: delete, purge, wipe, terminate, cancel subscription, destroy, drop
const DESTRUCTIVE_REGEX =
  /\b(?:delete(?:\s+(?:account|user|all|item|row|project|database|profile|repo))?|remove(?:\s+(?:account|user|all|member))?|destroy|drop\s+table|erase|purge|terminate(?:\s+(?:account|contract))?|cancel\s+(?:subscription|membership|account|plan)|wipe(?:\s+(?:data|all|drive))?|reset\s+(?:to\s+factory|all|account))\b/i;

// Financial patterns: pay, checkout, buy, purchase, place order, confirm order, subscribe, charge
const FINANCIAL_REGEX =
  /\b(?:check\s*out|pay(?:ment)?|purchase|buy(?:\s+now)?|place\s+order|confirm\s+order|complete\s+order|subscribe(?:\s+now)?|charge\s+card|submit\s+payment|make\s+payment|buy\s+license)\b/i;

// Communication patterns: send message/email, publish post, broadcast, tweet, post comment
const COMMUNICATION_REGEX =
  /\b(?:send(?:\s+(?:message|email|invite|dispatch|money))?|publish(?:\s+(?:post|article|release|package))?|broadcast|tweet|post\s+(?:comment|reply|status))\b/i;

// Transfer patterns: transfer funds, wire, withdraw
const TRANSFER_REGEX =
  /\b(?:transfer(?:\s+(?:funds|money|ownership|domain))?|wire\s+transfer|withdraw(?:\s+funds)?)\b/i;

// Safe patterns that often contain substrings of above but are strictly safe reads/navigations
const SAFE_CONTEXT_REGEX =
  /\b(?:search|view\s+orders?|order\s+history|track\s+order|read\s+post|view\s+post|cancel(?:\s+dialog|\s+modal)?$|close|filter|sort|next|previous|prev|back|expand|collapse|copy|download(?:\s+receipt|\s+resume)?|details|inspect|see\s+more|show\s+more)\b/i;

// Dangerous or irreversible URL path segments
const IRREVERSIBLE_URL_REGEX =
  /\/(?:checkout|pay(?:ment)?|purchase|buy|delete-account|terminate|transfer-funds|send-message)\b/i;

const STORAGE_KEY_ALLOWLIST = "eo_safety_allowlist";
const STORAGE_KEY_MODE = "eo_permission_mode";

export class SafetyGate {
  private static confirmHandler: SafetyConfirmHandler | null = null;
  private static memoryAllowlist = new Set<string>();
  private static permissionMode: PermissionMode = "ask_irreversible";

  // Pre and post tool execution hooks
  private static preHooks: PreToolHook[] = [];
  private static postHooks: PostToolHook[] = [];
  private static initialized = false;

  public static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Load persisted permission mode
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(STORAGE_KEY_MODE) as PermissionMode;
        if (stored === "ask_irreversible" || stored === "ask_all" || stored === "plan_only") {
          this.permissionMode = stored;
        }
      }
    } catch {}

    // Register the SafetyGate pre-hook as the default first pre-hook
    this.registerPreHook(async (tool: string, args: Record<string, any>) => {
      return this.evaluatePreToolExecution(tool, args);
    });
  }

  /**
   * Set the active permission mode (ask_irreversible, ask_all, plan_only)
   */
  public static setPermissionMode(mode: PermissionMode): void {
    this.permissionMode = mode;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY_MODE, mode);
      }
    } catch {}
  }

  public static getPermissionMode(): PermissionMode {
    return this.permissionMode;
  }

  /**
   * Register pre-tool hook
   */
  public static registerPreHook(hook: PreToolHook): void {
    this.preHooks.push(hook);
  }

  /**
   * Register post-tool hook
   */
  public static registerPostHook(hook: PostToolHook): void {
    this.postHooks.push(hook);
  }

  public static clearHooks(): void {
    this.preHooks = [];
    this.postHooks = [];
    this.initialized = false;
  }

  /**
   * Run all pre-tool hooks sequentially. If any rejects, execution stops.
   */
  public static async runPreHooks(
    tool: string,
    args: Record<string, any>
  ): Promise<{ proceed: boolean; modifiedArgs?: Record<string, any>; reason?: string }> {
    this.init();
    let currentArgs = { ...args };

    for (const hook of this.preHooks) {
      const res = await hook(tool, currentArgs);
      if (!res.proceed) {
        return { proceed: false, reason: res.reason || "Action blocked by pre-tool hook." };
      }
      if (res.modifiedArgs) {
        currentArgs = { ...currentArgs, ...res.modifiedArgs };
      }
    }

    return { proceed: true, modifiedArgs: currentArgs };
  }

  /**
   * Run all post-tool hooks sequentially
   */
  public static async runPostHooks(
    tool: string,
    args: Record<string, any>,
    result: string,
    durationMs: number
  ): Promise<void> {
    for (const hook of this.postHooks) {
      try {
        await hook(tool, args, result, durationMs);
      } catch (err) {
        console.warn("[SafetyGate] Post-tool hook error:", err);
      }
    }
  }

  /**
   * Internal pre-tool evaluator checking permission modes and safety classifications
   */
  private static async evaluatePreToolExecution(
    tool: string,
    args: Record<string, any>
  ): Promise<{ proceed: boolean; reason?: string }> {
    const isMutationTool = ["click", "type", "select", "navigate", "submit", "write"].includes(tool);

    // 1. Plan-only mode: block any state mutation
    if (this.permissionMode === "plan_only" && isMutationTool) {
      return {
        proceed: false,
        reason: `Blocked by Permission Mode [plan_only]: mutation tool "${tool}" is disallowed in read-only plan mode.`,
      };
    }

    // 2. Ask-all mode: ask for every mutation
    if (this.permissionMode === "ask_all" && isMutationTool) {
      const targetDesc = args.target ? `target: ${args.target}` : (args.url ? `url: ${args.url}` : tool);
      if (this.confirmHandler) {
        const approved = await this.confirmHandler({
          isIrreversible: false,
          reason: `Permission Mode [ask_all] requires approval for "${tool}"`,
          targetDescription: `${tool} (${targetDesc})`,
          actionType: tool as any,
          origin: this.getCurrentOrigin(),
        });
        if (!approved) {
          return { proceed: false, reason: `User denied execution of "${tool}" in [ask_all] mode.` };
        }
      }
    }

    // 3. Ask-irreversible mode: checked via checkAndConfirm below
    return { proceed: true };
  }

  /**
   * Register a callback to prompt the user in the UI (e.g. ChatWidget / DecisionCard)
   */
  public static setConfirmHandler(handler: SafetyConfirmHandler | null): void {
    this.confirmHandler = handler;
  }

  /**
   * Determine the current page origin in a safe way
   */
  public static getCurrentOrigin(): string {
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      return window.location.origin;
    }
    return "web";
  }

  /**
   * Classify an action target from live element attributes & text
   */
  public static classify(target: SafetyActionTarget): SafetyClassification {
    const origin = target.origin || this.getCurrentOrigin();
    const actionType = target.actionType;

    // 1. URL navigation inspection
    if (actionType === "navigate" || target.url) {
      const urlStr = target.url || "";
      if (IRREVERSIBLE_URL_REGEX.test(urlStr)) {
        return {
          isIrreversible: true,
          category: "financial",
          reason: `Navigation to payment or checkout endpoint ("${urlStr}")`,
          targetDescription: `navigate -> ${urlStr}`,
          actionType: "navigate",
          origin,
        };
      }
    }

    // 2. Element inspection
    const element = target.element;
    const textPieces: string[] = [];

    if (target.targetDescription) {
      textPieces.push(target.targetDescription);
    }

    if (element) {
      const ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel) textPieces.push(ariaLabel);

      const title = element.getAttribute("title");
      if (title) textPieces.push(title);

      const text = element.innerText || element.textContent;
      if (text) textPieces.push(text.trim());

      const val = (element as HTMLInputElement).value;
      if (typeof val === "string" && val.length > 0) textPieces.push(val);

      const btnName = element.getAttribute("name");
      if (btnName) textPieces.push(btnName);

      const dataAction = element.getAttribute("data-action");
      if (dataAction) textPieces.push(dataAction);

      // Check if inside a form
      const form = element.closest("form") as HTMLFormElement | null;
      if (form) {
        if (form.action) textPieces.push(form.action);
        const formAria = form.getAttribute("aria-label");
        if (formAria) textPieces.push(formAria);
      }

      // Check if anchor link
      const anchor = element.closest("a") as HTMLAnchorElement | null;
      if (anchor && anchor.href) {
        textPieces.push(anchor.href);
      }
    }

    const combinedText = textPieces.join(" ").trim();
    const desc = target.targetDescription || combinedText.slice(0, 80) || "action target";

    if (!combinedText) {
      return {
        isIrreversible: false,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // Explicit check: standalone "Cancel" button in a modal or dialog is safe (dismiss)
    const isSingleCancel = /^(?:cancel|close|dismiss|back|abort)$/i.test(combinedText.trim());
    if (isSingleCancel) {
      return {
        isIrreversible: false,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // Safe context check (e.g. "Order History", "Search", "View Orders")
    if (SAFE_CONTEXT_REGEX.test(combinedText) && !DESTRUCTIVE_REGEX.test(combinedText)) {
      return {
        isIrreversible: false,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // Category 1: Destructive actions
    if (DESTRUCTIVE_REGEX.test(combinedText)) {
      const match = combinedText.match(DESTRUCTIVE_REGEX);
      return {
        isIrreversible: true,
        category: "destructive",
        reason: `Destructive action detected ("${match ? match[0] : "delete"}")`,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // Category 2: Financial actions
    if (FINANCIAL_REGEX.test(combinedText)) {
      const match = combinedText.match(FINANCIAL_REGEX);
      return {
        isIrreversible: true,
        category: "financial",
        reason: `Financial payment / checkout action detected ("${match ? match[0] : "purchase"}")`,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // Category 3: Transfer actions
    if (TRANSFER_REGEX.test(combinedText)) {
      const match = combinedText.match(TRANSFER_REGEX);
      return {
        isIrreversible: true,
        category: "transfer",
        reason: `Transfer / withdrawal action detected ("${match ? match[0] : "transfer"}")`,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    // Category 4: Communication actions (only for clicks/submits, typing text into an input is not inherently a sent message)
    if ((actionType === "click" || actionType === "submit") && COMMUNICATION_REGEX.test(combinedText)) {
      const match = combinedText.match(COMMUNICATION_REGEX);
      return {
        isIrreversible: true,
        category: "communication",
        reason: `Communication / publish action detected ("${match ? match[0] : "send"}")`,
        targetDescription: desc,
        actionType,
        origin,
      };
    }

    return {
      isIrreversible: false,
      targetDescription: desc,
      actionType,
      origin,
    };
  }

  /**
   * Check an action against the safety gate and await confirmation if required.
   */
  public static async checkAndConfirm(
    target: SafetyActionTarget
  ): Promise<SafetyCheckResult> {
    const classification = this.classify(target);

    // If safe, allow immediately
    if (!classification.isIrreversible) {
      return {
        allowed: true,
        classification,
        allowedVia: "not-irreversible",
      };
    }

    // Check persistent per-origin allowlist
    if (this.isOriginAllowed(classification.origin)) {
      return {
        allowed: true,
        classification,
        allowedVia: "allowlist",
      };
    }

    // If a confirm handler is registered (UI interactive mode), request approval
    if (this.confirmHandler) {
      try {
        const approved = await this.confirmHandler(classification);
        if (approved) {
          return {
            allowed: true,
            classification,
            allowedVia: "user-confirm",
          };
        }
        return {
          allowed: false,
          classification,
          reason: `User denied confirmation for irreversible ${classification.category || "destructive"} action.`,
        };
      } catch (err: any) {
        return {
          allowed: false,
          classification,
          reason: `Confirmation dialog error: ${err?.message || "Unknown error"}`,
        };
      }
    }

    // Fail-closed default (headless / automated without handler)
    return {
      allowed: false,
      classification,
      reason: `Blocked by Safety Gate: Irreversible action ("${classification.targetDescription}") requires user confirmation, but no confirmation handler is registered.`,
    };
  }

  /**
   * Check if an origin is allowlisted
   */
  public static isOriginAllowed(origin: string): boolean {
    if (!origin) return false;
    if (this.memoryAllowlist.has(origin)) return true;

    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(STORAGE_KEY_ALLOWLIST);
        if (raw) {
          const list: string[] = JSON.parse(raw);
          return list.includes(origin);
        }
      }
    } catch {
      // Fallback to memory
    }
    return false;
  }

  /**
   * Allow an origin to execute irreversible actions without prompt
   */
  public static allowOrigin(origin: string): void {
    if (!origin) return;
    this.memoryAllowlist.add(origin);

    try {
      if (typeof localStorage !== "undefined") {
        const list = this.getAllowlist();
        if (!list.includes(origin)) {
          list.push(origin);
          localStorage.setItem(STORAGE_KEY_ALLOWLIST, JSON.stringify(list));
        }
      }
    } catch {
      // Memory fallback only
    }
  }

  /**
   * Revoke permission for an origin
   */
  public static revokeOrigin(origin: string): void {
    if (!origin) return;
    this.memoryAllowlist.delete(origin);

    try {
      if (typeof localStorage !== "undefined") {
        const list = this.getAllowlist().filter((o) => o !== origin);
        localStorage.setItem(STORAGE_KEY_ALLOWLIST, JSON.stringify(list));
      }
    } catch {
      // Memory fallback
    }
  }

  /**
   * Retrieve all currently allowlisted origins
   */
  public static getAllowlist(): string[] {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(STORAGE_KEY_ALLOWLIST);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {
      // Return memory
    }
    return Array.from(this.memoryAllowlist);
  }

  /**
   * Clear all allowlisted origins
   */
  public static clearAllowlist(): void {
    this.memoryAllowlist.clear();
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY_ALLOWLIST);
      }
    } catch {
      // Memory only
    }
  }

  /**
   * Wrap untrusted page text inside data blocks for LLM prompt ingestion
   */
  public static wrapUntrustedPageContent(content: string): string {
    return `<page_content data-untrusted="true">\n${content}\n</page_content>`;
  }
}
