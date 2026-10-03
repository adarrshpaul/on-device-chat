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
      name: 'Gemma4Agent',
      formats: ['iife'],
      fileName: () => 'gemma4-agent.min.js'
    },
    rollupOptions: {
      // For standalone script tag, bundle React so vanilla HTML pages don't need npm
      external: [
        '@huggingface/transformers',
        '@mlc-ai/web-llm'
      ]
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
