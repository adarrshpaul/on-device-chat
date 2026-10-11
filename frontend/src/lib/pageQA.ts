/**
 * Page question answering for the tiers that cannot reliably produce tool-calling JSON
 * (Tier 1 "Page Search", Tier 2 tiny generator).
 *
 * Tier 1 answers are EXTRACTIVE: verbatim passages from the page ranked by BM25, optionally
 * re-ranked with MiniLM sentence embeddings (Reciprocal Rank Fusion). No text is generated, so
 * nothing can be hallucinated. The reply states which ranking method was actually used.
 */
import { getPageDigest, getIndex, searchIndex, buildContextBlock, tokenize, ScoredChunk } from "./pageContext";
import { CompactEngine, cosineSimilarity } from "./compactEngine";

export interface PageAnswer {
  text: string;
  method: "keyword" | "keyword+semantic" | "semantic" | "none";
  passages: Array<ScoredChunk & { semantic?: number }>;
}

const RRF_K = 60;
const MAX_EMBED_CHUNKS = 160;

export async function rankPassages(query: string, engine?: CompactEngine, k = 3): Promise<{ method: PageAnswer["method"]; passages: PageAnswer["passages"] }> {
  const digest = getPageDigest();
  const index = getIndex(digest);
  const lexical = searchIndex(index, query, 30);
  const useSemantic = !!engine?.isExtractorReady && digest.chunks.length > 0;

  if (!useSemantic) {
    return { method: lexical.length ? "keyword" : "none", passages: lexical.slice(0, k) };
  }

  // Candidate pool: lexical hits first, then the rest of the page in document order (bounded).
  const pool = new Map<number, PageAnswer["passages"][number]>();
  for (const c of lexical) pool.set(c.id, { ...c });
  for (const c of digest.chunks) {
    if (pool.size >= MAX_EMBED_CHUNKS) break;
    if (!pool.has(c.id)) pool.set(c.id, { ...c, score: 0, coverage: 0 });
  }
  const cands = Array.from(pool.values());
  const [qv, ...cvs] = await engine!.embed([query, ...cands.map((c) => `${c.heading ? c.heading + ". " : ""}${c.text}`)]);
  cands.forEach((c, i) => (c.semantic = cosineSimilarity(qv, cvs[i])));

  const lexRank = new Map<number, number>();
  lexical.forEach((c, i) => lexRank.set(c.id, i));
  const semOrder = [...cands].sort((a, b) => (b.semantic ?? 0) - (a.semantic ?? 0));
  const semRank = new Map<number, number>();
  semOrder.forEach((c, i) => semRank.set(c.id, i));

  const fused = cands
    .map((c) => ({
      c,
      rrf: (lexRank.has(c.id) ? 1 / (RRF_K + (lexRank.get(c.id) as number)) : 0) + 1 / (RRF_K + (semRank.get(c.id) as number)),
    }))
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, k)
    .map((x) => x.c);
  return { method: lexical.length ? "keyword+semantic" : "semantic", passages: fused };
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

export async function answerFromPage(query: string, engine?: CompactEngine): Promise<PageAnswer> {
  const digest = getPageDigest();
  if (!digest.chunks.length) {
    return {
      text: `I couldn't read any text on this page (it may still be loading, or its content is rendered in a canvas/iframe).\n\nIf you have a question about this website, please let me know!`,
      method: "none",
      passages: [],
    };
  }
  const { method, passages } = await rankPassages(query, engine, 3);
  const queryTerms = Array.from(new Set(tokenize(query)));

  // Filter out low-confidence spurious hits (threshold: semantic >= 0.35 or BM25 lexical score >= 1.2)
  const relevantPassages = passages.filter((p) => {
    const sem = p.semantic ?? 0;
    const lex = p.score ?? 0;
    return sem >= 0.35 || lex >= 1.2;
  });

  if (!relevantPassages.length) {
    const siteTitle = digest.title || "this website";
    const siteDesc = digest.description ? ` (${digest.description})` : "";
    const cleanTerms = queryTerms.filter(
      (t) =>
        ![
          "who",
          "what",
          "where",
          "when",
          "why",
          "how",
          "the",
          "this",
          "page",
          "site",
          "tell",
          "about",
          "is",
          "are",
          "you",
          "there",
          "any",
        ].includes(t.toLowerCase())
    );
    const termNotice =
      cleanTerms.length > 0 ? `mention of "${cleanTerms.join('", "')}"` : "information matching your query";
    const outlineSuggestions = (digest.outline || []).slice(0, 3).map((o) => `"${o.text}"`).join(", ");
    const suggestionText = outlineSuggestions
      ? `\n\nTopics and sections on this page include: ${outlineSuggestions}.`
      : "";

    return {
      method: "none",
      passages: [],
      text:
        `I searched the current website, but found no ${termNotice}.\n\n` +
        `This site is **${siteTitle}**${siteDesc}.${suggestionText}\n\n` +
        `Feel free to ask about any topic, feature, or section on this page!`,
    };
  }

  const lines = relevantPassages.map((p, i) => {
    const conf =
      p.semantic !== undefined
        ? ` _(semantic relevance ${(p.semantic * 100).toFixed(0)}%${p.score ? `, keyword score ${p.score.toFixed(1)}` : ""})_`
        : ` _(keyword score ${p.score.toFixed(1)})_`;
    return `${i + 1}. ${p.heading ? `**${clip(p.heading, 70)}** — ` : ""}${clip(p.text, 380)}${conf}`;
  });

  const methodLabel =
    method === "keyword+semantic"
      ? "keyword (BM25) + semantic (MiniLM) ranking"
      : method === "semantic"
      ? "semantic (MiniLM) ranking"
      : "keyword (BM25) ranking";

  return {
    method,
    passages: relevantPassages,
    text: `From **${digest.title || digest.url}**:\n\n${lines.join("\n")}\n\n_Retrieved via ${methodLabel}._`,
  };
}

/** Tier 2: tiny generator over retrieved passages, with the extractive result as evidence. */
export async function answerWithGenerator(query: string, engine: CompactEngine): Promise<PageAnswer> {
  const extractive = await answerFromPage(query, engine);
  if (!engine.isGeneratorReady) return extractive;
  const generated = await engine.generateGrounded(query, buildContextBlock(query, { passages: 3, charBudget: 1800 }));
  return {
    method: extractive.method,
    passages: extractive.passages,
    text: `${generated || "(the 135M model returned an empty answer)"}\n\n---\n_Generated by SmolLM2-135M (experimental, small model — verify against the sources below)._\n\n${extractive.text}`,
  };
}
