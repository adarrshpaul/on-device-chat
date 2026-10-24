/**
 * Permission Policy Engine (TASK-117)
 *
 * Implements Single Responsibility Principle (SRP):
 * Manages permission modes ("ask_irreversible", "ask_all", "plan_only")
 * and fail-closed confirmation guarantees.
 */

import { ActionClassifier, type SafetyActionTarget, type SafetyClassification } from "./actionClassifier.ts";
import { MemoryAllowlistStore, type IAllowlistStore } from "./allowlistStore.ts";

export type PermissionMode = "ask_irreversible" | "ask_all" | "plan_only";

export type SafetyConfirmHandler = (
  classification: SafetyClassification
) => Promise<boolean>;

export interface SafetyCheckResult {
  allowed: boolean;
  classification: SafetyClassification;
  allowedVia?: "allowlist" | "user-confirm" | "not-irreversible";
  reason?: string;
}

export class PermissionPolicy {
  private mode: PermissionMode = "ask_irreversible";
  private allowlistStore: IAllowlistStore;
  private confirmHandler: SafetyConfirmHandler | null = null;

  constructor(allowlistStore?: IAllowlistStore) {
    this.allowlistStore = allowlistStore || new MemoryAllowlistStore();
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  setConfirmHandler(handler: SafetyConfirmHandler | null): void {
    this.confirmHandler = handler;
  }

  getAllowlistStore(): IAllowlistStore {
    return this.allowlistStore;
  }

  setAllowlistStore(store: IAllowlistStore): void {
    this.allowlistStore = store;
  }

  /**
   * Check if a tool execution is a state mutation.
   * Catches all mutation actions across both standard tools and browse sub-actions.
   */
  isMutationAction(tool: string, args?: Record<string, unknown>): boolean {
    const directMutations = [
      "click",
      "type",
      "select",
      "navigate",
      "submit",
      "write",
      "fill",
      "input",
      "hover",
      "clickCoordinates",
      "play",
      "autopilot",
    ];

    if (directMutations.includes(tool)) {
      return true;
    }

    // Check browse tool sub-actions
    if (tool === "browse" && args?.action) {
      const browseAction = String(args.action).toLowerCase();
      if (["click", "type", "press", "scroll", "input", "select"].includes(browseAction)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluates pre-tool execution gating based on permission mode.
   * Always fails closed when required confirmation handler is absent.
   */
  async evaluatePreToolMode(
    tool: string,
    args: Record<string, unknown>
  ): Promise<{ proceed: boolean; reason?: string }> {
    const isMutation = this.isMutationAction(tool, args);

    // 1. Plan-only mode: strictly block all mutations
    if (this.mode === "plan_only" && isMutation) {
      return {
        proceed: false,
        reason: `Blocked by Permission Mode [plan_only]: mutation tool "${tool}" is disallowed in read-only plan mode.`,
      };
    }

    // 2. Ask-all mode: prompt for EVERY mutation
    if (this.mode === "ask_all" && isMutation) {
      const targetDesc = args.target ? `target: ${args.target}` : (args.url ? `url: ${args.url}` : tool);
      const classification: SafetyClassification = {
        isIrreversible: false,
        reason: `Permission Mode [ask_all] requires approval for mutation "${tool}"`,
        targetDescription: `${tool} (${targetDesc})`,
        actionType: (tool as any) || "other",
        origin: ActionClassifier.getCurrentOrigin(),
      };

      if (!this.confirmHandler) {
        // FAIL CLOSED: Never allow action to proceed without user confirmation in ask_all mode!
        return {
          proceed: false,
          reason: `Blocked by Permission Mode [ask_all]: mutation tool "${tool}" requires confirmation, but no confirmation handler is registered.`,
        };
      }

      try {
        const approved = await this.confirmHandler(classification);
        if (!approved) {
          return {
            proceed: false,
            reason: `User denied execution of "${tool}" in [ask_all] mode.`,
          };
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          proceed: false,
          reason: `Confirmation dialog exception in [ask_all]: ${message}`,
        };
      }
    }

    return { proceed: true };
  }

  /**
   * Check and confirm an action target.
   * Fails closed if action is irreversible and no handler or allowlist is present.
   */
  async checkAndConfirm(target: SafetyActionTarget): Promise<SafetyCheckResult> {
    const classification = ActionClassifier.classify(target);

    // 1. Not irreversible: allow immediately
    if (!classification.isIrreversible) {
      return {
        allowed: true,
        classification,
        allowedVia: "not-irreversible",
      };
    }

    // 2. Check allowlist store
    const isAllowed = await this.allowlistStore.isAllowed(classification.origin);
    if (isAllowed) {
      return {
        allowed: true,
        classification,
        allowedVia: "allowlist",
      };
    }

    // 3. User confirmation handler
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          allowed: false,
          classification,
          reason: `Confirmation dialog error: ${message}`,
        };
      }
    }

    // 4. Fail closed if irreversible and no handler attached
    return {
      allowed: false,
      classification,
      reason: `Blocked by Safety Gate: Irreversible action ("${classification.targetDescription}") requires user confirmation, but no confirmation handler is registered.`,
    };
  }
}
