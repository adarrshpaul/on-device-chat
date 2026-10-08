import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Standalone self-contained build for CDN / vanilla HTML <script> embedding
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/main.tsx',
      name: 'OnDeviceChat',
      formats: ['iife'],
      fileName: () => 'on-device-chat.min.js'
    },
    rollupOptions: {
      // For standalone script tag, bundle React so vanilla HTML pages don't need npm
      external: [
        '@huggingface/transformers',
        '@mlc-ai/web-llm'
      ],
      output: {
        globals: {
          '@huggingface/transformers': '(typeof window !== "undefined" && window.transformers ? window.transformers : { LogitsProcessorList: class {}, LogitsProcessor: class {}, env: {}, ModelRegistry: { is_pipeline_cached: () => Promise.resolve(false) }, TextStreamer: class {}, pipeline: () => Promise.resolve() })',
          '@mlc-ai/web-llm': '(typeof window !== "undefined" && window.webllm ? window.webllm : { prebuiltAppConfig: { model_list: [] }, hasModelInCache: () => Promise.resolve(false), CreateMLCEngine: () => Promise.reject(new Error("WebLLM not loaded")) })'
        }
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    '__STANDALONE__': 'true'
  }
});
