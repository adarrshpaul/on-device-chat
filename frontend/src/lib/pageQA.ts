/**
 * Page question answering for the tiers that cannot reliably produce tool-calling JSON
 * (Tier 1 "Page Search", Tier 2 tiny generator).
 *
 * Tier 1 answers are EXTRACTIVE: verbatim passages from the page ranked by BM25, optionally
 * re-ranked with MiniLM sentence embeddings (Reciprocal Rank Fusion). No text is generated, so
 * nothing can be hallucinated. The reply states which ranking method was actually used.
 */
import { getPageDigest, getIndex, searchIndex, describeDigest, buildContextBlock, tokenize, ScoredChunk } from "./pageContext";
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
    return { text: `I couldn't read any text on this page (it may still be loading, or its content is rendered in a canvas/iframe I can't read).\n\n${describeDigest(digest)}`, method: "none", passages: [] };
  }
  const { method, passages } = await rankPassages(query, engine, 3);
  const queryTerms = Array.from(new Set(tokenize(query)));

  if (!passages.length) {
    return {
      method,
      passages,
      text:
        `No passage on this page contains the terms from your question${queryTerms.length ? ` (${queryTerms.join(", ")})` : ""}.\n\n` +
        `${describeDigest(digest)}\n\n` +
        `_Method: keyword search${engine?.isExtractorReady ? "" : " (semantic model not loaded)"}; this tier extracts passages and does not generate text._`,
    };
  }

  const lines = passages.map((p, i) => {
    const conf = p.semantic !== undefined ? ` _(semantic similarity ${(p.semantic * 100).toFixed(0)}%${p.score ? `, keyword score ${p.score.toFixed(1)}` : ""})_` : ` _(keyword score ${p.score.toFixed(1)})_`;
    return `${i + 1}. ${p.heading ? `**${clip(p.heading, 70)}** — ` : ""}${clip(p.text, 380)}${conf}`;
  });
  const methodLabel =
    method === "keyword+semantic" ? "keyword (BM25) + semantic (MiniLM) ranking" : method === "semantic" ? "semantic (MiniLM) ranking only — no keyword overlap" : "keyword (BM25) ranking" + (engine?.isExtractorReady ? "" : "; semantic model not loaded yet");
  return {
    method,
    passages,
    text: `From **${digest.title || digest.url}** — closest passages:\n\n${lines.join("\n")}\n\n_Method: ${methodLabel}. Verbatim excerpts; no text generated._`,
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
