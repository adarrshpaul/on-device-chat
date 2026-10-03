#!/usr/bin/env bash
# =============================================================================
# Gemma 4 E2B → MLC/WebGPU Browser Export
# =============================================================================
#
# Converts the fine-tuned merged model into MLC format for WebLLM (browser).
# Produces:
#   1. Quantized weight shards (q4f16_1)
#   2. MLC config (mlc-chat-config.json)
#   3. Compiled WebGPU WASM library
#
# Prerequisites:
#   pip install mlc-llm mlc-ai-nightly
#
# Usage:
#   ./export_to_browser.sh [path-to-merged-model]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MERGED_MODEL="${1:-$PROJECT_DIR/outputs/merged}"
DIST_DIR="$PROJECT_DIR/outputs/mlc-dist"
MODEL_NAME="gemma4-e2b-function-calling"

echo "╔══════════════════════════════════════════════╗"
echo "║  Gemma 4 E2B → Browser (MLC/WebGPU) Export   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Source: $MERGED_MODEL"
echo "  Output: $DIST_DIR"
echo ""

# ── Check prerequisites ─────────────────────────────────────────────────────

if ! python -c "import mlc_llm" 2>/dev/null; then
    echo "❌ mlc-llm not installed."
    echo "   Run: pip install mlc-llm mlc-ai-nightly"
    exit 1
fi

if [ ! -d "$MERGED_MODEL" ]; then
    echo "❌ Merged model not found at: $MERGED_MODEL"
    echo "   Run train.py first, or provide path as argument."
    exit 1
fi

mkdir -p "$DIST_DIR/$MODEL_NAME"

# ── Step 1: Convert weights (4-bit quantization) ────────────────────────────

echo ""
echo "━━━ Step 1/3: Converting & quantizing weights ━━━"
echo "    Quantization: q4f16_1 (4-bit float16, group size 32)"
echo ""

python -m mlc_llm convert_weight \
    "$MERGED_MODEL" \
    --quantization q4f16_1 \
    -o "$DIST_DIR/$MODEL_NAME"

echo "✅ Weights converted."

# ── Step 2: Generate config ─────────────────────────────────────────────────

echo ""
echo "━━━ Step 2/3: Generating MLC config ━━━"
echo ""

python -m mlc_llm gen_config \
    "$MERGED_MODEL" \
    --quantization q4f16_1 \
    --conv-template gemma \
    --context-window-size 2048 \
    --prefill-chunk-size 1024 \
    -o "$DIST_DIR/$MODEL_NAME"

echo "✅ Config generated."

# ── Step 3: Compile WebGPU library ──────────────────────────────────────────

echo ""
echo "━━━ Step 3/3: Compiling WebGPU WASM library ━━━"
echo "    This creates the binary that runs in the browser."
echo ""

python -m mlc_llm compile \
    "$DIST_DIR/$MODEL_NAME/mlc-chat-config.json" \
    --device webgpu \
    -o "$DIST_DIR/$MODEL_NAME/${MODEL_NAME}-webgpu.wasm"

echo "✅ WebGPU WASM library compiled."

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║            ✅ Export Complete!                ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  Output files in: $DIST_DIR/$MODEL_NAME      ║"
echo "║                                              ║"

echo ""
echo "  Files:"
ls -lh "$DIST_DIR/$MODEL_NAME/" | grep -E "(\.wasm|\.json|params)" | while read -r line; do
    echo "    $line"
done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  To use in the chat widget, update frontend config:     ║"
echo "║                                                         ║"
echo "║  In vite.config.ts, copy the MLC dist to public/:       ║"
echo "║    cp -r $DIST_DIR/$MODEL_NAME frontend/public/model/   ║"
echo "║                                                         ║"
echo "║  Then in your widget init:                              ║"
echo "║    Gemma4Agent.init({                                   ║"
echo "║      modelId: 'gemma4-e2b-function-calling',            ║"
echo "║      ...                                                ║"
echo "║    });                                                  ║"
echo "║                                                         ║"
echo "║  OR upload to HuggingFace and reference the URL.        ║"
echo "╚══════════════════════════════════════════════════════════╝"
