/**
 * Core Shared Types for Gemma 4 Chat Agent
 */

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface EngineChatResponse {
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export enum ModelTier {
  TIER_0_GEMINI_NANO = 0,
  TIER_1_MINILM_ROUTER = 1,
  TIER_1_5_LAYA_DECISION = 2,
  TIER_2_SMOLLM_GENERATIVE = 3,
  TIER_3_GEMMA4_E2B = 4,
}

export interface TierInfo {
  tier: ModelTier;
  name: string;
  size: string;
  description: string;
  badgeColor: string;
}

export const DEFAULT_BROWSER_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "click",
      description: "Click an interactive element (button, link, tab, control) on the current web page.",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector of the element to click (e.g. '#submit-btn', 'button.checkout', 'a.nav-link').",
          },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "type",
      description: "Type text into an input field or textarea on the page.",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector of the input field or textarea.",
          },
          value: {
            type: "string",
            description: "Text value to type into the input field.",
          },
        },
        required: ["selector", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scroll",
      description: "Scroll the page viewport up or down or scroll an element into view.",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["down", "up"],
            description: "Scroll direction: 'down' or 'up'.",
          },
          amount: {
            type: "number",
            description: "Scroll pixel amount (default 500).",
          },
          selector: {
            type: "string",
            description: "Optional element CSS selector to scroll into view.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigate browser to a path, URL, or anchor on the page.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Target URL, hash anchor, or path.",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inspect",
      description: "Inspect an element's attributes, text, and visibility state.",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector of element to inspect.",
          },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browse",
      description: "Universal browser interaction primitive: click, type, scroll, inspect, overview, snapshot, or see.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["click", "type", "scroll", "inspect", "snapshot", "overview", "see", "navigate", "hover", "tour"],
            description: "Action to execute.",
          },
          selector: { type: "string" },
          value: { type: "string" },
          direction: { type: "string" },
          url: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tour",
      description: "Take the user on an interactive guided tour of the website, navigating through all major landmarks.",
      parameters: {
        type: "object",
        properties: {
          focus: {
            type: "string",
            description: "Optional specific section to highlight first (e.g. 'projects', 'overview', 'skills').",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description: "Search the page DOM for text, headings, buttons, products, or sections.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keyword or query to search for on the page.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sandbox",
      description: "Evaluate pure math formulas or isolated JavaScript expressions (e.g. 15 * 4.2). No DOM access.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Pure JS expression or math calculation returning a value.",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read",
      description: "Read text from scratchpad notes or memory.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string" },
        },
        required: ["target"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description: "Write notes or scratchpad items.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string" },
          content: { type: "string" },
        },
        required: ["target", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask",
      description: "Ask the user a clarifying question when a request is ambiguous.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
        },
        required: ["question"],
      },
    },
  },
];

export interface DecisionAlternative {
  label: string;
  score: number; // 0.0 to 1.0 (calibrated probability)
  actionPayload?: { tool: string; args?: Record<string, unknown> };
  isWinner?: boolean;
}

export interface DecisionTrace {
  type: "macro" | "system1_gate" | "semantic_route" | "model_decision";
  title: string;
  selectedOption: string;
  confidence: number; // 0.0 to 1.0
  latencyMs?: number;
  engineUsed?: string;
  distribution?: DecisionAlternative[];
  needsClarification?: boolean;
  margin?: number; // Margin between top-1 and top-2 candidate probability
  primitive?: "choice" | "noul" | "score";
  hallucinationShield?: {
    verified: boolean;
    check: string;
    evidenceSelector?: string;
    probability: number;
  };
  explanation?: string;
}
