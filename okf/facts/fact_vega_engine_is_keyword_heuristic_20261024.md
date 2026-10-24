---
id: fact_vega_engine_is_keyword_heuristic_20261024
entity: vega_decision_engine
layer: current
valid_from: 2026-10-24
author: claude-code
trust: machine-confirmed
---

# VegaDecisionEngine loads no model: it is a keyword-overlap heuristic (mandate §7 issue)

Evidence: `frontend/src/lib/vegaEngine.ts` (read 2026-10-24).
- **No model weights.** No fetch, ONNX or transformers.js call. "14.3M parameters, 57 MB" (header comment; also `escalationManager.ts:227`) refers to NandhaKishorM/vegaml, which is never loaded.
- **The vectors carry no meaning.** `hashStringToVector` = FNV-1a hash → xorshift → Gaussian 64-D vector. Similar text does NOT give similar vectors. All the actual signal comes from keyword overlap: `+1.8` per state token found in the option text, and `+2.2` / `+2.5` grounding counts for booleans.
- **The "conformal prediction set" is not conformal.** It is a fixed `probs >= 0.15` filter (`conformalThreshold = 0.85`, line ~403), with no calibration split. "Calibrated" probabilities come from hand-set theta constants, not from fitting.
- **The UI repeats these claims:** `DecisionCard.tsx:332` "Conformal Set", `escalationManager.ts:1534` "Vega Physics Engine (Hamiltonian Euler)", and the "calibrated confidence" wording in `ensembleDecision.ts:230`.

## Answer to "does on-device chat use Vega effectively?"
Effectiveness is unmeasured (there is no labelled eval set), and the labels overstate what runs.
The Hamiltonian relaxation is real code, but it relaxes over random wells, so the decision quality equals the keyword-overlap score.

## Options (user decision pending)
1. **Relabel (minimum, §7):**
   - "keyword-overlap scorer with physics-style relaxation";
   - drop "14.3M", "conformal" and "calibrated" from the UI;
   - rename to "candidate set".
2. **Measure:** 100+ labelled decisions from real sessions. Compare accuracy against plain keyword overlap without the Hamiltonian step, and against the Laya fallback. Keep Vega only if it wins.
3. **Make it real:** check whether vegaml has a browser-runnable export (ONNX / transformers.js). If yes, load it with real embeddings and fit a conformal threshold on a calibration split. If no, Option 1 stands.

## Update 2026-10-24 (source: author's post https://www.nandakishorm.com/writing/vega, dated 2026-10-10)
- **Real Vega = a frozen Qwen3.5-0.8B reader plus a trained 14.3M engine.**
  - It reads hidden states at layers 13 and 19, pools them into state, question and answer vectors, then runs 12 damped-Hamiltonian steps over Gaussian wells.
  - So "14.3M, avoids the 4.5 GB download" in our code is wrong: the 14.3M part is useless without the 800M reader.
- **Our `vegaEngine.ts` reproduces the post's browser DEMO, not the model.** The author says of that demo: "the valley depths here come from plain word matching".
- **Self-reported results (author, 2026-10-11):**
  - 0.8B: accuracy 0.556 macro on 43 tasks, 0.509 on DecisionBench (ECE 0.103), p50 74 ms on the author's hardware;
  - 4B: 0.717 / 0.633.
  - Its strength is calibration and abstention, not raw accuracy. A hosted LLM scored higher on accuracy.
- **Distribution:**
  - `pip install vegaml` (Python/torch), GitHub NandhaKishorM/vegaml;
  - weights on HF `nandakishorm/vega-08b-public-intents`;
  - no ONNX/JS/WASM export is stated;
  - Apache 2.0 per the post; the footer says only "code", so check the HF card.
- **Consequence:**
  - Making it real in the browser means Qwen3.5-0.8B on WebGPU via transformers.js with hidden-state output, plus porting the 14.3M engine to ONNX/JS ourselves. The <5 ms claim cannot hold.
  - The alternative is a Python host. A Cloudflare Worker cannot run torch.
