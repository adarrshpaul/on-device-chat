import React from "react";
import { createRoot } from "react-dom/client";
import ChatWidget from "./components/ChatWidget";
import "./index.css";

import type { EngineMode } from "./lib/hybridEngine";
import type { ToolDefinition } from "./lib/types";
import type { GeminiApiConfig } from "./lib/geminiApiEngine";

export interface Gemma4Config {
  /** DOM element ID to mount into (auto-created if missing) */
  containerId?: string;
  /** Engine mode: 'auto' (default: Nano -> Compact), 'gemini-nano', 'compact', 'gemini-api', 'webllm' */
  mode?: EngineMode;
  /** System prompt for the assistant */
  systemPrompt?: string;
  /** Tool definitions the AI can call (function schema) */
  tools?: ToolDefinition[];
  /** Callback when the AI calls a tool — host app executes and returns result */
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Optional Gemini API config (when mode='gemini-api' or for fallback) */
  geminiConfig?: GeminiApiConfig;
  /** Optional WebLLM model ID when using mode='webllm' */
  webllmModelId?: string;
}

class Gemma4AgentImpl {
  private root: ReturnType<typeof createRoot> | null = null;
  private container: HTMLElement | null = null;

  /**
   * Initialize the chat widget.
   * Auto-selects between Chrome Gemini Nano (0 MB), Compact In-Browser Router (~15 MB),
   * or Gemini API.
   */
  init(config: Gemma4Config = {}) {
    if (this.root) {
      console.warn("OnDeviceChat is already initialized.");
      return;
    }

    // Auto-inject CSS stylesheet from jsDelivr if not already present in document
    if (typeof document !== "undefined" && !document.getElementById("on-device-chat-styles")) {
      const link = document.createElement("link");
      link.id = "on-device-chat-styles";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/on-device-chat/dist/style.css";
      document.head.appendChild(link);
    }

    const containerId = config.containerId || "gemma4-widget-root";

    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    this.root = createRoot(this.container);
    this.root.render(
      <React.StrictMode>
        <ChatWidget config={config} />
      </React.StrictMode>
    );
  }

  /** Remove the widget and free memory */
  destroy() {
    if (this.root && this.container) {
      this.root.unmount();
      this.root = null;
      if (this.container.id === "gemma4-widget-root") {
        this.container.remove();
      }
      this.container = null;
    }
  }
}

// Export singleton to global scope for <script> embedding
const instance = new Gemma4AgentImpl();
if (typeof window !== "undefined") {
  (window as any).OnDeviceChat = instance;
  (window as any).Gemma4Agent = instance; // Backwards compatibility
}

// Auto-initialize if script tag has data-auto-init
if (typeof document !== "undefined") {
  const currentScript = document.currentScript;
  if (currentScript && currentScript.hasAttribute("data-auto-init")) {
    const runInit = () => {
      const tierAttr = currentScript.getAttribute("data-tier") as any;
      instance.init(tierAttr ? { mode: tierAttr } : {});
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runInit);
    } else {
      runInit();
    }
  }
}

export default instance;
