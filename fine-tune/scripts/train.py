#!/usr/bin/env python3
"""
=============================================================================
Gemma 4 E2B — Function-Calling Fine-Tune + Browser Export Pipeline
=============================================================================

This script fine-tunes Gemma 4 E2B for reliable tool/function calling,
then exports it to formats shippable in the browser.

Pipeline:
  1. Load Gemma 4 E2B via Unsloth (4-bit QLoRA)
  2. Prepare function-calling dataset (Glaive v2 + xLAM mix)
  3. Fine-tune with LoRA adapters
  4. Merge adapters → full model
  5. Export to GGUF (quantized, text-only)
  6. Convert GGUF → MLC format for WebLLM/WebGPU

Hardware: ~8-10 GB VRAM (M1/M2 Mac, RTX 3060, free Colab T4)
License:  Apache 2.0 (Gemma 4 + datasets + Unsloth)
"""

import os
import json
import argparse
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────────────────────

BASE_MODEL = "unsloth/gemma-4-e2b-it-unsloth-bnb-4bit"
MAX_SEQ_LENGTH = 2048
LORA_R = 16
LORA_ALPHA = 16
LORA_DROPOUT = 0.0
LEARNING_RATE = 2e-4
EPOCHS = 3
BATCH_SIZE = 2
GRAD_ACCUM_STEPS = 4
OUTPUT_DIR = Path(__file__).parent / "outputs"
GGUF_OUTPUT_DIR = OUTPUT_DIR / "gguf"
MERGED_OUTPUT_DIR = OUTPUT_DIR / "merged"


def check_dependencies():
    """Verify all required packages are installed."""
    required = ["unsloth", "trl", "datasets", "peft", "transformers"]
    missing = []
    for pkg in required:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"❌ Missing packages: {', '.join(missing)}")
        print(f"   Run: pip install unsloth trl datasets peft transformers accelerate bitsandbytes")
        raise SystemExit(1)
    print("✅ All dependencies found")


def load_model():
    """Load Gemma 4 E2B with Unsloth 4-bit quantization + LoRA adapters."""
    from unsloth import FastLanguageModel

    print(f"\n📦 Loading {BASE_MODEL}...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL,
        max_seq_length=MAX_SEQ_LENGTH,
        load_in_4bit=True,
    )

    print("🔧 Applying LoRA adapters...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_R,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    trainable, total = model.get_nb_trainable_parameters()
    print(f"   Trainable: {trainable:,} / {total:,} ({100*trainable/total:.1f}%)")

    return model, tokenizer


def prepare_dataset(tokenizer):
    """
    Load and format function-calling training data.

    Uses Glaive Function Calling v2 — 113k conversations with tool schemas.
    Each example has:
      - system prompt defining available tools
      - user query
      - assistant response (either direct answer or tool_call)
      - tool result → final assistant response

    The data is formatted into Gemma 4's chat template.
    """
    from datasets import load_dataset

    print("\n📊 Loading function-calling dataset...")
    dataset = load_dataset(
        "glaiveai/glaive-function-calling-v2",
        split="train",
    )

    # Take a subset for faster iteration (increase for production)
    dataset = dataset.shuffle(seed=42).select(range(min(10000, len(dataset))))
    print(f"   Using {len(dataset)} training examples")

    def format_example(example):
        """Convert Glaive format to Gemma 4 chat template."""
        try:
            # Glaive v2 has 'system', 'chat' columns
            system_content = example.get("system", "")
            chat_content = example.get("chat", "")

            # Parse the chat into messages
            messages = []
            if system_content:
                messages.append({"role": "system", "content": system_content.strip()})

            # Parse chat turns (Glaive uses USER:/ASSISTANT:/FUNCTION RESPONSE: markers)
            if chat_content:
                lines = chat_content.strip().split("\n")
                current_role = None
                current_content = []

                for line in lines:
                    line = line.strip()
                    if line.startswith("USER:"):
                        if current_role and current_content:
                            messages.append({
                                "role": current_role,
                                "content": "\n".join(current_content).strip()
                            })
                        current_role = "user"
                        current_content = [line[5:].strip()]
                    elif line.startswith("ASSISTANT:"):
                        if current_role and current_content:
                            messages.append({
                                "role": current_role,
                                "content": "\n".join(current_content).strip()
                            })
                        current_role = "assistant"
                        current_content = [line[10:].strip()]
                    elif line.startswith("FUNCTION RESPONSE:"):
                        if current_role and current_content:
                            messages.append({
                                "role": current_role,
                                "content": "\n".join(current_content).strip()
                            })
                        current_role = "tool"
                        current_content = [line[18:].strip()]
                    elif line:
                        current_content.append(line)

                if current_role and current_content:
                    messages.append({
                        "role": current_role,
                        "content": "\n".join(current_content).strip()
                    })

            if len(messages) < 2:
                return {"text": ""}

            # Apply Gemma 4 chat template
            text = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
            )
            return {"text": text}

        except Exception:
            return {"text": ""}

    print("   Formatting into Gemma 4 chat template...")
    dataset = dataset.map(format_example, remove_columns=dataset.column_names)
    dataset = dataset.filter(lambda x: len(x["text"]) > 50)
    print(f"   Final dataset: {len(dataset)} examples")

    return dataset


