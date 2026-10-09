/**
 * Gemini Nano Engine — Latest Official Chrome Built-in AI Specification
 * Ref: https://developer.chrome.com/docs/ai/built-in & https://developer.chrome.com/docs/ai/prompt-api-polyfill
 *
 * Uses native Chrome Prompt API (LanguageModel / window.ai.languageModel) when available (0 MB download).
 * If not present, dynamically imports Google's official `prompt-api-polyfill`!
 */
import type { ToolDefinition, EngineChatResponse } from "./types";

export type NanoAvailability = "readily" | "downloadable" | "downloading" | "no" | "unsupported";

export class GeminiNanoEngine {
  private session: any = null;

  static async ensurePolyfill(): Promise<void> {
    if (typeof window === "undefined") return;
    const win = window as any;
    if (!win.LanguageModel && !win.ai?.languageModel) {
      try {
        const polyfillUrl = "https://esm.run/prompt-api-polyfill";
        await import(/* @vite-ignore */ polyfillUrl);
      } catch {
        // Gracefully cascade to Tier 1 MiniLM Router
      }
    }
  }

  static getApi(): any {
    if (typeof window === "undefined") return null;
    const win = window as any;
    return win.ai?.languageModel || win.LanguageModel || win.ai?.assistant || null;
  }

  /**
   * Check Gemini Nano availability per latest official Chrome docs.
   */
  static async checkAvailability(): Promise<{
    status: NanoAvailability;
    detail: string;
  }> {
    if (typeof window === "undefined") {
      return { status: "unsupported", detail: "SSR / No window context" };
    }

    await GeminiNanoEngine.ensurePolyfill();
    const api = GeminiNanoEngine.getApi();

    if (!api) {
      return {
        status: "unsupported",
        detail: "Built-in AI API not detected. Requires Chrome 128+ with flags enabled (see chrome://flags/#prompt-api-for-gemini-nano).",
      };
    }

    try {
      let availability: any = null;
      if (typeof api.availability === "function") {
        availability = await api.availability();
      } else if (typeof api.capabilities === "function") {
        const caps = await api.capabilities();
        availability = caps?.available;
      }

      const statusStr = typeof availability === "string" ? availability.toLowerCase() : "unsupported";

      if (statusStr === "readily" || statusStr === "available") {
        return { status: "readily", detail: "Gemini Nano is downloaded and ready to execute on-device (0 MB)." };
      }
      if (statusStr === "downloadable" || statusStr === "after-download") {
        return { status: "downloadable", detail: "Gemini Nano is available to download. Creating a session will trigger on-device download." };
      }
      if (statusStr === "downloading") {
        return { status: "downloading", detail: "Gemini Nano is currently downloading in the background." };
      }
      if (statusStr === "no") {
        return { status: "no", detail: "Device does not meet hardware requirements (>22GB free disk space & >4GB VRAM)." };
      }

      return { status: "unsupported", detail: `Availability status: ${statusStr}` };
    } catch (e: any) {
      return { status: "unsupported", detail: e?.message || "Failed checking availability" };
    }
  }

  static async isSupported(): Promise<boolean> {
    const { status } = await GeminiNanoEngine.checkAvailability();
    return status === "readily" || status === "downloadable" || status === "downloading";
  }

  /**
   * Create an on-device Gemini Nano session with download progress monitor
   */
  async init(
    systemPrompt?: string,
    tools?: ToolDefinition[],
    onDownloadProgress?: (percent: number) => void
  ): Promise<boolean> {
    await GeminiNanoEngine.ensurePolyfill();
    const api = GeminiNanoEngine.getApi();
    if (!api) return false;

    const defaultMobilePrompt =
      "You are a mobile-friendly on-device assistant embedded in this web application. One job per turn.\n" +
      "Reply rules:\n" +
      "1. Result first. Direct answer in line 1 (1–3 lines).\n" +
      "2. Context second, only if it changes the user's next tap.\n" +
      "3. Budget: 40–120 words. No filler, no empathy padding, no restating user's question, no closing pleasantries.\n" +
      "4. At most one question or one next step per turn.\n" +
      "5. If presenting choices, write 2–4 short numbered items so they can render as action chips.\n" +
      "6. Confirm before committing destructive, paid, or external actions.\n" +
      "7. Say what you cannot do in one line.";
    let sys = systemPrompt || defaultMobilePrompt;
    if (tools && tools.length > 0) {
      sys += `\n\nYou have access to the following tools to control the host app:\n` +
        JSON.stringify(tools, null, 2) +
        `\n\nWhen a tool is needed, you MUST output valid JSON format:\n{"tool_call": {"name": "toolName", "arguments": { ... }}}\nOtherwise output standard conversational text.`;
    }

    try {
      this.session = await api.create({
        systemPrompt: sys,
        monitor(m: any) {
          m.addEventListener("downloadprogress", (e: any) => {
            const pct = Math.round((e.loaded / (e.total || 1)) * 100);
            onDownloadProgress?.(pct);
          });
        },
      });
      return true;
    } catch (e) {
      console.warn("Gemini Nano session creation failed:", e);
      return false;
    }
  }

  async chat(prompt: string): Promise<EngineChatResponse> {
    if (!this.session) {
      throw new Error("Gemini Nano session not initialized");
    }

    const rawResponse = await this.session.prompt(prompt);
    const trimmed = rawResponse.trim();

    // Check for JSON tool_call
    try {
      const jsonMatch = trimmed.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool_call?.name) {
          return {
            content: trimmed.replace(jsonMatch[0], "").trim() || undefined,
            tool_calls: [
              {
                id: `call_${Date.now()}`,
                type: "function",
                function: {
                  name: parsed.tool_call.name,
                  arguments: typeof parsed.tool_call.arguments === "string"
                    ? parsed.tool_call.arguments
                    : JSON.stringify(parsed.tool_call.arguments || {}),
                },
              },
            ],
          };
        }
      }
    } catch {
      // Treat as plain text response
    }

    return { content: trimmed };
  }

  /**
   * Direct raw text generation for harness loops and expert judging
   */
  async promptRaw(prompt: string): Promise<string> {
    if (!this.session) {
      throw new Error("Gemini Nano session not initialized");
    }
    return await this.session.prompt(prompt);
  }

  destroy() {
    if (this.session && typeof this.session.destroy === "function") {
      this.session.destroy();
      this.session = null;
    }
  }
}
