/**
 * Engram-Based Associative Navigation Engine
 *
 * Implements the neuroscience-inspired Engram Navigation Architecture:
 * - Engrams: Sparse constellations of DOM nodes, controls, and conceptual entities.
 * - Pattern Completion: Partial cue (e.g. "pricing", "features", "checkout") reactivates the target ensemble.
 * - Associative Linking: Meaning overlap connects related sections and actions.
 * - Bicameral Loop: Memory recognition (System 1) paired with host physical execution (DOM Driver).
 *
 * Provides a universal workaround for websites with missing, broken, or poor navigation.
 */

import { getPageDigest, PageDigest, tokenize } from "./pageContext";
import { smartQuerySelector, spotlightElement, isWidgetElement } from "./domUtils";
import { CompactEngine, cosineSimilarity } from "./compactEngine";

export interface EngramNode {
  id: string;
  type: "section" | "action" | "canvas" | "concept";
  title: string;
  description: string;
  selector: string;
  cueTerms: string[];
  category: string;
  score?: number;
  semanticSimilarity?: number;
}

export interface EngramMap {
  title: string;
  url: string;
  nodes: EngramNode[];
  sections: EngramNode[];
  actions: EngramNode[];
  canvases: EngramNode[];
  concepts: EngramNode[];
  generatedAt: number;
}

export interface AssociativeRecallResult {
  matchedNode: EngramNode | null;
  confidence: number;
  narrative: string;
  rankedNodes: EngramNode[];
  activatedCue: string;
}

let cachedEngramMap: EngramMap | null = null;
let lastBuiltUrl: string = "";

/**
 * Builds the sparse constellation of engrams representing the current webpage.
 */
export function buildEngramMap(force = false): EngramMap {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      title: "",
      url: "",
      nodes: [],
      sections: [],
      actions: [],
      canvases: [],
      concepts: [],
      generatedAt: Date.now(),
    };
  }

  if (cachedEngramMap && !force && lastBuiltUrl === window.location.href) {
    return cachedEngramMap;
  }

  const digest: PageDigest = getPageDigest(force);
  const nodes: EngramNode[] = [];
  const sections: EngramNode[] = [];
  const actions: EngramNode[] = [];
  const canvases: EngramNode[] = [];
  const concepts: EngramNode[] = [];

  // 1. Sections Engrams (from outline H1-H3)
  for (const h of digest.outline) {
    const title = h.text.trim();
    if (!title) continue;
    const cues = tokenize(title);
    const node: EngramNode = {
      id: `section_${sections.length}`,
      type: "section",
      title,
      description: `Section Landmark (Level ${h.level})`,
      selector: h.selector,
      cueTerms: cues,
      category: "Landmark Section",
    };
    sections.push(node);
    nodes.push(node);
  }

  // 2. Interactive Actions Engrams (buttons, links, inputs)
  const seenActionTitles = new Set<string>();
  for (const c of digest.controls) {
    const title = c.label.trim();
    if (!title || seenActionTitles.has(title)) continue;
    seenActionTitles.add(title);

    const cues = tokenize(title);
    const nodeType = c.kind === "canvas" ? "canvas" : "action";
    const node: EngramNode = {
      id: `action_${actions.length}`,
      type: nodeType,
      title,
      description: c.kind === "canvas" ? "3D / Canvas Viewport" : `${c.kind.toUpperCase()} Control: "${title}"`,
      selector: c.selector,
      cueTerms: cues,
      category: c.kind === "canvas" ? "3D Visual Engine" : c.kind === "link" ? "Navigation Link" : "Interactive Tool",
    };

    if (nodeType === "canvas") {
      canvases.push(node);
    } else {
      actions.push(node);
    }
    nodes.push(node);
  }

  // 3. 3D WebGL / Canvas Engrams
  if (digest.canvases) {
    for (const c of digest.canvases) {
      if (canvases.some((n) => n.selector === c.selector)) continue;
      const title = c.label || "Interactive 3D Viewport";
      const cues = ["canvas", "3d", "viewport", "game", "webgl", ...tokenize(title)];
      const node: EngramNode = {
        id: `canvas_${canvases.length}`,
        type: "canvas",
        title,
        description: `${c.isWebGL ? "3D WebGL" : "2D"} Viewport (${c.width}×${c.height}px)`,
        selector: c.selector,
        cueTerms: cues,
        category: "3D Visual Engine",
      };
      canvases.push(node);
      nodes.push(node);
    }
  }

  // 4. Content Concepts Engrams (from top chunks)
  const seenConcepts = new Set<string>();
  for (const chunk of digest.chunks.slice(0, 20)) {
    if (chunk.heading && !seenConcepts.has(chunk.heading)) {
      seenConcepts.add(chunk.heading);
      const cues = tokenize(chunk.heading + " " + chunk.text.slice(0, 100));
      const node: EngramNode = {
        id: `concept_${concepts.length}`,
        type: "concept",
        title: chunk.heading,
        description: chunk.text.slice(0, 160) + "…",
        selector: chunk.selector,
        cueTerms: cues,
        category: "Content Topic",
      };
      concepts.push(node);
      nodes.push(node);
    }
  }

  cachedEngramMap = {
    title: digest.title || (typeof document !== "undefined" ? document.title : ""),
    url: digest.url || (typeof window !== "undefined" ? window.location.href : ""),
    nodes,
    sections,
    actions,
    canvases,
    concepts,
    generatedAt: Date.now(),
  };
  lastBuiltUrl = typeof window !== "undefined" ? window.location.href : "";

  return cachedEngramMap;
}

