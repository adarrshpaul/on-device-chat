/**
 * Reasoning-History & Thinking Trace Manager (TASK-116 & TASK-117)
 *
 * Implements the reasoning-history stripping rule for reasoning models (DeepSeek-R1 / Gemma 4):
 * - Reference: DeepSeek-R1 API Documentation (https://api-docs.deepseek.com/guides/reasoning_model#multi-turn-conversations):
 *   "To achieve optimal results, it is recommended to exclude reasoning_content from previous turns
 *   when initiating a new conversational context."
 * - Rule 1 (Intra-turn tool loop): Intermediate assistant thinking blocks (reasoning_content or <think>...</think>)
 *   are preserved across tool call/result iterations within the SAME user turn so the model maintains reasoning
 *   continuity during tool execution.
 * - Rule 2 (Inter-turn conversation history): In multi-turn conversation history across distinct user turns,
 *   all historical reasoning/thinking content is stripped from prior assistant messages before constructing
 *   the prompt/messages array. Only the final clean assistant text and completed tool actions are retained.
 * - Benefit: Drastically prevents context window explosion, saves token budget on small on-device models,
 *   and prevents cognitive distraction from obsolete reasoning chains.
 */

export interface SanitizedMessage {
  role: string;
  content: string;
  reasoning_content?: string;
}

export class ReasoningManager {
  /**
   * Strip thinking/reasoning traces from a text string.
   * Matches <think>...</think>, <thought>...</thought>, [Thinking: ...], or ```thought...``` blocks.
   */
  static stripThinking(content: string): string {
    if (!content) return "";

    let cleaned = content;
    // Strip XML style thinking tags (<think>...</think>, <thought>...</thought>)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");
    cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "");

    // Strip Gemma 4 channel thought blocks (<|channel>thought...<channel|> or <|thought|>...<|/thought|>)
    cleaned = cleaned.replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, "");
    cleaned = cleaned.replace(/<\|thought\|>[\s\S]*?<\/[|]thought[|]>/gi, "");

    // Strip unclosed opening think tag at start of generation
    cleaned = cleaned.replace(/^<think>[\s\S]*$/gi, "");

    // Strip markdown thought code blocks
    cleaned = cleaned.replace(/```thought[\s\S]*?```/gi, "");

    // Strip bracketed thinking prefixes: [Thinking: ...]
    cleaned = cleaned.replace(/\[Thinking:[\s\S]*?\]/gi, "");

    return cleaned.trim();
  }

  /**
   * Extract thinking trace and clean content from model output.
   */
  static extractThinking(rawOutput: string): { thinking: string; content: string } {
    if (!rawOutput) return { thinking: "", content: "" };

    let thinking = "";
    const thinkMatch = rawOutput.match(/<think>([\s\S]*?)<\/think>/i) ||
                       rawOutput.match(/<thought>([\s\S]*?)<\/thought>/i) ||
                       rawOutput.match(/<\|channel>thought([\s\S]*?)<channel\|>/i) ||
                       rawOutput.match(/<\|thought\|>([\s\S]*?)<\/[|]thought[|]>/i) ||
                       rawOutput.match(/```thought([\s\S]*?)```/i);

    if (thinkMatch) {
      thinking = thinkMatch[1].trim();
    } else {
      const bracketMatch = rawOutput.match(/\[Thinking:\s*([\s\S]*?)\]/i);
      if (bracketMatch) {
        thinking = bracketMatch[1].trim();
      }
    }

    const cleanContent = this.stripThinking(rawOutput);
    return { thinking, content: cleanContent };
  }

  /**
   * DeepSeek Rule: Sanitize multi-turn conversation history between user turns.
   * Drops historical thinking/reasoning_content from all prior assistant turns,
   * retaining only the clean assistant response and user messages.
   */
  static sanitizeConversationHistory(
    history: Array<{ role: string; content: string; reasoning_content?: string }>
  ): SanitizedMessage[] {
    if (!Array.isArray(history) || history.length === 0) {
      return [];
    }

    return history.map((msg) => {
      if (msg.role === "assistant") {
        const cleanText = this.stripThinking(msg.content);
        return {
          role: "assistant",
          content: cleanText,
          // Intentionally omit reasoning_content from historical turns per DeepSeek API spec
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }

  /**
   * Intra-turn rule: Formats assistant step within the active tool loop.
   * If thinking trace is present, keeps it inside the active loop for model continuity.
   */
  static formatLoopAssistantMessage(
    toolCallPayload: Record<string, unknown>,
    thinkingTrace?: string
  ): SanitizedMessage {
    const jsonStr = JSON.stringify(toolCallPayload);
    if (thinkingTrace && thinkingTrace.trim()) {
      return {
        role: "assistant",
        content: `<think>\n${thinkingTrace.trim()}\n</think>\n${jsonStr}`,
        reasoning_content: thinkingTrace.trim(),
      };
    }
    return {
      role: "assistant",
      content: jsonStr,
    };
  }
}
