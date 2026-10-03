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
  TIER_2_SMOLLM_GENERATIVE = 2,
  TIER_3_GEMMA4_E2B = 3,
}

export interface TierInfo {
  tier: ModelTier;
  name: string;
  size: string;
  description: string;
  badgeColor: string;
}
