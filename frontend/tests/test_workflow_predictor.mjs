/**
 * Test Suite for WorkflowPredictor & Decision-Model Workflow Predictions
 */

class MockElement {
  constructor(tag, attrs = {}, text = "") {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.textContent = text;
    this.id = attrs.id || "";
    this.className = attrs.class || "";
    this.isConnected = true;
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, val) { this.attrs[name] = val; }
  hasAttribute(name) { return name in this.attrs; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 40 }; }
}

globalThis.HTMLElement = MockElement;
globalThis.HTMLAnchorElement = MockElement;
globalThis.HTMLButtonElement = MockElement;
globalThis.HTMLInputElement = MockElement;

async function runWorkflowPredictorTests() {
  console.log("======================================================================");
  console.log("⚡ TESTING WORKFLOW PREDICTOR & DECISION-MODEL WORKFLOW SYNTHESIS");
  console.log("======================================================================\n");

  const btnResume = new MockElement("a", { href: "/resume.pdf", download: "true" }, "Download Resume");
  const secProjects = new MockElement("section", { id: "projects" }, "Featured Projects");
  const secExperience = new MockElement("section", { id: "experience" }, "Work Experience");
  const secAbout = new MockElement("section", { id: "about" }, "About Me");
  const inputSearch = new MockElement("input", { type: "search", id: "site-search" }, "");

  const allElements = [btnResume, secProjects, secExperience, secAbout, inputSearch];

  globalThis.window = {
    location: { hostname: "paulcreates.online" },
    indexedDB: null,
  };
  globalThis.document = {
    title: "Adarrsh Paul - Principal Engineer Portfolio",
    documentElement: { scrollHeight: 2000 },
    body: { scrollHeight: 2000 },
    querySelector: (sel) => {
      if (sel.includes("download") || sel.includes("resume")) return btnResume;
      if (sel.includes("search")) return inputSearch;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes("section")) return [secProjects, secExperience, secAbout];
      return allElements;
    },
  };

  const { WorkflowPredictor } = await import("../dist/index.js");

  const predictions = await WorkflowPredictor.predictWorkflows(3);

  console.log(`Generated ${predictions.length} AI-predicted workflows:`);
  predictions.forEach((p, idx) => {
    console.log(`  ${idx + 1}. ${p.workflow.name} (Confidence: ${p.confidence * 100}%)`);
    console.log(`     Desc: ${p.workflow.description}`);
    console.log(`     Rationale: ${p.rationale}`);
  });

  if (predictions.length < 2) {
    throw new Error(`Expected at least 2 predicted workflows, got ${predictions.length}`);
  }

  const hasResume = predictions.some((p) => p.workflow.tags?.includes("resume") || p.workflow.tags?.includes("download"));
  const hasProjects = predictions.some((p) => p.workflow.tags?.includes("projects") || p.workflow.tags?.includes("deep dive"));

  if (!hasResume) throw new Error("Expected resume/download workflow candidate");
  if (!hasProjects) throw new Error("Expected deep dive projects workflow candidate");

  console.log("\n✅ PASS: Decision model successfully predicted grounded, high-value workflows for active page!");
  console.log("======================================================================");
}

runWorkflowPredictorTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
