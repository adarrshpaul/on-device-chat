import assert from "node:assert/strict";

// Mock minimal DOM for PageDigest and SiteTour
globalThis.window = {
  scrollY: 0,
  scrollTo: () => {},
  location: { href: "https://paulcreates.online", origin: "https://paulcreates.online" },
};

globalThis.document = {
  title: "Portfolio of Adarrsh Paul — Full-Stack Engineer & AI Systems Architect",
  body: {
    scrollHeight: 2000,
    style: {},
    classList: { contains: () => false, toggle: () => {} },
    setAttribute: () => {},
  },
  documentElement: {
    getAttribute: () => "dark",
    setAttribute: () => {},
    classList: { toggle: () => {} },
  },
  querySelector: (sel) => {
    if (sel.includes("download") || sel.includes("resume")) {
      return {
        tagName: "A",
        getAttribute: () => "/resume.pdf",
        getBoundingClientRect: () => ({ top: 300, width: 120, height: 40 }),
        click: () => {},
      };
    }
    return null;
  },
  querySelectorAll: () => [],
};

async function runTests() {
  console.log("======================================================================");
  console.log("⚡ TESTING SITE OVERVIEW & ACTION BUTTON SYNTHESIS");
  console.log("======================================================================");

  const { generateSiteOverview } = await import("../dist/index.js");

  const digest = {
    title: "Portfolio of Adarrsh Paul — Full-Stack Engineer & AI Systems Architect",
    url: "https://paulcreates.online",
    description: "Author of on-device-chat npm, specializing in high-performance web ecosystems and agentic AI systems.",
    headings: ["AI Quant Sandbox", "Basketball", "Career Evolution"],
    outline: [
      { level: 2, text: "AI Quant Sandbox", selector: "#projects" },
      { level: 2, text: "Career Evolution", selector: "#journey" },
    ],
    controls: [
      { id: "1", label: "Download Resume", kind: "link" },
      { id: "2", label: "Toggle Theme", kind: "button" },
      { id: "3", label: "Get in touch", kind: "button" },
    ],
    canvases: [{ selector: "canvas#scene", width: 800, height: 600, isWebGL: true }],
    chunks: [],
    stats: { elementsCount: 50, interactiveCount: 5, imagesCount: 2, formsCount: 1 },
  };

  const overview = generateSiteOverview(digest);
  console.log("Generated Overview Markdown:\n----------------------------------------\n" + overview + "\n----------------------------------------");

  // Verifications
  assert.ok(overview.includes("### 🌐 **Portfolio of Adarrsh Paul"), "Header must include page title");
  assert.ok(overview.includes("Author of on-device-chat npm"), "Must include executive description");
  assert.ok(overview.includes("3D WebGL / GPU-Accelerated Viewport"), "Must detect WebGL canvas");
  assert.ok(overview.includes("⚡ **Instant Actions"), "Must include Instant Actions call to action");
  
  // Ready-to-click buttons
  assert.ok(overview.includes("[▶ 🗺️ Take Guided Tour](action:tour)"), "Must include guided tour action");
  assert.ok(overview.includes("[▶ 🚀 Explore Key Projects](action:projects)"), "Must include projects action");
  assert.ok(overview.includes("[▶ 📄 Download Resume](action:resume)"), "Must include download resume action");
  assert.ok(overview.includes("[▶ ✉️ Quick Contact & Connect](action:contact)"), "Must include contact action");
  assert.ok(overview.includes("[▶ 🎨 Toggle Theme](action:theme)"), "Must include theme action");

  // Verify that the old wall-of-text patterns are completely gone
  assert.ok(!overview.includes("📑 **Key Sections & Structure:**"), "Must not dump passive outline headings");
  assert.ok(!overview.includes("⚡ **Interactive Capabilities & Controls:**"), "Must not dump raw control list");
  assert.ok(!overview.includes("✨ **Quick Actions You Can Ask Me:**"), "Must not ask user to type passive text");

  console.log("✅ PASS: generateSiteOverview generates executive synopsis + 1-click action buttons!");
  console.log("======================================================================");
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
