/**
 * Runtime loaders for the optional heavy ML libraries.
 *
 * Why this exists: the standalone (<script>) bundle is a classic IIFE with no bundler or import map
 * on the host page, so a bare `import("@huggingface/transformers")` throws
 * "Failed to resolve module specifier". In standalone builds we therefore import a pinned ESM URL.
 * In bundler builds (npm) the normal package import is used.
 *
 * If the import fails, the error propagates to the caller and is shown to the user — there is no
 * silent substitute.
 */
declare const __STANDALONE__: boolean | undefined;

const DEFAULT_TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/+esm";
const DEFAULT_WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm";
const DEFAULT_ORT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.all.bundle.min.mjs";

const urls = { transformers: DEFAULT_TRANSFORMERS_URL, webllm: DEFAULT_WEBLLM_URL, ort: DEFAULT_ORT_URL };

export function configureModelLoader(opts: { transformersUrl?: string; webllmUrl?: string; ortUrl?: string }) {
  if (opts.transformersUrl) urls.transformers = opts.transformersUrl;
  if (opts.webllmUrl) urls.webllm = opts.webllmUrl;
  if (opts.ortUrl) urls.ort = opts.ortUrl;
}

const isStandalone = () => typeof __STANDALONE__ !== "undefined" && __STANDALONE__ === true;

let transformersPromise: Promise<any> | null = null;

export function loadTransformers(): Promise<any> {
  const w = typeof window !== "undefined" ? (window as any) : null;
  if (w?.transformers?.pipeline) return Promise.resolve(w.transformers);
  if (!transformersPromise) {
    transformersPromise = (
      isStandalone() ? import(/* @vite-ignore */ urls.transformers as any) : import("@huggingface/transformers")
    ).catch((e: unknown) => {
      transformersPromise = null; // allow retry
      throw new Error(`Could not load transformers.js (${isStandalone() ? urls.transformers : "@huggingface/transformers"}): ${e instanceof Error ? e.message : String(e)}`);
    });
  }
  return transformersPromise;
}

let webllmPromise: Promise<any> | null = null;

export function loadWebLLM(): Promise<any> {
  const w = typeof window !== "undefined" ? (window as any) : null;
  if (w?.webllm?.CreateMLCEngine) return Promise.resolve(w.webllm);
  if (!webllmPromise) {
    webllmPromise = (isStandalone() ? import(/* @vite-ignore */ urls.webllm as any) : import("@mlc-ai/web-llm")).catch((e: unknown) => {
      webllmPromise = null;
      throw new Error(`Could not load WebLLM (${isStandalone() ? urls.webllm : "@mlc-ai/web-llm"}): ${e instanceof Error ? e.message : String(e)}`);
    });
  }
  return webllmPromise;
}

let ortPromise: Promise<any> | null = null;

export function loadOrt(): Promise<any> {
  const w = typeof window !== "undefined" ? (window as any) : null;
  if (w?.ort?.InferenceSession) return Promise.resolve(w.ort);
  if (!ortPromise) {
    const ortUrl = urls.ort as any;
    ortPromise = import(/* @vite-ignore */ ortUrl)
      .then((m) => m.default || m)
      .catch((e: unknown) => {
        ortPromise = null;
        if (w?.ort?.InferenceSession) return w.ort;
        throw new Error(`Could not load onnxruntime-web: ${e instanceof Error ? e.message : String(e)}`);
      });
  }
  return ortPromise;
}
