---
type: event
timestamp: 2026-10-03T05:28:00Z
entity: chat-widget
---

# Event: Complete npm Publish Audit and Optimization

Conducted pre-publish audit with `npm pack --dry-run` and bundle static analysis. Resolved 6 critical blockers:

1. **Private Flag**: Removed `"private": true` from `package.json` to allow publishing.
2. **Bundle Bloat & Inlined WASM**: Identified that `onnxruntime-web` was inlining 71.6 MB of base64 WASM binaries. Externalized `react`, `react-dom`, `@huggingface/transformers`, `@mlc-ai/web-llm`, `lucide-react`, and `marked` in `vite.config.ts`.
   - **Result**: Reduced bundle from 76 MB to 128 kB (ESM) / 89 kB (CJS).
   - **Tarball size**: Reduced from 45.3 MB down to 553 kB (98.8% reduction!).
   - **Unpacked size**: Reduced from 160.5 MB down to 2.7 MB.
3. **React Duplication & Hooks Invalidation**: Moved `react` and `react-dom` to `peerDependencies` to prevent duplicate React instances in downstream consumer apps.
4. **TypeScript Declarations**: Created `tsconfig.build.json` with `declaration: true` and `emitDeclarationOnly: true`. Generated full type definitions in `dist/*.d.ts`.
5. **Entry Points & Exports Map**: Created `src/index.ts` with dual export support (`<ChatWidget />` React component + `Gemma4Agent` imperative singleton). Added standard `"exports"`, `"main"`, `"module"`, `"types"`, and `"files"` fields to `package.json`.
6. **Documentation & Licensing**: Created Apache-2.0 `LICENSE` and comprehensive `README.md` with React and Vanilla JS installation examples.

## Verification
- Verified via `npm run build && npm pack --dry-run` (exit code 0).
- Dev server verified operational at `http://localhost:5173/`.
