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

export interface ElementRef {
  a11yId?: string;
  selector: string;
  fingerprint?: string;
  role?: string;
  label?: string;
}

export type UISpec =
  | {
      kind: "confirm";
      id: string;
      title: string;
      description?: string;
      action: {
        tool: "click" | "type" | "select" | "scroll" | "navigate";
        ref: ElementRef;
        value?: string;
        repeatCount?: number;
      };
    }
  | {
      kind: "batchPreview";
      id: string;
      title: string;
      summary?: string;
      columns: string[];
      rows: Array<{
        id: string;
        ref: ElementRef;
        cells: string[];
        selected: boolean;
        status?: "pending" | "running" | "success" | "error";
      }>;
    }
  | {
      kind: "paramForm";
      id: string;
      title: string;
      description?: string;
      targetRef?: ElementRef;
      submitLabel?: string;
      fields: Array<{
        name: string;
        label: string;
        type: "text" | "number" | "enum" | "boolean";
        ref?: ElementRef;
        defaultValue?: string | number | boolean;
        options?: string[];
        min?: number;
        max?: number;
        required?: boolean;
      }>;
    }
  | {
      kind: "choices";
      id: string;
      prompt: string;
      options: Array<{
        id: string;
        label: string;
        description?: string;
        score?: number; // 0.0 to 1.0 calibrated probability
        ref?: ElementRef;
        actionPayload?: { tool: string; args?: Record<string, unknown> };
      }>;
    };

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
  ui?: UISpec[];
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
  specialty?: string;
  speedProfile?: string;
  bestFor?: string;
  isRecommended?: boolean;
}

