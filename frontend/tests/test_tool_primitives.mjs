import { AgentHarness } from "../src/lib/agentHarness.ts";
import { parseHarnessDecision } from "../src/lib/harnessDecisionParser.ts";
import { ProbabilisticHarnessEngine } from "../src/lib/probabilisticHarness.ts";
import { DEFAULT_BROWSER_TOOLS } from "../src/lib/types.ts";

console.log("Testing Tool Primitives & Direct Action Parsing/Execution...\n");

// 1. Verify DEFAULT_BROWSER_TOOLS contains click, type, scroll, navigate, inspect
const toolNames = DEFAULT_BROWSER_TOOLS.map((t) => t.function.name);
console.log("Declared tools:", toolNames);
if (!toolNames.includes("click")) throw new Error("Missing 'click' in DEFAULT_BROWSER_TOOLS");
if (!toolNames.includes("type")) throw new Error("Missing 'type' in DEFAULT_BROWSER_TOOLS");
if (!toolNames.includes("scroll")) throw new Error("Missing 'scroll' in DEFAULT_BROWSER_TOOLS");
console.log("✓ All direct browser tools are declared in DEFAULT_BROWSER_TOOLS.");

// 2. Test Parser with diverse formats
const cases = [
  { raw: '{"tool": "click", "args": {"selector": "#test-button"}}', expectedTool: "click" },
  { raw: '{"click": {"selector": "#test-button"}}', expectedTool: "click" },
  { raw: '{"action": "click", "selector": "#test-button"}', expectedTool: "click" },
  { raw: 'CLICK("#test-button")', expectedTool: "browse" },
  { raw: '{"tool": "type", "args": {"selector": "#input", "value": "text"}}', expectedTool: "type" },
  { raw: '{"tool": "scroll", "args": {"direction": "down"}}', expectedTool: "scroll" },
  { raw: '{"tool": "navigate", "args": {"url": "/about"}}', expectedTool: "navigate" },
  { raw: '{"tool": "inspect", "args": {"selector": "h1"}}', expectedTool: "inspect" },
];

for (const c of cases) {
  const parsed = parseHarnessDecision(c.raw);
  if (parsed.tool !== c.expectedTool) {
    throw new Error(`Parser failed for '${c.raw}': got '${parsed.tool}', expected '${c.expectedTool}'`);
  }
}
console.log("✓ All tool formats parsed cleanly.");

// 3. Test Probabilistic Harness Validation
for (const c of cases) {
  const parsed = parseHarnessDecision(c.raw);
  const val = ProbabilisticHarnessEngine.validateDecision(parsed, DEFAULT_BROWSER_TOOLS);
  if (!val.passed) {
    throw new Error(`Validation rejected '${parsed.tool}': ${val.reason}`);
  }
}
console.log("✓ Probabilistic harness validated all direct tools without 'Unknown tool' error.");

// 4. Test Agent Harness execution of direct tool
const harness = new AgentHarness();
const resClick = await harness.executeTool("click", { selector: "#fake-btn" });
console.log("Execute 'click' response:", resClick);
if (resClick.includes('Unknown tool "click"')) {
  throw new Error("Harness still threw Unknown tool 'click'!");
}

const resType = await harness.executeTool("type", { selector: "#fake-input", value: "hello" });
console.log("Execute 'type' response:", resType);
if (resType.includes('Unknown tool "type"')) {
  throw new Error("Harness still threw Unknown tool 'type'!");
}

console.log("\n✅ ALL TESTS PASSED: 'click' and browser tools are fully declared and supported primitives!");