/**
 * Associative Pattern Recall:
 * Reconstructs target context and destination from a partial signal.
 * Implements "The most ready neurons win" principle.
 */
export async function associativeRecall(
  cue: string,
  engine?: CompactEngine
): Promise<AssociativeRecallResult> {
  const map = buildEngramMap();
  const cueTokens = tokenize(cue);

  if (!map.nodes.length || !cue.trim()) {
    return {
      matchedNode: null,
      confidence: 0,
      narrative: `No active engrams or empty cue.`,
      rankedNodes: [],
      activatedCue: cue,
    };
  }

  const scoredNodes: Array<EngramNode & { score: number; semanticSimilarity?: number }> = [];

  for (const node of map.nodes) {
    let score = 0;
    const titleLower = node.title.toLowerCase();
    const cueLower = cue.toLowerCase().trim();

    // Exact title match (maximum activation energy)
    if (titleLower === cueLower) {
      score += 10.0;
    } else if (titleLower.includes(cueLower) || cueLower.includes(titleLower)) {
      score += 5.0;
    }

    // Token overlap matching
    let tokenMatches = 0;
    for (const t of cueTokens) {
      if (node.cueTerms.includes(t)) {
        tokenMatches++;
        score += 2.0;
      } else if (node.cueTerms.some((ct) => ct.includes(t) || t.includes(ct))) {
        tokenMatches += 0.5;
        score += 1.0;
      }
    }

    if (cueTokens.length > 0 && tokenMatches > 0) {
      score += (tokenMatches / cueTokens.length) * 3.0;
    }

    if (score > 0) {
      scoredNodes.push({ ...node, score });
    }
  }

  // If semantic embedder is ready, compute cosine similarity over candidate engrams
  if (engine?.isExtractorReady && scoredNodes.length > 0) {
    try {
      const topCandidates = scoredNodes.slice(0, 15);
      const textsToEmbed = [
        cue,
        ...topCandidates.map((c) => `${c.title}. ${c.description}`),
      ];
      const [cueVec, ...candidateVecs] = await engine.embed(textsToEmbed);
      topCandidates.forEach((c, idx) => {
        const sim = cosineSimilarity(cueVec, candidateVecs[idx]);
        c.semanticSimilarity = sim;
        c.score += sim * 4.0; // Boost score with neural embedding alignment
      });
    } catch {}
  }

  scoredNodes.sort((a, b) => b.score - a.score);

  const matched = scoredNodes[0] || null;
  const maxScore = 15.0;
  const confidence = matched ? Math.min(1.0, Math.max(0.15, matched.score / maxScore)) : 0;

  let narrative = "";
  if (matched) {
    const pct = Math.round(confidence * 100);
    narrative = `🧠 **Associative Recall [${pct}% confidence]**: Reconstructed target node **${matched.title}** (${matched.category}) from partial cue \`"${cue}"\`. Settled on destination selector \`${matched.selector}\`.`;
  } else {
    narrative = `No matching engram found on this page for cue \`"${cue}"\`. Try keywords like "sections", "3D", or button names.`;
  }

  return {
    matchedNode: matched,
    confidence,
    narrative,
    rankedNodes: scoredNodes.slice(0, 6),
    activatedCue: cue,
  };
}

/**
 * Motor Execution: Teleports the user viewport and focuses/spotlights the target engram.
 */
export function teleportToEngram(node: EngramNode): boolean {
  if (typeof document === "undefined") return false;

  const el = smartQuerySelector(node.selector);
  if (!el || isWidgetElement(el)) return false;

  // Smooth scroll and spotlight overlay
  spotlightElement(el, node.title);

  // If node is an interactive button or nav link and is in viewport
  if (node.type === "action") {
    try {
      el.focus();
    } catch {}
  }

  return true;
}
