/**
 * Irreversible-Action Safety Gate Facade (TASK-112 & TASK-117)
 *
 * Enforces human-in-the-loop confirmation before executing irreversible,
 * destructive, financial, or communication actions on live websites.
 *
 * Refactored per SOLID principles:
 * - ActionClassifier: Table-driven pure semantic classification (OCP)
 * - AllowlistStore: Inverted storage port isolating allowlist from untrusted page localStorage (DIP)
 * - PermissionPolicy: Permission mode evaluation and fail-closed confirmation (SRP)
 * - HookPipeline: Deterministic pre/post tool middleware execution (SRP)
 */

import { ActionClassifier, type IrreversibleCategory, type SafetyActionTarget, type SafetyClassification } from "./safety/actionClassifier.ts";
import { ExtensionAllowlistStore, MemoryAllowlistStore, type IAllowlistStore } from "./safety/allowlistStore.ts";
import { HookPipeline, type PostToolHook, type PreToolHook } from "./safety/hookPipeline.ts";
import { PermissionPolicy, type PermissionMode, type SafetyCheckResult, type SafetyConfirmHandler } from "./safety/permissionPolicy.ts";

declare const chrome: any;

export type {
  PermissionMode,
  IrreversibleCategory,
  SafetyClassification,
  SafetyActionTarget,
  SafetyCheckResult,
  SafetyConfirmHandler,
  PreToolHook,
  PostToolHook,
  IAllowlistStore,
};

export {
  ActionClassifier,
  MemoryAllowlistStore,
  ExtensionAllowlistStore,
  PermissionPolicy,
  HookPipeline,
};

export class SafetyGate {
  private static policy = new PermissionPolicy(
    typeof chrome !== "undefined" && Boolean(chrome.storage?.sync || chrome.storage?.local)
      ? new ExtensionAllowlistStore()
      : new MemoryAllowlistStore()
  );
  private static hookPipeline = new HookPipeline();

  /**
   * Initialize or reset SafetyGate state
   */
  public static init(): void {
    this.hookPipeline.clearHooks();
    this.setPermissionMode("ask_irreversible");
  }

  /**
   * Set the permission mode ("ask_irreversible", "ask_all", "plan_only")
   */
  public static setPermissionMode(mode: PermissionMode): void {
    this.policy.setMode(mode);
  }

  /**
   * Get the current permission mode
   */
  public static getPermissionMode(): PermissionMode {
    return this.policy.getMode();
  }

  /**
   * Register a pre-tool execution hook
   */
  public static registerPreHook(hook: PreToolHook): void {
    this.hookPipeline.registerPreHook(hook);
  }

  /**
   * Register a post-tool execution hook
   */
  public static registerPostHook(hook: PostToolHook): void {
    this.hookPipeline.registerPostHook(hook);
  }

  /**
   * Clear all registered hooks
   */
  public static clearHooks(): void {
    this.hookPipeline.clearHooks();
  }

  /**
   * Run pre-tool middleware chain and mode checks
   */
  public static async runPreHooks(
    tool: string,
    args: Record<string, unknown>
  ): Promise<{ proceed: boolean; modifiedArgs?: Record<string, unknown>; reason?: string }> {
    // 1. Evaluate permission mode
    const modeResult = await this.policy.evaluatePreToolMode(tool, args);
    if (!modeResult.proceed) {
      return modeResult;
    }

    // 2. Run registered middleware hooks
    return this.hookPipeline.runPreHooks(tool, args);
  }

  /**
   * Run post-tool execution hooks
   */
  public static async runPostHooks(
    tool: string,
    args: Record<string, unknown>,
    result: string,
    durationMs: number
  ): Promise<void> {
    return this.hookPipeline.runPostHooks(tool, args, result, durationMs);
  }

  /**
   * Attach a user confirmation handler (UI dialog callback)
   */
  public static setConfirmHandler(handler: SafetyConfirmHandler | null): void {
    this.policy.setConfirmHandler(handler);
  }

  /**
   * Determine current active origin safely
   */
  public static getCurrentOrigin(): string {
    return ActionClassifier.getCurrentOrigin();
  }

  /**
   * Classify an action target to determine if it is irreversible
   */
  public static classify(target: SafetyActionTarget): SafetyClassification {
    return ActionClassifier.classify(target);
  }

  /**
   * Backwards compatible alias for classifyAction
   */
  public static classifyAction(
    actionType: "click" | "type" | "submit" | "navigate" | "select" | "other",
    target: { selector?: string; text?: string; role?: string; url?: string }
  ): SafetyClassification {
    return ActionClassifier.classify({
      actionType,
      targetDescription: target.text || target.selector,
      url: target.url,
    });
  }

  /**
   * Check and confirm an action target. Fails closed if approval is required but absent.
   */
  public static async checkAndConfirm(target: SafetyActionTarget): Promise<SafetyCheckResult> {
    return this.policy.checkAndConfirm(target);
  }

  /**
   * Check if an origin is allowlisted
   */
  public static isOriginAllowed(origin: string): boolean | Promise<boolean> {
    return this.policy.getAllowlistStore().isAllowed(origin);
  }

  /**
   * Allow an origin permanently
   */
  public static allowOrigin(origin: string): void | Promise<void> {
    return this.policy.getAllowlistStore().add(origin);
  }

  /**
   * Revoke an origin from allowlist
   */
  public static revokeOrigin(origin: string): void | Promise<void> {
    return this.policy.getAllowlistStore().remove(origin);
  }

  /**
   * Get all allowlisted origins
   */
  public static getAllowlist(): string[] | Promise<string[]> {
    return this.policy.getAllowlistStore().getAll();
  }

  /**
   * Clear allowlist
   */
  public static clearAllowlist(): void | Promise<void> {
    return this.policy.getAllowlistStore().clear();
  }

  /**
   * Replace the underlying allowlist store (for dependency injection during testing)
   */
  public static setAllowlistStore(store: IAllowlistStore): void {
    this.policy.setAllowlistStore(store);
  }

  /**
   * Prompt Injection Defense: wraps untrusted webpage content inside <page_content>
   */
  public static wrapUntrustedPageContent(content: string): string {
    if (!content) return "";
    const sanitized = content
      .replace(/<\/page_content>/gi, "&lt;/page_content&gt;")
      .replace(/<page_content/gi, "&lt;page_content");

    return `<page_content data-untrusted="true">\n${sanitized}\n</page_content>`;
  }
}
