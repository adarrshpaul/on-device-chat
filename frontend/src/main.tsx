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
import { MacroRecorder } from "./lib/macroRecorder";
import { BatchRunner, EntityExtractor, BatchProposalManager } from "./lib/batchEngine";
import { WorkflowPredictor } from "./lib/workflowPredictor";
import { WorkflowRunner, workflowRunner } from "./lib/workflowRunner";
import { UISpecEngine } from "./lib/uiSpecEngine";
import { decisionScorerRegistry, VegaOnDeviceScorer, D3NanoDecisionScorer } from "./lib/decisionScorer";
import { SafetyGate, type PermissionMode } from "./lib/safetyGate";

export interface EdgeOperatorConfig {
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
  /** Optional WebLLm model ID when using mode='webllm' */
  webllmModelId?: string;
}

export type Gemma4Config = EdgeOperatorConfig;

const EDGE_OPERATOR_VERSION = "0.2.0";

function getStyleHref(): string {
  if (typeof document !== "undefined") {
    const existing = document.getElementById("edge-operator-styles") || document.getElementById("on-device-chat-styles");
    if (existing && (existing as HTMLLinkElement).href) return (existing as HTMLLinkElement).href;
    const curScript = document.currentScript as HTMLScriptElement | null;
    if (curScript?.src) {
      try {
        const u = new URL(curScript.src);
        return new URL("style.css", u).href;
      } catch {}
    }
  }
  return `https://cdn.jsdelivr.net/npm/on-device-chat@${EDGE_OPERATOR_VERSION}/dist/style.css`;
}

class EdgeOperatorImpl {
  readonly version = EDGE_OPERATOR_VERSION;
  private root: ReturnType<typeof createRoot> | null = null;
  private container: HTMLElement | null = null;

  /**
   * Initialize the chat widget.
   * Auto-selects between Chrome Gemini Nano (0 MB), Compact In-Browser Router (~15 MB),
   * or Gemini API.
   */
  init(config: EdgeOperatorConfig = {}) {
    if (this.root) {
      console.warn("EdgeOperator is already initialized.");
      return;
    }

    // Auto-inject CSS stylesheet if not already present in document
    if (typeof document !== "undefined" && !document.getElementById("edge-operator-styles") && !document.getElementById("on-device-chat-styles")) {
      const link = document.createElement("link");
      link.id = "edge-operator-styles";
      link.rel = "stylesheet";
      link.href = getStyleHref();
      document.head.appendChild(link);
    }

    const containerId = config.containerId || "edge-operator-root";

    this.container = document.getElementById(containerId) || document.getElementById("gemma4-widget-root");
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

  /** Open the agent widget with optional target panel */
  open(options?: { panel?: "chat" | "workflows" }) {
    if (!this.root) {
      this.init({ defaultOpen: true });
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("eo:open", { detail: options || {} }));
    }
  }

  /** Close the agent widget */
  close() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("eo:close"));
    }
  }

  /** Remove the widget and free memory */
  destroy() {
    if (this.root && this.container) {
      this.root.unmount();
      this.root = null;
      if (this.container.id === "edge-operator-root" || this.container.id === "gemma4-widget-root") {
        this.container.remove();
      }
      this.container = null;
    }
  }
}

// Export singleton to global scope for <script> embedding
const instance = new EdgeOperatorImpl();
Object.assign(instance, {
  A11yTreeEngine,
  SomOverlayManager,
  ActionDispatcher,
  StateDeltaVerifier,
  AgentHarness,
  MacroRecorder,
  BatchRunner,
  EntityExtractor,
  BatchProposalManager,
  WorkflowPredictor,
  WorkflowRunner,
  workflowRunner,
  UISpecEngine,
  decisionScorerRegistry,
  VegaOnDeviceScorer,
  D3NanoDecisionScorer,
  setPermissionMode: (mode: PermissionMode) => SafetyGate.setPermissionMode(mode),
});

if (typeof window !== "undefined") {
  (window as any).EdgeOperator = instance;
  (window as any).OnDeviceChat = instance;
  (window as any).Gemma4Agent = instance; // Backwards compatibility
  (window as any).A11yTreeEngine = A11yTreeEngine;
  (window as any).SomOverlayManager = SomOverlayManager;
  (window as any).ActionDispatcher = ActionDispatcher;
  (window as any).StateDeltaVerifier = StateDeltaVerifier;
  (window as any).AgentHarness = AgentHarness;
  (window as any).MacroRecorder = MacroRecorder;
  (window as any).BatchRunner = BatchRunner;
  (window as any).EntityExtractor = EntityExtractor;
  (window as any).BatchProposalManager = BatchProposalManager;
  (window as any).WorkflowPredictor = WorkflowPredictor;
  (window as any).WorkflowRunner = WorkflowRunner;
  (window as any).workflowRunner = workflowRunner;
  (window as any).UISpecEngine = UISpecEngine;
  (window as any).decisionScorerRegistry = decisionScorerRegistry;
  (window as any).VegaOnDeviceScorer = VegaOnDeviceScorer;
  (window as any).D3NanoDecisionScorer = D3NanoDecisionScorer;

  /**
   * Standard Web Component Custom Element: <edge-operator> and <on-device-chat>
   * Implements Shadow DOM and Slots per W3C Web Components specifications:
   * - <slot name="header"> : Custom branded header slot
   * - <slot name="launcher"> : Custom floating trigger button slot
   * - Encapsulates styles and DOM tree from host framework collisions
   */
  if (
    typeof customElements !== "undefined" &&
    customElements !== null &&
    typeof customElements.get === "function" &&
    typeof HTMLElement !== "undefined"
  ) {
    class EdgeOperatorElement extends HTMLElement {
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
            z-index: 2147483647;
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
      const externalStyle = document.getElementById("edge-operator-styles") || document.getElementById("on-device-chat-styles");
      if (externalStyle && externalStyle.tagName === "STYLE" && externalStyle.textContent) {
        const styleEl = document.createElement("style");
        styleEl.textContent = externalStyle.textContent;
        this.shadow.appendChild(styleEl);
      } else {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = (externalStyle as HTMLLinkElement)?.href || getStyleHref();
        this.shadow.appendChild(link);
      }

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

    if (!customElements.get("edge-operator")) {
      customElements.define("edge-operator", EdgeOperatorElement);
    }
    if (!customElements.get("on-device-chat")) {
      customElements.define("on-device-chat", class extends EdgeOperatorElement {});
    }
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
