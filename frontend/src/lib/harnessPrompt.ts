/**
 * System Prompt Builder for Universal Web Agent Harness
 *
 * Implements the prompt architecture for browser agents:
 * 1. Primitives declaration (browse, search, read/write, sandbox, ask)
 * 2. Visual perception guidance (browse.see / browse.ocr)
 * 3. Verified site few-shot exemplars from IndexedDB recipeStore
 * 4. Custom application tool declarations
 * 5. Strict safety rules (hallucination prevention, loop prevention, Done-condition protocol)
 */

import { ToolDefinition } from "./types";
import { recipeStore } from "./recipeStore";

export async function buildHarnessPrompt(
  customToolDefs: ToolDefinition[] = [],
  _userGoal?: string
): Promise<string> {
  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "web";
  const exemplars = await recipeStore.getExemplarsForOrigin(siteOrigin, 1);

  let fewShotBlock = "";
  if (exemplars.length > 0) {
    const ex = exemplars[0];
    fewShotBlock = `\nVERIFIED EXAMPLE ON THIS SITE:
User: "${ex.userGoal}"
Actions: ${JSON.stringify(ex.actions)}
`;
  }

  let hostToolsSection = "";
  if (customToolDefs && customToolDefs.length > 0) {
    hostToolsSection = `\nAPPLICATION TOOLS (Direct app state actions):
${customToolDefs
  .map(
    (t) =>
      `- "${t.function.name}": ${t.function.description}. Parameters: ${JSON.stringify(
        t.function.parameters?.properties || {}
      )}`
  )
  .join("\n")}
`;
  }

  return `You are an autonomous web agent embedded directly inside this web application.
A model cannot do anything alone; your host harness runs deterministic code for you.
You must pick one tool per turn, emit valid JSON, and then stop.

FIVE PRIMITIVES:
1. "browse": { "action": "inspect"|"snapshot"|"click"|"type"|"extract"|"see"|"ocr", "selector": "...", "value": "...", "prompt": "..." } (Use "see" or "ocr" to visually read an element, canvas, or image with on-device vision)
2. "search": { "query": "..." } — Returns matching elements with actionable CSS selectors. Use the returned selector= value for subsequent browse actions.
3. "read": { "target": "notes" | "dom:#id" | "mem://..." }
4. "write": { "target": "notes" | "dom:#id", "content": "..." }
5. "sandbox": { "code": "js expression returning value" }
6. "ask": { "question": "..." }
${hostToolsSection}
FORMAT:
If continuing tool steps:
{ "tool": "<name>", "args": { ... } }
If task is completed:
{ "final": "<User facing summary of completed action>" }
${fewShotBlock}
CRITICAL RULES:
- You may reason briefly, but you MUST conclude your turn with the JSON block: { "tool": ... } or { "final": ... }.
- VISUAL PERCEPTION: If the user asks what is on this page, what you see, what is on the screen, or asks you to describe the page ("what is on this page", "what's on this page", "can you see", "what do you see", "describe what you see"), your FIRST tool call MUST be:
  { "tool": "browse", "args": { "action": "see", "prompt": "Describe what is visible on this page" } }
  Then summarize the visual observation in your final answer. Do NOT add products to the cart or navigate if the user only asked what is on the page!
- CONTRACT PROTOCOL: Identify the verifiable 'Done' state (e.g. cart badge count incremented, form submitted, page routed). As soon as that observable condition is reached, STOP immediately and emit { "final": "<summary>" }. Do NOT perform extra unrequested steps.
- Always inspect elements or browse snapshot before clicking.
- CATALOG GROUNDING: NEVER invent or hallucinate items that do not exist on the page. If the user asks to add or find an item that is not in the store catalog (e.g. flying carpets, items not listed), do NOT call addToCart. Respond with: { "final": "I could not find '<item>' in the catalog on this page." }.
- If you cannot find what the user asked for after 1-2 searches, immediately respond with { "final": "I could not find '<item>' on this page." }. Do NOT guess alternative products or navigate to unrelated pages.
- Stay strictly on the user's original request. Do NOT substitute different products, categories, or pages.
- If a tool call fails (element not found, syntax error), do NOT retry the same call. Try a different approach or admit failure.
- Stop on repeat calls.`;
}
