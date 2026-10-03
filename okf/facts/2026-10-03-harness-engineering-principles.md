---
type: fact
subject: agent-harness-engineering
predicate: architectural_alignment
object: anthropic_and_osmani_harness_principles
valid_from: 2026-10-03T05:11:00Z
learned_at: 2026-10-03T05:11:00Z
trust: machine-confirmed
---

# Fact: Alignment with Anthropic & Addy Osmani Harness Engineering Principles

1. **Equation**: `Agent = Model + Harness`. For small on-device models (Gemini Nano, SmolLM2, Gemma 4), harness engineering provides the majority of task reliability.
2. **The Ratchet Principle**: Agent mistakes are treated as deterministic architectural signals. Failures are captured in OKF and permanently resolved via harness loop guards (failure accumulator, signature sets, pilot's checklist prompts) rather than one-off prompt tweaks.
3. **Generator-Evaluator Separation**: Confirms Anthropic's finding that agents cannot reliably self-evaluate ("confidently praising mediocrity"). Standalone `ExpertJudge` with live DOM inspection, multi-engine prediction fallback, and 4 concrete criteria (task completion, tool selection, safety discipline, step efficiency) mirrors Anthropic's GAN-style evaluator.
4. **Context Engineering**: Validates memory compaction (`mem://` storage for observations >800 chars) and the "success is silent, failures are verbose" back-pressure principle.
5. **Deterministic Macro Compilation**: Implements continual learning through `recipeStore` to eliminate token overhead on repeated verified web trajectories.
