/**
 * Gemini Cloud API Engine
 * Allows invoking Google Gemini models (Gemini 1.5/2.0 Flash) with native function calling
 * with 0 MB download on the client side.
 */
import type { ToolDefinition, EngineChatResponse } from "./types";

export interface GeminiApiConfig {
  apiKey?: string;
  apiProxyUrl?: string;
  model?: string;
}

export class GeminiApiEngine {
  private apiKey: string = "";
  private proxyUrl: string = "";
  private model: string = "gemini-2.0-flash";

  constructor(config?: GeminiApiConfig) {
    if (config?.apiKey) this.apiKey = config.apiKey;
    if (config?.apiProxyUrl) this.proxyUrl = config.apiProxyUrl;
    if (config?.model) this.model = config.model;
  }

  async chat(
    messages: Array<{ role: string; content?: string }>,
    tools?: ToolDefinition[],
    systemPrompt?: string
  ): Promise<EngineChatResponse> {
    const geminiTools = tools && tools.length > 0 ? [{
      functionDeclarations: tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }))
    }] : undefined;

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }]
    }));

    const body: any = {
      contents,
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    };

    if (geminiTools) {
      body.tools = geminiTools;
    }

    const endpoint = this.proxyUrl || 
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part?.functionCall) {
      return {
        tool_calls: [
          {
            id: `call_${Date.now()}`,
            type: "function",
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            }
          }
        ]
      };
    }

    return {
      content: part?.text || "No response received."
    };
  }
}
