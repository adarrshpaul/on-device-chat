/**
 * WebLLM Engine — Runs Gemma 4 E2B entirely in the browser via WebGPU.
 * Provides OpenAI-compatible chat completions with native function calling.
 * Zero backend. Zero API keys. 100% client-side.
 */
import type {
  MLCEngine,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletion,
} from "@mlc-ai/web-llm";

async function getCreateMLCEngine() {
  if (typeof window !== "undefined" && (window as any).webllm?.CreateMLCEngine) {
    return (window as any).webllm.CreateMLCEngine;
  }
  const mod = await import("@mlc-ai/web-llm");
  return mod.CreateMLCEngine;
}
import { extractAllJsonBlocks } from "./harnessDecisionParser";

// Model ID for Gemma 4 E2B Instruct (quantized for browser)
// WebLLM maintains a model registry; this uses the 4-bit quantized variant
const DEFAULT_MODEL = "gemma-2-2b-it-q4f16_1-MLC";

export type ModelLoadProgress = {
  text: string;
  progress: number; // 0-1
};

export type ToolCallResult = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type EngineStatus = "idle" | "loading" | "ready" | "generating" | "error";

export class Gemma4Engine {
  private engine: MLCEngine | null = null;
  private _status: EngineStatus = "idle";
  private _modelId: string;
  private onStatusChange?: (status: EngineStatus) => void;
  private onLoadProgress?: (progress: ModelLoadProgress) => void;

  constructor(
    modelId?: string,
    callbacks?: {
      onStatusChange?: (status: EngineStatus) => void;
      onLoadProgress?: (progress: ModelLoadProgress) => void;
    }
  ) {
    this._modelId = modelId || DEFAULT_MODEL;
    this.onStatusChange = callbacks?.onStatusChange;
    this.onLoadProgress = callbacks?.onLoadProgress;
  }

  get status(): EngineStatus {
    return this._status;
  }

  get isLoaded(): boolean {
    return this._status === "ready";
  }

  private setStatus(s: EngineStatus) {
    this._status = s;
    this.onStatusChange?.(s);
  }

  /** Check if the browser supports WebGPU */
  static isSupported(): boolean {
    return "gpu" in navigator;
  }

  /** Load the model into the browser via WebGPU */
  async load(): Promise<void> {
    if (this.engine) return; // Already loaded

    if (!Gemma4Engine.isSupported()) {
      this.setStatus("error");
      throw new Error(
        "WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+."
      );
    }

    this.setStatus("loading");

    try {
      const CreateMLCEngine = await getCreateMLCEngine();
      this.engine = await CreateMLCEngine(this._modelId, {
        initProgressCallback: (report: any) => {
          this.onLoadProgress?.({
            text: report.text,
            progress: report.progress,
          });
        },
      });
      this.setStatus("ready");
    } catch (err) {
      this.setStatus("error");
      throw err;
    }
  }

  /**
   * Send a chat completion request with optional tool definitions.
   * Returns the full response (non-streaming).
   *
   * This implements the function-calling loop:
   * 1. Send messages + tools to Gemma 4
   * 2. If response has tool_calls → return them for the host app to execute
   * 3. Host app sends results back → feed into next round
   * 4. Repeat until model returns a text response
   */
  async chat(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[]
  ): Promise<ChatCompletion> {
    if (!this.engine) {
      throw new Error("Engine not loaded. Call load() first.");
    }

    this.setStatus("generating");

    try {
      const isHermes = this._modelId.toLowerCase().includes("hermes");
      const formattedMessages: ChatCompletionMessageParam[] = [...messages];

      if (tools && tools.length > 0 && !isHermes) {
        const toolsPrompt = `\nYou have access to the following tools:\n${JSON.stringify(tools, null, 2)}\nWhen calling a tool, reply with ONLY a JSON object: {"tool": "<tool_name>", "args": {<arguments>}} or {"final": "<message>"}.\nDo not use placeholder dots.`;
        const sysIdx = formattedMessages.findIndex(m => m.role === "system");
        if (sysIdx >= 0) {
          const sysMsg = formattedMessages[sysIdx];
          formattedMessages[sysIdx] = {
            ...sysMsg,
            content: (typeof sysMsg.content === "string" ? sysMsg.content : "") + toolsPrompt,
          };
        } else {
          formattedMessages.unshift({
            role: "system",
            content: toolsPrompt,
          });
        }
      }

      const response = await this.engine.chat.completions.create({
        messages: formattedMessages,
        tools: isHermes && tools && tools.length > 0 ? tools : undefined,
        temperature: 0.2,
        top_p: 0.95,
        max_tokens: 1024,
      });

      const choice = (response as any).choices?.[0];
      if (choice?.message && !choice.message.tool_calls && !isHermes) {
        const content = choice.message.content || "";
        const jsonBlocks = extractAllJsonBlocks(content);
        for (const block of jsonBlocks) {
          try {
            const parsed = JSON.parse(block);
            const toolName = parsed.tool || parsed.tool_call?.name || parsed.name;
            if (toolName && toolName !== "..." && !toolName.includes("...") && !toolName.startsWith("<")) {
              choice.message.tool_calls = [
                {
                  id: `call_${Date.now()}`,
                  type: "function",
                  function: {
                    name: toolName,
                    arguments: JSON.stringify(parsed.args || parsed.tool_call?.arguments || {}),
                  },
                },
              ];
              break;
            }
          } catch {}
        }
      }

      this.setStatus("ready");
      return response as ChatCompletion;
    } catch (err) {
      this.setStatus("ready");
      throw err;
    }
  }

  /**
   * Stream a chat completion. Yields content chunks as they arrive.
   * Note: Streaming + tool_calls is complex; for tool calls we fall back
   * to non-streaming to get the full structured response.
   */
  async *chatStream(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[]
  ): AsyncGenerator<string, void, unknown> {
    if (!this.engine) {
      throw new Error("Engine not loaded. Call load() first.");
    }

    // If tools are provided, use non-streaming (tool calls need complete response)
    if (tools && tools.length > 0) {
      const response = await this.chat(messages, tools);
      const msg = response.choices[0]?.message;
      if (msg?.content) {
        yield msg.content;
      }
      return;
    }

    this.setStatus("generating");

    try {
      const stream = await this.engine.chat.completions.create({
        messages,
        temperature: 1.0,
        top_p: 0.95,
        max_tokens: 1024,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      }
    } finally {
      this.setStatus("ready");
    }
  }

  /** Reset the chat (clear KV cache) */
  async reset(): Promise<void> {
    if (this.engine) {
      this.engine.resetChat();
    }
  }

  /** Unload the model and free GPU memory */
  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.setStatus("idle");
    }
  }
}
