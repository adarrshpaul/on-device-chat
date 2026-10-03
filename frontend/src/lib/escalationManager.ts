/**
 * Progressive Escalation Architecture Manager
 *
 * Tiers:
 * - Tier 0: Chrome Gemini Nano (window.ai.languageModel) — 0 MB download
 * - Tier 1: Transformers.js Router (Xenova/all-MiniLM-L6-v2) — ~15-20 MB download
 * - Tier 2: SmolLM2-135M-Instruct (Q4 ONNX via WebGPU) — ~80 MB lazy-loaded
 * - Tier 3: Gemma 4 E2B Unified Architecture (WebLLM Q4) — ~600-800 MB
 */
import { GeminiNanoEngine } from "./geminiNanoEngine";
import { CompactEngine } from "./compactEngine";
import { Gemma4Engine } from "./engine";
import { backgroundDownloader } from "./backgroundDownloader";
import { ToolDefinition, EngineChatResponse, ModelTier, TierInfo } from "./types";
export { ModelTier };
export type { TierInfo };

export const TIER_METADATA: Record<ModelTier, TierInfo> = {
  [ModelTier.TIER_0_GEMINI_NANO]: {
    tier: ModelTier.TIER_0_GEMINI_NANO,
    name: "Gemini Nano",
    size: "0 MB (Chrome Native)",
    description: "Built-in On-Device AI",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  },
  [ModelTier.TIER_1_MINILM_ROUTER]: {
    tier: ModelTier.TIER_1_MINILM_ROUTER,
    name: "MiniLM Router",
    size: "~15 MB (ONNX)",
    description: "Semantic Tool Router",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  [ModelTier.TIER_2_SMOLLM_GENERATIVE]: {
    tier: ModelTier.TIER_2_SMOLLM_GENERATIVE,
    name: "SmolLM2-135M",
    size: "~80 MB (Q4 ONNX)",
    description: "Compact Generative LLM",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
  [ModelTier.TIER_3_GEMMA4_E2B]: {
    tier: ModelTier.TIER_3_GEMMA4_E2B,
    name: "Gemma 4 E2B",
    size: "~600-800 MB",
    description: "Full Unified Edge Model",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
};

export class EscalationManager {
  public currentTier: ModelTier = ModelTier.TIER_0_GEMINI_NANO;
  private tools: ToolDefinition[] = [];
  private systemPrompt?: string;

  public nanoSupported: boolean = false;
  public nanoDiagnostic: string = "";

  // Active tier engines
  private nanoEngine?: GeminiNanoEngine;
  private compactEngine?: CompactEngine;
  private gemmaEngine?: Gemma4Engine;

  private onTierChange?: (newTier: TierInfo) => void;
  private onEscalationNotice?: (message: string) => void;

  constructor(options: {
    tools: ToolDefinition[];
    systemPrompt?: string;
    onTierChange?: (newTier: TierInfo) => void;
    onEscalationNotice?: (message: string) => void;
  }) {
    this.tools = options.tools;
    this.systemPrompt = options.systemPrompt;
    this.onTierChange = options.onTierChange;
    this.onEscalationNotice = options.onEscalationNotice;

    // Start background prefetching 4s after page load
    backgroundDownloader.startIdlePrefetch(4000);
  }

  get currentTierInfo(): TierInfo {
    return TIER_METADATA[this.currentTier];
  }

  /**
   * Initialize starting tier.
   * Checks Chrome Gemini Nano first. If not enabled in chrome://flags,
   * stores diagnostic and uses Tier 1 MiniLM Router (~15MB).
   */
  async init(): Promise<void> {
    const diag = await GeminiNanoEngine.checkAvailability();
    this.nanoSupported = diag.status === "readily" || diag.status === "downloadable" || diag.status === "downloading";
    this.nanoDiagnostic = diag.detail;

    if (this.nanoSupported) {
      const nano = new GeminiNanoEngine();
      const ready = await nano.init(this.systemPrompt, this.tools);
      if (ready) {
        this.nanoEngine = nano;
        this.currentTier = ModelTier.TIER_0_GEMINI_NANO;
        this.onTierChange?.(this.currentTierInfo);
        return;
      }
    }

    // Chrome Gemini Nano flag is not enabled or hardware check failed
    console.info(`ℹ️ Gemini Nano: ${this.nanoDiagnostic}. Starting at Tier 1 MiniLM Router.`);
    await this.setTier(ModelTier.TIER_1_MINILM_ROUTER);
  }

  public async setTier(tier: ModelTier): Promise<void> {
    this.currentTier = tier;
    this.onTierChange?.(this.currentTierInfo);

    if (tier === ModelTier.TIER_0_GEMINI_NANO) {
      if (!this.nanoEngine) {
        const nano = new GeminiNanoEngine();
        await nano.init(this.systemPrompt, this.tools);
        this.nanoEngine = nano;
      }
    } else if (tier === ModelTier.TIER_1_MINILM_ROUTER) {
      if (!this.compactEngine) {
        this.compactEngine = new CompactEngine();
        await this.compactEngine.initRouter(this.tools);
      }
    } else if (tier === ModelTier.TIER_2_SMOLLM_GENERATIVE) {
      if (!this.compactEngine) {
        this.compactEngine = new CompactEngine();
        await this.compactEngine.initRouter(this.tools);
      }
      await this.compactEngine.loadGenerator();
    } else if (tier === ModelTier.TIER_3_GEMMA4_E2B) {
      if (!this.gemmaEngine) {
        this.gemmaEngine = new Gemma4Engine();
        await this.gemmaEngine.load();
      }
    }
  }

  /**
   * Explicit Escalation triggered by user negative feedback or tool failure.
   */
  async escalate(reason: string = "User requested a more capable model"): Promise<string> {
    const nextTier = Math.min(this.currentTier + 1, ModelTier.TIER_3_GEMMA4_E2B) as ModelTier;

    if (nextTier === this.currentTier) {
      return "Already at the highest local model tier (Gemma 4 E2B).";
    }

    const nextInfo = TIER_METADATA[nextTier];
    const notice = `I understand this didn't meet your expectations (${reason}). I am escalating this conversation to **${nextInfo.name}** (${nextInfo.size})...`;
    this.onEscalationNotice?.(notice);

    await this.setTier(nextTier);
    return notice;
  }

  /**
   * Run chat through currently active tier.
   */
  async chat(messages: Array<{ role: string; content?: string }>): Promise<EngineChatResponse> {
    const lastUserQuery = [...messages].reverse().find(m => m.role === "user")?.content || "";

    // Tier 0: Gemini Nano
    if (this.currentTier === ModelTier.TIER_0_GEMINI_NANO && this.nanoEngine) {
      try {
        const res = await this.nanoEngine.chat(lastUserQuery);
        if (!res.content && (!res.tool_calls || res.tool_calls.length === 0)) {
          await this.escalate("Gemini Nano returned empty response");
          return await this.chat(messages);
        }
        return res;
      } catch (err: any) {
        console.warn("Tier 0 error, auto-escalating to Tier 1:", err);
        await this.escalate("Gemini Nano execution failed");
        return await this.chat(messages);
      }
    }

    // Tier 1: MiniLM Router (15 MB)
    if (this.currentTier === ModelTier.TIER_1_MINILM_ROUTER && this.compactEngine) {
      try {
        return await this.compactEngine.chat(lastUserQuery);
      } catch (err: any) {
        console.warn("Tier 1 error, auto-escalating to Tier 2:", err);
        await this.escalate("Tier 1 tool routing uncertain");
        return await this.chat(messages);
      }
    }

    // Tier 2: SmolLM2-135M Generative (80 MB)
    if (this.currentTier === ModelTier.TIER_2_SMOLLM_GENERATIVE) {
      if (this.compactEngine?.isGeneratorReady) {
        try {
          const prompt = `<|im_start|>user\n${lastUserQuery}<|im_end|>\n<|im_start|>assistant\n`;
          const text = await this.compactEngine.generateText(prompt, 96);
          return { content: text };
        } catch (err: any) {
          console.warn("Tier 2 SmolLM2 generation error:", err);
          return { content: `[SmolLM2-135M Error]: ${err.message}` };
        }
      }
      return {
        content: `[SmolLM2-135M]: Generative weights are downloading into WebGPU (~80MB). Please wait for initialization.`,
      };
    }

    // Tier 3: Gemma 4 E2B Unified (600-800 MB)
    if (this.currentTier === ModelTier.TIER_3_GEMMA4_E2B) {
      if (this.gemmaEngine?.isLoaded) {
        try {
          const gemmaRes = await this.gemmaEngine.chat(messages as any, this.tools as any);
          const choice = gemmaRes.choices[0];
          return {
            content: choice?.message?.content || undefined,
            tool_calls: choice?.message?.tool_calls?.map((tc: any) => ({
              id: tc.id || `call_${Date.now()}`,
              type: "function",
              function: {
                name: tc.function.name,
                arguments: typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments),
              },
            })),
          };
        } catch (err: any) {
          console.warn("Tier 3 Gemma 4 execution error:", err);
          return { content: `[Gemma 4 Error]: ${err.message}` };
        }
      }
      return {
        content: `[Gemma 4 E2B]: Model weights are downloading into WebGPU (~600-800 MB). Please wait for initialization.`,
      };
    }

    return {
      content: `No model tier currently active. Please select a model tier.`,
    };
  }

  /**
   * Direct text predictor for agent harness loops
   */
  async predictText(rawPrompt: string, messages?: Array<{ role: string; content: string }>): Promise<string> {
    // Tier 0: Gemini Nano
    if (this.currentTier === ModelTier.TIER_0_GEMINI_NANO && this.nanoEngine) {
      try {
        return await this.nanoEngine.promptRaw(rawPrompt);
      } catch (err) {
        console.warn("Gemini Nano harness prediction failed, escalating:", err);
        await this.escalate("Gemini Nano harness prediction error");
      }
    }

    // Extract root user intention vs environment observations
    let cleanQuery = rawPrompt;
    let hasObservation = false;
    let lastObservation = "";

    if (messages && messages.length > 0) {
      const userMsgs = messages.filter((m) => m.role === "user");
      // Root instruction is always the initial user goal
      const rootGoal = userMsgs[0]?.content || rawPrompt;
      cleanQuery = rootGoal;

      // Check if harness has executed at least one tool
      const latestMsg = userMsgs[userMsgs.length - 1]?.content || "";
      if (latestMsg.includes("Tool Result") || latestMsg.includes("Observation:")) {
        hasObservation = true;
        lastObservation = latestMsg
          .replace(/^(?:Tool Result \([^)]+\)|Observation):\s*/i, "")
          .split("\n")[0]
          .trim();
      }
    }

    // Tier 1: MiniLM Router (15 MB ONNX)
    if (this.currentTier === ModelTier.TIER_1_MINILM_ROUTER && this.compactEngine) {
      // Intent Router Strategy: The router is an intent classifier for single-step actions.
      // Once a tool has run and returned an observation, conclude immediately with the result!
      if (hasObservation) {
        return JSON.stringify({ final: lastObservation || "Task completed." });
      }

      const routed = await this.compactEngine.routeToolCall(cleanQuery);
      if (routed && routed.tool_calls && routed.tool_calls.length > 0) {
        return JSON.stringify({
          tool: routed.tool_calls[0].function.name,
          args: JSON.parse(routed.tool_calls[0].function.arguments),
        });
      }
      // If query was not an exact tool match, return final conversational content
      const generalChat = await this.compactEngine.chat(cleanQuery);
      return JSON.stringify({ final: generalChat.content || `Processed: ${cleanQuery}` });
    }

    // Tier 2: SmolLM2 Generative (80 MB Q4 ONNX WebGPU)
    if (this.currentTier === ModelTier.TIER_2_SMOLLM_GENERATIVE) {
      if (hasObservation) {
        return JSON.stringify({ final: lastObservation || "Completed action." });
      }
      if (this.compactEngine?.isGeneratorReady) {
        return await this.compactEngine.generateResponse(cleanQuery, this.tools);
      }
      return JSON.stringify({
        final: `[SmolLM2-135M]: Generative weights are downloading into WebGPU (~80MB). Please wait for initialization.`,
      });
    }

    // Tier 3: Gemma 4 E2B Unified (600-800 MB)
    if (this.currentTier === ModelTier.TIER_3_GEMMA4_E2B) {
      if (hasObservation) {
        return JSON.stringify({ final: lastObservation || "Completed action." });
      }
      if (this.gemmaEngine?.isLoaded) {
        try {
          const msgs = messages || [{ role: "user", content: cleanQuery }];
          const gemmaRes = await this.gemmaEngine.chat(msgs as any, this.tools as any);
          const choice = gemmaRes.choices[0];
          if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
            const tc = choice.message.tool_calls[0];
            return JSON.stringify({
              tool: tc.function.name,
              args: typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments,
            });
          }
          return choice?.message?.content || cleanQuery;
        } catch (err: any) {
          console.warn("Gemma 4 generation error:", err);
          return JSON.stringify({ final: `[Gemma 4 Error]: ${err.message}` });
        }
      }
      return JSON.stringify({
        final: `[Gemma 4 E2B]: Model weights are downloading into WebGPU (~600-800 MB). Please wait for initialization.`,
      });
    }

    return JSON.stringify({ final: "Completed analysis." });
  }

  destroy() {
    this.nanoEngine?.destroy();
    this.gemmaEngine?.unload();
  }
}
