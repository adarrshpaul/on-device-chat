/**
 * Decision Parser for Agent Harness
 *
 * Robustly parses model output into structured HarnessToolCall objects,
 * extracting decisions from pure JSON, markdown fences, Chain-of-Thought prose,
 * and intercepting conversational visual queries.
 */

export interface HarnessToolCall {
  tool: "read" | "write" | "sandbox" | "browse" | "search" | "ask" | string;
  args: Record<string, unknown>;
  final?: string;
}

export function extractAllJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start === -1) break;
    let depth = 0;
    let end = -1;
    let inString = false;
    let escape = false;

    for (let j = start; j < text.length; j++) {
      const char = text[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{") depth++;
        else if (char === "}") {
          depth--;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }
    }

    if (end !== -1) {
      blocks.push(text.slice(start, end + 1));
      i = end + 1;
    } else {
      i = start + 1;
    }
  }
  return blocks;
}

export function parseHarnessDecision(raw: string, userGoal?: string): HarnessToolCall {
  const trimmed = raw.trim();

  const normalize = (obj: any): HarnessToolCall | null => {
    if (!obj || typeof obj !== "object") return null;

    // Case A: Finished
    if (obj.final && !obj.tool) {
      return { tool: "final", args: {}, final: String(obj.final) };
    }

    // Case B: OpenAI / Function calling format
    if (obj.tool_call?.name) {
      const toolName = String(obj.tool_call.name).trim();
      if (toolName === "..." || toolName.includes("...") || toolName.startsWith("<") || toolName === "name") {
        return null;
      }
      let callArgs = obj.tool_call.arguments;
      if (typeof callArgs === "string") {
        try {
          callArgs = JSON.parse(callArgs);
        } catch {
          callArgs = {};
        }
      }
      return {
        tool: toolName,
        args: typeof callArgs === "object" && callArgs !== null ? callArgs : {},
        final: obj.final,
      };
    }

    // Case C: Standard tool call
    if (obj.tool) {
      const toolStr = String(obj.tool).trim();
      if (toolStr === "..." || toolStr.includes("...") || toolStr.startsWith("<") || toolStr === "name") {
        return null;
      }
      let argsObj = obj.args;
      if (typeof argsObj === "string") {
        try {
          argsObj = JSON.parse(argsObj);
        } catch {
          argsObj = {};
        }
      }
      if (!argsObj || typeof argsObj !== "object") {
        // If model emitted parameters at top level, e.g. { "tool": "search", "query": "headphones" }
        const { tool: _tool, final: _final, tool_call: _tool_call, args: _args, ...rest } = obj;
        argsObj = rest;
      }
      return {
        tool: toolStr,
        args: argsObj || {},
        final: obj.final,
      };
    }

    return null;
  };

  // 1. Direct parse if pure JSON
  try {
    const clean = trimmed.replace(/^```json\n?|```$/g, "").trim();
    const parsed = JSON.parse(clean);
    const normalized = normalize(parsed);
    if (normalized) return normalized;
  } catch {}

  // 2. Extract JSON block { "tool": ... } or { "final": ... } from within prose/CoT using depth-aware parsing
  const jsonBlocks = extractAllJsonBlocks(trimmed);
  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block);
      const normalized = normalize(parsed);
      if (normalized) return normalized;
    } catch {}
  }

  // 3. Fallback regex extraction for loosely formatted output
  const toolRegexMatch = trimmed.match(/"tool"\s*:\s*"([^"]+)"/);
  if (toolRegexMatch) {
    const toolName = toolRegexMatch[1].trim();
    if (toolName !== "..." && !toolName.includes("...") && !toolName.startsWith("<")) {
      const argsMatch = trimmed.match(/"args"\s*:\s*(\{[\s\S]*?\})/);
      let argsObj: Record<string, unknown> = {};
      if (argsMatch) {
        try {
          argsObj = JSON.parse(argsMatch[1]);
        } catch {}
      }
      return { tool: toolName, args: argsObj };
    }
  }

  // 4. Default: Check if user asked a visual question and model outputted conversational preamble
  const goal = (userGoal || "").trim();
  const isVisualInquiry =
    /^(can you see|what do you see|what('s|\s+is)\s+(visible|on\s+(this|the)\s+page|on\s+(the\s+)?screen)|describe\s+(what\s+is\s+visible|what\s+you\s+see|the\s+page|this\s+page|the\s+screen|this\s+screen)|what\s+products\s+are\s+on\s+this\s+page)/i.test(goal) ||
    /\b(describe\s+what\s+is\s+visible|what\s+is\s+visible\s+on\s+(this|the)\s+page)\b/i.test(goal);

  if (isVisualInquiry) {
    return {
      tool: "browse",
      args: {
        action: "see",
        prompt: goal,
      },
    };
  }

  return { tool: "final", args: {}, final: raw };
}
