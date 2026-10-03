/**
 * Re-exports from engine.ts + legacy type compatibility.
 * The old api.ts talked to a backend — now everything runs in-browser.
 */

export type { ChatCompletionMessageParam as Message } from "@mlc-ai/web-llm";
export type { ChatCompletionTool as ToolDefinition } from "@mlc-ai/web-llm";

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export { Gemma4Engine } from "./engine";
export type { ModelLoadProgress, EngineStatus } from "./engine";