export const DEFAULT_BROWSER_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "click",
      description: "Click an interactive element (button, link, tab, control) on the page by its numeric ID [1..N] or CSS selector.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "number",
            description: "Numeric badge ID [1..N] of the element to click (preferred), or CSS selector.",
          },
          selector: {
            type: "string",
            description: "CSS selector of the element to click (e.g. '#submit-btn', 'button.checkout', 'a.nav-link').",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "type",
      description: "Type text into an input field or textarea on the page by its numeric ID [1..N] or CSS selector.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "number",
            description: "Numeric badge ID [1..N] of the input field (preferred), or CSS selector.",
          },
          selector: {
            type: "string",
            description: "CSS selector of the input field or textarea.",
          },
          value: {
            type: "string",
            description: "Text value to type into the input field.",
          },
          enter: {
            type: "boolean",
            description: "Press Enter key after typing.",
          },
        },
        required: ["value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "select",
      description: "Select an option from a dropdown element by its numeric ID [1..N] or CSS selector.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "number",
            description: "Numeric badge ID [1..N] of the select element (preferred), or CSS selector.",
          },
          selector: {
            type: "string",
            description: "CSS selector of the select element.",
          },
          value: {
            type: "string",
            description: "Option text or value to select.",
          },
        },
        required: ["value"],
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
            enum: ["click", "type", "scroll", "inspect", "snapshot", "overview", "see", "navigate", "hover", "tour", "play_game"],
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
      name: "playGame",
      description: "Autonomous real-time gameplay controller for Canvas/WebGL/Phaser games. Runs continuous high-frequency physics and action loop to play the game and maximize score.",
      parameters: {
        type: "object",
        properties: {
          durationSec: {
            type: "number",
            description: "Number of seconds to play (default 30, max 65).",
          },
          targetScore: {
            type: "number",
            description: "Target score threshold to reach.",
          },
        },
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
      description: "Evaluate an arithmetic expression (e.g. 15 * 4.2, Math.round(context.price * 1.18)). Not JavaScript: numbers, + - * / % **, comparisons, && || !, ternary a ? b : c, Math.fn(...) (round, floor, ceil, abs, min, max, sqrt, pow, log, exp, trig), and numeric context.field values. No strings, arrays, objects, variables or statements.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Arithmetic expression returning a number or boolean.",
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

export interface EnsembleModelVote {
  modelName: string; // e.g. "Laya System 1", "MiniLM-L6 Router", "Gemini Nano", "SmolLM2"
  role: "fast_reflex" | "semantic_vector" | "system2_verifier";
  selectedChoice: string;
  confidence: number; // 0.0 to 1.0
  rationale?: string;
}

export interface EnsembleConsensus {
  modelsUsed: string[];
  votes: EnsembleModelVote[];
  consensusWinner: string;
  consensusConfidence: number; // Calibrated ensemble score
  agreementRatio: number; // 0.0 to 1.0
  margin: number;
}

export interface ActionExecutionOutput {
  id: string;
  action: string;
  target: string;
  status: "success" | "error";
  domDelta?: {
    beforeState?: string;
    afterState?: string;
    description: string;
  };
  durationMs: number;
  outputSummary: string;
  timestamp: number;
}

export interface WorkflowStep {
  id: string;
  title: string;
  action: "tour" | "click" | "scroll" | "type" | "select" | "teleport" | "wait" | "verify" | "game_autopilot";
  target?: string;
  value?: string;
  /** For type action: press Enter key after typing */
  pressEnter?: boolean;
  delayMs?: number;
  /** For click action: how many times to click (default 1) */
  repeatCount?: number;
  /** For click action: pause between repeated clicks in ms (default 400) */
  repeatIntervalMs?: number;
  status?: "idle" | "running" | "success" | "error";
  output?: string;
}

export const MAX_CLICK_REPEAT = 50;
export const DEFAULT_REPEAT_INTERVAL_MS = 400;

/** Effective click count for a step (always 1 for non-click actions) */
export function clickRepeatCount(step: Pick<WorkflowStep, "action" | "repeatCount">): number {
  if (step.action !== "click") return 1;
  return Math.min(MAX_CLICK_REPEAT, Math.max(1, Math.floor(step.repeatCount ?? 1)));
}

export interface WebWorkflow {
  id: string;
  name: string;
  description: string;
  siteOrigin: string;
  steps: WorkflowStep[];
  triggerPhrase?: string;
  executionCount: number;
  createdAt: number;
  lastRunAt?: number;
  tags?: string[];
  isSystemStarter?: boolean;
}

export interface DecisionTrace {
  type: "macro" | "system1_gate" | "semantic_route" | "model_decision" | "ensemble_consensus";
  title: string;
  selectedOption: string;
  confidence: number; // 0.0 to 1.0
  latencyMs?: number;
  engineUsed?: string;
  distribution?: DecisionAlternative[];
  needsClarification?: boolean;
  margin?: number; // Margin between top-1 and top-2 candidate probability
  primitive?: "choice" | "noul" | "score" | "boolean";
  hallucinationShield?: {
    verified: boolean;
    check: string;
    evidenceSelector?: string;
    probability: number;
  };
  ensemble?: EnsembleConsensus;
  executableAction?: {
    tool: string;
    args: Record<string, unknown>;
  };
  vegaMetrics?: {
    kineticEnergy: number;
    settleSteps: number;
    conformalSet: string[];
    abstain: boolean;
    unbound: boolean;
    tau: number;
  };
  explanation?: string;
}

export interface BatchEntityItem {
  id: string;
  name: string;
  status?: string;
  selector?: string;
  selected: boolean;
  variables: Record<string, string>;
  executionState: "pending" | "running" | "success" | "failed" | "skipped";
  resultSummary?: string;
  durationMs?: number;
  error?: string;
}

export interface BatchProposal {
  id: string;
  title: string;
  macroId?: string;
  siteOrigin: string;
  templateSteps: WorkflowStep[];
  entities: BatchEntityItem[];
  summary: string;
  createdAt: number;
  totalItems: number;
  estimatedDurationMs?: number;
  executionStatus?: "proposed" | "running" | "completed" | "cancelled";
  succeededCount?: number;
  failedCount?: number;
}

export interface BatchExecutionResult {
  proposalId: string;
  totalEntities: number;
  executedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
  entities: BatchEntityItem[];
  summary: string;
}

