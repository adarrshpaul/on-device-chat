/**
 * Hybrid Engine Orchestrator
 *
 * Supports 4 modes tailored for minimal size:
 * 1. 'gemini-nano': Chrome Built-in on-device Gemini Nano (0 MB download!)
 * 2. 'compact': Tier 1 Semantic Router (~15MB) + Tier 2 SmolLM2 (~80MB) in browser via Transformers.js
 * 3. 'gemini-api': Cloud Gemini 1.5/2.0 Flash (0 MB download)
 * 4. 'webllm': Gemma 4 / Gemma 2B via WebLLM WebGPU
 * 5. 'auto' (Default): Automatically selects Nano if available, else Compact (~15MB).
 */
import { GeminiNanoEngine } from "./geminiNanoEngine";
import { CompactEngine, LoadProgressCallback } from "./compactEngine";
import { GeminiApiEngine, GeminiApiConfig } from "./geminiApiEngine";
import { Gemma4Engine } from "./engine";
import type { ToolDefinition, EngineChatResponse } from "./types";

export type EngineMode = "auto" | "gemini-nano" | "compact" | "gemini-api" | "webllm";

export interface HybridEngineConfig {
  mode?: EngineMode;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  geminiConfig?: GeminiApiConfig;
  webllmModelId?: string;
  onProgress?: LoadProgressCallback;
  onActiveEngineChange?: (activeEngine: string) => void;
}

export class HybridEngine {
  private mode: EngineMode;
  private activeEngineName: string = "initializing";
  private nanoEngine?: GeminiNanoEngine;
  private compactEngine?: CompactEngine;
  private apiEngine?: GeminiApiEngine;
  private webllmEngine?: Gemma4Engine;
  private tools: ToolDefinition[] = [];
  private systemPrompt?: string;
  private config: HybridEngineConfig;

  constructor(config: HybridEngineConfig) {
    this.config = config;
    this.mode = config.mode || "auto";
    this.tools = config.tools || [];
    this.systemPrompt = config.systemPrompt;
  }

  get activeEngine(): string {
    return this.activeEngineName;
  }

  async init(): Promise<void> {
    const onProgress = this.config.onProgress;

    // Mode 1: Explicit Gemini API
    if (this.mode === "gemini-api" || (this.mode === "auto" && this.config.geminiConfig?.apiKey)) {
      this.apiEngine = new GeminiApiEngine(this.config.geminiConfig);
      this.activeEngineName = "Gemini Cloud API (0 MB)";
      this.config.onActiveEngineChange?.(this.activeEngineName);
      onProgress?.({ text: "Connected to Gemini API", progress: 1.0 });
      return;
    }

    // Mode 2: Chrome Built-in Gemini Nano (0 MB)
    if (this.mode === "gemini-nano" || this.mode === "auto") {
      const isNanoSupported = await GeminiNanoEngine.isSupported();
      if (isNanoSupported) {
        onProgress?.({ text: "Checking Chrome Built-in Gemini Nano (0 MB)...", progress: 0.5 });
        const nano = new GeminiNanoEngine();
        const success = await nano.init(this.systemPrompt, this.tools);
        if (success) {
          this.nanoEngine = nano;
          this.activeEngineName = "Gemini Nano (0 MB on-device)";
          this.config.onActiveEngineChange?.(this.activeEngineName);
          onProgress?.({ text: "Gemini Nano ready", progress: 1.0 });
          return;
        }
      }
      if (this.mode === "gemini-nano") {
        console.warn("Gemini Nano not enabled in this browser. Falling back to Compact In-Browser Engine.");
      }
    }

    // Mode 3: Explicit WebLLM (Gemma 4 ~800MB)
    if (this.mode === "webllm") {
      this.webllmEngine = new Gemma4Engine(this.config.webllmModelId, {
        onLoadProgress: (p) => onProgress?.({ text: p.text, progress: p.progress }),
      });
      await this.webllmEngine.load();
      this.activeEngineName = "Gemma 4 WebLLM";
      this.config.onActiveEngineChange?.(this.activeEngineName);
      return;
    }

    // Mode 4: Compact Engine (~15MB Tier 1 Semantic Tool Router)
    this.compactEngine = new CompactEngine();
    await this.compactEngine.initEmbedder(onProgress);
    this.activeEngineName = "Compact Router (~15 MB in-browser)";
    this.config.onActiveEngineChange?.(this.activeEngineName);
  }

  async chat(messages: Array<{ role: string; content?: string }>): Promise<EngineChatResponse> {
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";

    if (this.apiEngine) {
      return await this.apiEngine.chat(messages, this.tools, this.systemPrompt);
    }

    if (this.nanoEngine) {
      return await this.nanoEngine.chat(lastUserMsg);
    }

    if (this.webllmEngine) {
      const res = await this.webllmEngine.chat(messages as any, this.tools as any);
      const choice = res.choices[0];
      return {
        content: choice?.message?.content || undefined,
        tool_calls: choice?.message?.tool_calls?.map((tc: any) => ({
          id: tc.id || `call_${Date.now()}`,
          type: "function",
          function: {
            name: tc.function.name,
            arguments: typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments),
          }
        }))
      };
    }

    if (this.compactEngine) {
      const { answerFromPage } = await import("./pageQA");
      const res = await answerFromPage(lastUserMsg, this.compactEngine);
      return { content: res.text };
    }

    throw new Error("No active AI engine available");
  }

  destroy() {
    this.nanoEngine?.destroy();
    this.webllmEngine?.unload();
  }
}
