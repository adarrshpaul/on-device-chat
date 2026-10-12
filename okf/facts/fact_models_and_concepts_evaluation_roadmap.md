---
id: fact_models_and_concepts_evaluation_roadmap
subject: edgeoperator-ai-models-and-generative-ui-evaluation
predicate: architectural-vetting-and-p0-p3-prioritization
valid_from: 2026-10-12T04:25:00Z
valid_to: null
confidence: 1.0
source: claude-p-consultation-and-graveyard-autopsy
---

# Fact: AI Models & Generative UI Strategic Evaluation

Comprehensive architectural and product evaluation of four external AI projects/models conducted via `claude -p` consultation, commercial market validation (TrustMRR), and startup graveyard autopsy (Startups.rip - Delve W24):

### 1. Evaluated Candidates & Strategic Priority Matrix

| Candidate | Category | Proposed Tier | Priority | Core Rationale & Customer Impact |
|---|---|---|---|---|
| **thesysdev/open-intelligent-ui (DIL / OpenUI)** | Declarative Component Stream | All Tiers (Shared Contract) | **P0 (Immediate)** | Transforms 380px widget from a static markdown pipe into interactive, typed widgets (`batchPreview` table, `paramForm` with validators, `confirm` cards, `choices` pills). Zero weight download. Every component binds to a live `ElementRef` scanned from `a11yTreeEngine`. |
| **vllm-sr/d3-nano (2B)** | "System One" Multimodal Decision Model | Tier 2 Edge / Tier 1 CoreML | **P1 (High-Value Fast-Follow)** | Sub-10ms single-forward-pass route/candidate scoring across physical DOM elements when Vega confidence margin is tight (`margin < 0.15`). Replaces token generation with calibrated decision logits. |
| **AxiomicLabs/GPT-X3-150M** | 150M Base SLM (GDN2/GQA) | Tier 1 WebGPU (Alternative) | **P2 (Deferred)** | Base model lacking instruction tuning; non-standard hybrid architecture risks WebGPU / ORT-web kernel incompatibilities. Minor gain over SmolLM2 in page Q&A doesn't justify migration effort. |
| **microsoft/AesCode-8B** | 8B Aesthetic Code / Design Model | Cloud / Niche Report Tool | **P3 (Skip / Defocus)** | Generates new web landing pages/slides; EdgeOperator **operates existing UIs**. Generating raw HTML in an embedded customer widget introduces XSS surfaces and violates lightweight budget. |

### 2. Defensibility & Graveyard Defense (Rule 7 & Rule 8)
- **Delve (W24) Autopsy Defense:** Startup failed due to customer churn from "simulated automation" that failed on physical DOMs. EdgeOperator avoids this by enforcing that all `UISpec` actions are statically bound to live `ElementRef` scanned at runtime (`bindOrDrop()`), re-verified upon user interaction, and validated via `stateDeltaVerifier`.
- **Honest Telemetry Mandate:** All latencies and confidence scores displayed in decision traces must be physically measured via `performance.now()` and live cosine/logit math, strictly barring synthetic mock scores.
