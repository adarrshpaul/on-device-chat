#!/usr/bin/env node
/**
 * Scopes all Tailwind utility and global CSS rules in dist/style.css to EdgeOperator / Gemma4
 * widget root containers and attributes.
 *
 * Prevents CSS cascade bleeding into host websites (e.g., .hidden, .flex, *, :root).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_CSS = path.resolve(__dirname, "../dist/style.css");

if (!fs.existsSync(DIST_CSS)) {
  console.error(`❌ style.css not found at ${DIST_CSS}`);
  process.exit(1);
}

const SCOPE = ":is(#edge-operator-root,#gemma4-widget-root,[data-eo-widget],[data-g4-widget],.eo-widget-container,.g4-widget-container,[data-eo-launcher],.eo-launcher-button,.g4-launcher-button,#eo-agent-spotlight,#g4-agent-spotlight)";

function transformSelector(sel) {
  sel = sel.trim();
  if (!sel) return sel;

  // :root or :host variables should be bound to the widget scope container
  if (sel === ":root" || sel === ":host") {
    return SCOPE;
  }

  // Universal resets
  if (sel === "*") {
    return `${SCOPE} *, ${SCOPE}`;
  }
  if (sel === ":before" || sel === "::before") {
    return `${SCOPE} ::before, ${SCOPE}::before`;
  }
  if (sel === ":after" || sel === "::after") {
    return `${SCOPE} ::after, ${SCOPE}::after`;
  }
  if (sel === "::backdrop") {
    return `${SCOPE} ::backdrop`;
  }

  // If already explicitly namespaced to widget/launcher/spotlight
  if (
    sel.startsWith(".eo-") ||
    sel.startsWith(".g4-") ||
    sel.startsWith("#edge-operator-") ||
    sel.startsWith("#gemma4-") ||
    sel.startsWith("[data-eo-") ||
    sel.startsWith("[data-g4-") ||
    sel.startsWith("#eo-agent-") ||
    sel.startsWith("#g4-agent-") ||
    sel.startsWith(":is(#edge-operator-")
  ) {
    return sel;
  }

  // Scope both descendant elements (.flex inside widget) and widget root itself (.eo-widget-container.fixed)
  return `${SCOPE} ${sel}, ${SCOPE}${sel}`;
}

const css = fs.readFileSync(DIST_CSS, "utf8");
const root = postcss.parse(css);

let ruleCount = 0;
root.walkRules(rule => {
  if (rule.parent && rule.parent.type === "atrule" && rule.parent.name === "keyframes") {
    return;
  }
  rule.selectors = rule.selectors.map(transformSelector);
  ruleCount++;
});

const scopedCss = root.toResult().css;
fs.writeFileSync(DIST_CSS, scopedCss, "utf8");
console.log(`✅ Scoped ${ruleCount} rules in dist/style.css without CSS cascade pollution.`);
