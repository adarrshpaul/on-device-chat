import React from "react";
import { createRoot } from "react-dom/client";
import ChatWidget from "./components/ChatWidget";
import "./index.css";

import type { EngineMode } from "./lib/hybridEngine";
import type { ToolDefinition } from "./lib/types";
import type { GeminiApiConfig } from "./lib/geminiApiEngine";
import { A11yTreeEngine } from "./lib/a11yTree";
import { SomOverlayManager } from "./lib/somOverlay";
import { ActionDispatcher } from "./lib/actionDispatcher";
import { StateDeltaVerifier } from "./lib/stateDeltaVerifier";
import { AgentHarness } from "./lib/agentHarness";

export interface Gemma4Config {
  /** DOM element ID to mount into (auto-created if missing) */
  containerId?: string;
  /** Whether the chat widget starts open (defaults to true when data-auto-init is used) */
  defaultOpen?: boolean;
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
Object.assign(instance, {
  A11yTreeEngine,
  SomOverlayManager,
  ActionDispatcher,
  StateDeltaVerifier,
  AgentHarness
});

if (typeof window !== "undefined") {
  (window as any).OnDeviceChat = instance;
  (window as any).Gemma4Agent = instance; // Backwards compatibility
  (window as any).A11yTreeEngine = A11yTreeEngine;
  (window as any).SomOverlayManager = SomOverlayManager;
  (window as any).ActionDispatcher = ActionDispatcher;
  (window as any).StateDeltaVerifier = StateDeltaVerifier;
  (window as any).AgentHarness = AgentHarness;

  /**
   * Standard Web Component Custom Element: <on-device-chat>
   * Implements Shadow DOM and Slots per W3C Web Components specifications:
   * - <slot name="header"> : Custom branded header slot
   * - <slot name="launcher"> : Custom floating trigger button slot
   * - Encapsulates styles and DOM tree from host framework collisions
   */
  if (typeof customElements !== "undefined" && !customElements.get("on-device-chat")) {
    class OnDeviceChatElement extends HTMLElement {
      private shadow: ShadowRoot;
      private mountPoint: HTMLDivElement;
      private reactRoot: ReturnType<typeof createRoot> | null = null;

      constructor() {
        super();
        this.shadow = this.attachShadow({ mode: "open" });

        // Slot projection container
        this.shadow.innerHTML = `
          <style>
            :host {
              display: block;
              position: relative;
              z-index: 999999;
            }
          </style>
          <div id="shadow-mount-point"></div>
        `;
        this.mountPoint = this.shadow.querySelector("#shadow-mount-point") as HTMLDivElement;
      }

      connectedCallback() {
        const defaultOpen = this.getAttribute("default-open") === "true";
        const mode = (this.getAttribute("tier") || this.getAttribute("mode")) as any;

        // Inject widget stylesheet into ShadowRoot
        const link = document.createElement("link");
        link.rel = "stylesheet";
        const externalStyle = document.getElementById("on-device-chat-styles") as HTMLLinkElement;
        link.href = externalStyle?.href || "https://cdn.jsdelivr.net/npm/on-device-chat/dist/style.css";
        this.shadow.appendChild(link);

        this.reactRoot = createRoot(this.mountPoint);
        this.reactRoot.render(
          <React.StrictMode>
            <ChatWidget
              config={{
                defaultOpen,
                mode,
              }}
            />
          </React.StrictMode>
        );
      }

      disconnectedCallback() {
        if (this.reactRoot) {
          this.reactRoot.unmount();
          this.reactRoot = null;
        }
      }
    }

    customElements.define("on-device-chat", OnDeviceChatElement);
  }
}

// Auto-initialize if script tag has data-auto-init
if (typeof document !== "undefined") {
  const getScriptTag = () =>
    document.currentScript || document.querySelector("script[data-auto-init]");

  const scriptEl = getScriptTag();
  if (scriptEl && scriptEl.hasAttribute("data-auto-init")) {
    const runInit = () => {
      const activeEl = getScriptTag() || scriptEl;
      const tierAttr = activeEl?.getAttribute("data-tier") as any;
      const openAttr = activeEl?.getAttribute("data-open");
      const defaultOpen = openAttr === "false" ? false : true; // Default to open so chat assistant is immediately visible
      instance.init({
        mode: tierAttr || undefined,
        defaultOpen: defaultOpen,
      });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runInit);
    } else {
      runInit();
    }
  }
}

export default instance;
