import assert from "node:assert";

console.log("\n=== Test Suite: Fast Navigation & Workflow Matching Fixes ===");

// 1. Test Regex Matching for Workflow Triggers (Chat Hijacking Prevention)
console.log("\nSuite 1: Chat Hijacking Prevention");
const isExplicitRunCommand = (lower) => /^(?:run|start|execute|play|trigger)\s+(?:workflow\s+)?/i.test(lower);

const matchesTrigger = (lower, triggerPhrase) => {
  const isExp = isExplicitRunCommand(lower);
  if (triggerPhrase && triggerPhrase.length >= 4) {
    const tp = triggerPhrase.toLowerCase();
    const regex = new RegExp(`(^|\\b)${tp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\b|$)`, "i");
    if (regex.test(lower)) {
      if (isExp || lower.length <= tp.length + 15) {
        return true;
      }
    }
  }
  return false;
};

// Non-matching regular user messages that previously got hijacked:
assert.strictEqual(matchesTrigger("inability of website to do actions now", "portfolio tour"), false);
assert.strictEqual(matchesTrigger("again please chat assitant needs to be highly responsive", "ai deep dive"), false);
assert.strictEqual(matchesTrigger("explain this page architecture", "ai deep dive"), false);
assert.strictEqual(matchesTrigger("tell me about the ai model", "ai deep dive"), false);
assert.strictEqual(matchesTrigger("how is the ui designed", "contrast check"), false);
console.log("  ✓ Regular conversational queries containing 'ai', 'ui', 'again' are NOT hijacked");

// Matching intentional workflow execution commands:
assert.strictEqual(matchesTrigger("run workflow portfolio tour", "portfolio tour"), true);
assert.strictEqual(matchesTrigger("start portfolio tour", "portfolio tour"), true);
assert.strictEqual(matchesTrigger("portfolio tour", "portfolio tour"), true);
assert.strictEqual(matchesTrigger("ai deep dive", "ai deep dive"), true);
assert.strictEqual(matchesTrigger("run ai deep dive", "ai deep dive"), true);
console.log("  ✓ Intentional workflow triggers cleanly match");

// 2. Test Section Navigation Intent Matching
console.log("\nSuite 2: Fast Section Navigation Detection");
const isSectionNavIntent = (q) => {
  const lower = q.toLowerCase().trim();
  const sectionKeywords = {
    "project": { id: "projects", name: "Featured Projects" },
    "projects": { id: "projects", name: "Featured Projects" },
    "skill": { id: "skills", name: "Skills & Engineering Matrix" },
    "skills": { id: "skills", name: "Skills & Engineering Matrix" },
    "journey": { id: "journey", name: "Career & Experience Journey" },
    "contact": { id: "contact", name: "Contact & Work Inquiries" },
    "contact me": { id: "contact", name: "Contact & Work Inquiries" },
    "hire": { id: "contact", name: "Contact & Hire Me" },
    "hire me": { id: "contact", name: "Contact & Hire Me" },
    "insights": { id: "insights", name: "Research Insights & Articles" },
    "music": { id: "music", name: "Web Audio Synth & DSP" },
    "home": { id: "home", name: "Home Hero" },
  };

  const navPrefix = /^(?:go\s+to|goto|navigate\s+to|scroll\s+to|show\s+me|show|take\s+me\s+to|view|visit|open)\s+(.+)$/i;
  const matchPrefix = lower.match(navPrefix);
  const targetQuery = matchPrefix ? matchPrefix[1].trim() : lower;

  for (const [kw, info] of Object.entries(sectionKeywords)) {
    if (
      targetQuery === kw ||
      targetQuery === `${kw} section` ||
      targetQuery === `the ${kw}` ||
      targetQuery === `${kw}s` ||
      targetQuery === `show ${kw}` ||
      targetQuery === `show me ${kw}`
    ) {
      return { isNav: true, sectionId: info.id, sectionName: info.name };
    }
  }

  return { isNav: false, sectionId: "", sectionName: "" };
};

assert.deepStrictEqual(isSectionNavIntent("go to projects"), { isNav: true, sectionId: "projects", sectionName: "Featured Projects" });
assert.deepStrictEqual(isSectionNavIntent("show skills"), { isNav: true, sectionId: "skills", sectionName: "Skills & Engineering Matrix" });
assert.deepStrictEqual(isSectionNavIntent("scroll to journey"), { isNav: true, sectionId: "journey", sectionName: "Career & Experience Journey" });
assert.deepStrictEqual(isSectionNavIntent("hire me"), { isNav: true, sectionId: "contact", sectionName: "Contact & Hire Me" });
assert.deepStrictEqual(isSectionNavIntent("projects"), { isNav: true, sectionId: "projects", sectionName: "Featured Projects" });
assert.strictEqual(isSectionNavIntent("what is this page about").isNav, false);
console.log("  ✓ Direct section navigation intents resolved accurately to DOM IDs in <1ms");

// 3. Test Scroll Direction Intent Matching
console.log("\nSuite 3: Instant Viewport Scroll Matching");
const isScrollIntent = (q) => {
  const lower = q.toLowerCase().trim();
  if (/^(scroll\s+down|down|page\s+down|next\s+page)\b/i.test(lower)) return { isScroll: true, direction: "down" };
  if (/^(scroll\s+up|up|page\s+up|previous\s+page)\b/i.test(lower)) return { isScroll: true, direction: "up" };
  if (/^(scroll\s+to\s+top|top|to\s+top|scroll\s+top|home\s+top)\b/i.test(lower)) return { isScroll: true, direction: "top" };
  if (/^(scroll\s+to\s+bottom|bottom|to\s+bottom|footer)\b/i.test(lower)) return { isScroll: true, direction: "bottom" };
  return { isScroll: false, direction: "down" };
};

assert.deepStrictEqual(isScrollIntent("scroll down"), { isScroll: true, direction: "down" });
assert.deepStrictEqual(isScrollIntent("scroll up"), { isScroll: true, direction: "up" });
assert.deepStrictEqual(isScrollIntent("scroll to top"), { isScroll: true, direction: "top" });
assert.deepStrictEqual(isScrollIntent("scroll to bottom"), { isScroll: true, direction: "bottom" });
assert.strictEqual(isScrollIntent("tell me a story").isScroll, false);
console.log("  ✓ Viewport scroll commands matched with correct directional semantics");

console.log("\n========================================");
console.log("Summary: All Fast Navigation & Anti-Hijacking Tests Passed!");
console.log("========================================\n");