def train(model, tokenizer, dataset):
    """Fine-tune with SFTTrainer (Unsloth-optimized)."""
    from trl import SFTTrainer
    from transformers import TrainingArguments

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n🚀 Starting fine-tuning...")
    print(f"   Epochs: {EPOCHS}")
    print(f"   Batch size: {BATCH_SIZE} x {GRAD_ACCUM_STEPS} grad accum")
    print(f"   Learning rate: {LEARNING_RATE}")
    print(f"   Output: {OUTPUT_DIR}")

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        args=TrainingArguments(
            per_device_train_batch_size=BATCH_SIZE,
            gradient_accumulation_steps=GRAD_ACCUM_STEPS,
            num_train_epochs=EPOCHS,
            learning_rate=LEARNING_RATE,
            warmup_steps=20,
            fp16=True,
            logging_steps=10,
            save_steps=200,
            save_total_limit=2,
            output_dir=str(OUTPUT_DIR / "checkpoints"),
            optim="adamw_8bit",
            seed=42,
        ),
    )

    stats = trainer.train()
    print(f"\n✅ Training complete!")
    print(f"   Total steps: {stats.global_step}")
    print(f"   Final loss: {stats.training_loss:.4f}")

    return trainer


def export_gguf(model, tokenizer):
    """
    Export to GGUF format (quantized, text-only inference).

    GGUF is the intermediate format — we quantize here,
    then convert to MLC for browser shipping.
    """
    GGUF_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n📦 Exporting to GGUF...")
    print(f"   Output: {GGUF_OUTPUT_DIR}")

    # Unsloth has built-in GGUF export
    model.save_pretrained_gguf(
        str(GGUF_OUTPUT_DIR),
        tokenizer,
        quantization_method="q4_k_m",  # 4-bit quantized — good balance of quality/size
    )

    # Also export q8_0 for higher quality if needed
    model.save_pretrained_gguf(
        str(GGUF_OUTPUT_DIR),
        tokenizer,
        quantization_method="q8_0",
    )

    print(f"✅ GGUF files saved:")
    for f in GGUF_OUTPUT_DIR.iterdir():
        if f.suffix == ".gguf":
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"   {f.name} ({size_mb:.1f} MB)")


def export_merged(model, tokenizer):
    """Export merged model (LoRA adapters baked in) for MLC conversion."""
    MERGED_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n📦 Exporting merged model (for MLC conversion)...")
    model.save_pretrained_merged(
        str(MERGED_OUTPUT_DIR),
        tokenizer,
        save_method="merged_16bit",
    )
    print(f"✅ Merged model saved to: {MERGED_OUTPUT_DIR}")


def print_mlc_instructions():
    """Print instructions for converting to MLC/WebLLM format."""
    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║          NEXT STEP: Convert to MLC for Browser Shipping         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  The merged model is at: {MERGED_OUTPUT_DIR}                     ║
║                                                                  ║
║  To compile for WebLLM/WebGPU, run:                              ║
║                                                                  ║
║  1. Install MLC-LLM:                                             ║
║     pip install mlc-llm mlc-ai-nightly                           ║
║                                                                  ║
║  2. Convert weights:                                             ║
║     python -m mlc_llm convert_weight \\                           ║
║       {MERGED_OUTPUT_DIR} \\                                      ║
║       --quantization q4f16_1 \\                                   ║
║       -o ./dist/gemma4-e2b-fc-MLC                                ║
║                                                                  ║
║  3. Generate config:                                             ║
║     python -m mlc_llm gen_config \\                               ║
║       {MERGED_OUTPUT_DIR} \\                                      ║
║       --quantization q4f16_1 \\                                   ║
║       --conv-template gemma \\                                    ║
║       -o ./dist/gemma4-e2b-fc-MLC                                ║
║                                                                  ║
║  4. Compile WebGPU library:                                      ║
║     python -m mlc_llm compile \\                                  ║
║       ./dist/gemma4-e2b-fc-MLC/mlc-chat-config.json \\            ║
║       --device webgpu \\                                          ║
║       -o ./dist/gemma4-e2b-fc-lib.wasm                           ║
║                                                                  ║
║  5. Upload to HuggingFace / CDN and reference in WebLLM config   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")


def main():
    parser = argparse.ArgumentParser(description="Gemma 4 E2B Function-Calling Fine-Tune Pipeline")
    parser.add_argument("--skip-train", action="store_true", help="Skip training, just export")
    parser.add_argument("--dataset-size", type=int, default=10000, help="Number of training examples")
    parser.add_argument("--epochs", type=int, default=EPOCHS, help="Training epochs")
    parser.add_argument("--export-only", action="store_true", help="Only export GGUF from existing checkpoint")
    args = parser.parse_args()

    global EPOCHS
    EPOCHS = args.epochs

    check_dependencies()
    model, tokenizer = load_model()

    if not args.skip_train and not args.export_only:
        dataset = prepare_dataset(tokenizer)
        train(model, tokenizer, dataset)

    export_gguf(model, tokenizer)
    export_merged(model, tokenizer)
    print_mlc_instructions()


if __name__ == "__main__":
    main()
