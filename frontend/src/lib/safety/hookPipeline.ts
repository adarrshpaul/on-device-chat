/**
 * Hook Pipeline (TASK-117)
 *
 * Implements Single Responsibility Principle (SRP):
 * Manages deterministic pre-tool and post-tool middleware hook execution.
 */

export interface HookEvaluationResult {
  proceed: boolean;
  modifiedArgs?: Record<string, unknown>;
  reason?: string;
}

export type PreToolHook = (
  tool: string,
  args: Record<string, unknown>
) => Promise<HookEvaluationResult> | HookEvaluationResult;

export type PostToolHook = (
  tool: string,
  args: Record<string, unknown>,
  result: string,
  durationMs: number
) => Promise<void> | void;

export class HookPipeline {
  private preHooks: PreToolHook[] = [];
  private postHooks: PostToolHook[] = [];

  registerPreHook(hook: PreToolHook): void {
    this.preHooks.push(hook);
  }

  registerPostHook(hook: PostToolHook): void {
    this.postHooks.push(hook);
  }

  clearHooks(): void {
    this.preHooks = [];
    this.postHooks = [];
  }

  async runPreHooks(
    tool: string,
    args: Record<string, unknown>
  ): Promise<HookEvaluationResult> {
    let currentArgs = { ...args };

    for (const hook of this.preHooks) {
      try {
        const result = await hook(tool, currentArgs);
        if (!result.proceed) {
          return {
            proceed: false,
            reason: result.reason || `Pre-tool hook blocked execution of "${tool}".`,
          };
        }
        if (result.modifiedArgs) {
          currentArgs = { ...currentArgs, ...result.modifiedArgs };
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          proceed: false,
          reason: `Pre-tool hook exception on "${tool}": ${message}`,
        };
      }
    }

    return { proceed: true, modifiedArgs: currentArgs };
  }

  async runPostHooks(
    tool: string,
    args: Record<string, unknown>,
    result: string,
    durationMs: number
  ): Promise<void> {
    for (const hook of this.postHooks) {
      try {
        await hook(tool, args, result, durationMs);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[HookPipeline] Post-tool hook error for "${tool}":`, message);
      }
    }
  }
}
