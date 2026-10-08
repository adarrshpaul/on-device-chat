/**
 * Compact in-browser neural engine (Transformers.js).
 *
 * - Embedder: Xenova/all-MiniLM-L6-v2 (~15 MB ONNX) — sentence embeddings used to semantically
 *   re-rank page passages (see pageQA.ts).
 * - Generator (optional, Tier 2): HuggingFaceTB/SmolLM2-135M-Instruct (~80 MB, q4) — tiny LLM that
 *   writes an answer from retrieved page passages. At 135M parameters it is weak; treat as experimental.
 *
 * Architectural honesty: there are no regex/keyword fallbacks in here. If a model fails to load,
 * the error is thrown to the caller and displayed to the user.
 */
import { loadTransformers } from "./modelLoader";

export type LoadProgressCallback = (info: { text: string; progress: number }) => void;

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

async function pickDevice(): Promise<"webgpu" | "wasm"> {
  try {
    const gpu = (navigator as any).gpu;
    if (gpu && (await gpu.requestAdapter())) return "webgpu";
  } catch {
    /* no adapter */
  }
  return "wasm";
}

export class CompactEngine {
  private featureExtractor: any = null;
  private textGenerator: any = null;
  private embedCache = new Map<string, Float32Array>();
  private initPromise: Promise<void> | null = null;
  public isExtractorReady = false;
  public isGeneratorReady = false;
  public loadingError: string | null = null;
  public generatorDevice: "webgpu" | "wasm" | null = null;

  /** Load the MiniLM embedder (idempotent; concurrent callers share one load). */
  initEmbedder(onProgress?: LoadProgressCallback): Promise<void> {
    if (this.isExtractorReady) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          onProgress?.({ text: "Loading embedding model (~15 MB)…", progress: 0.05 });
          const tf = await loadTransformers();
          this.featureExtractor = await tf.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
            progress_callback: (item: any) => {
              if (item.status === "progress") onProgress?.({ text: `Embedding model (${item.file || ""}): ${Math.round(item.progress || 0)}%`, progress: (item.progress || 0) / 100 });
            },
          });
          this.isExtractorReady = true;
          this.loadingError = null;
          onProgress?.({ text: "Embedding model ready", progress: 1 });
        } catch (e: any) {
          this.loadingError = e?.message || "Failed to load embedding model";
          this.initPromise = null; // allow retry
          throw new Error(`Embedding model failed to load: ${this.loadingError}`);
        }
      })();
    }
    return this.initPromise;
  }

  /** Normalised sentence embeddings, cached by exact text. */
  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.isExtractorReady) throw new Error("Embedding model is not loaded");
    const missing = Array.from(new Set(texts.filter((t) => !this.embedCache.has(t))));
    const BATCH = 16;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const out = await this.featureExtractor(batch, { pooling: "mean", normalize: true });
      const dim = out.dims[out.dims.length - 1];
      for (let j = 0; j < batch.length; j++) {
        this.embedCache.set(batch[j], Float32Array.from(out.data.slice(j * dim, (j + 1) * dim)));
      }
      // Yield so the host page stays responsive during long passes.
      await new Promise((r) => setTimeout(r, 0));
    }
    return texts.map((t) => this.embedCache.get(t)!);
  }

  async loadGenerator(onProgress?: LoadProgressCallback): Promise<void> {
    if (this.textGenerator) return;
    try {
      const device = await pickDevice();
      onProgress?.({ text: `Loading SmolLM2-135M (~80 MB) on ${device}…`, progress: 0.05 });
      const tf = await loadTransformers();
      this.textGenerator = await tf.pipeline("text-generation", "HuggingFaceTB/SmolLM2-135M-Instruct", {
        dtype: "q4",
        device,
        progress_callback: (item: any) => {
          if (item.status === "progress") onProgress?.({ text: `SmolLM2 (${item.file || ""}): ${Math.round(item.progress || 0)}%`, progress: (item.progress || 0) / 100 });
        },
      });
      this.generatorDevice = device;
      this.isGeneratorReady = true;
    } catch (err: any) {
      throw new Error(`SmolLM2 generator failed to load: ${err?.message || err}`);
    }
  }

  /** Answer a question from supplied context only. Returns the model's raw text. */
  async generateGrounded(question: string, context: string, maxTokens = 160): Promise<string> {
    if (!this.isGeneratorReady || !this.textGenerator) throw new Error("SmolLM2 generator is not loaded");
    const messages = [
      { role: "system", content: "Answer the question using ONLY the page context below. If the context does not contain the answer, say you could not find it on the page. Be concise." },
      { role: "user", content: `Page context:\n${context}\n\nQuestion: ${question}` },
    ];
    const res = await this.textGenerator(messages, { max_new_tokens: maxTokens, do_sample: false, repetition_penalty: 1.1 });
    const gen = res?.[0]?.generated_text;
    const text = Array.isArray(gen) ? gen[gen.length - 1]?.content : String(gen ?? "");
    return (text || "").trim();
  }
}
