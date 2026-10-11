You are acting as the Principal Systems Architect and Red-Team AI Auditor.

I need you to conduct an unsparing, brutally honest architectural and code quality audit of the on-device browser agent harness we have built in this repository (`gemma4-chat-agent/frontend` and `extension/`), known as **EdgeOperator** (formerly `on-device-chat`).

The user feels the harness has serious underlying issues, fragility, and excessive hardcoding, and wants your definitive technical verdict.

Please inspect the following files directly on disk:
1. `okf/entities/chat-widget/states/2026-10-11-edgeoperator-industrial-ot-wbm-and-dual-compatibility.md`
2. `frontend/src/lib/escalationManager.ts` (Inspect the 14 intent handlers, 38+ regexes, and synthetic decision traces)
3. `frontend/src/lib/agentHarness.ts` (Inspect the ReAct loop, 5 canonical primitives, catalog word filters on lines 543-558, and loop breakers)
4. `frontend/src/lib/vegaEngine.ts` and `frontend/src/lib/layaEngine.ts` (Inspect local execution fallbacks: string hashing Box-Muller simulation and Laplace keyword counters)
5. `frontend/src/lib/workflowPredictor.ts` & `frontend/src/lib/batchEngine.ts` (Inspect dynamic WBM commit and tree discovery, table row selector synthesis)
6. `frontend/src/lib/navPersistence.ts` (Inspect sessionStorage persistence across hard page transitions)
7. `frontend/src/components/ChatWidget.tsx`, `ChatHeader.tsx`, `ChatInput.tsx`, and `frontend/src/index.css` (Inspect UI isolation, z-index 2147483647, inline styles)

Also read our detailed dossier at:
`/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/edgeoperator_harness_adversarial_context_dossier.md`

And inspect the visual UI evidence screenshots located at:
- `/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/scalance_edgeoperator_live.png` (Siemens SCALANCE WBM Live)
- `/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/adversarial_immunity_test.png` (Hostile CSS stress test)
- `/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/basketball_consistent_docked_ui.png` (Canvas game auto-docking)
- `/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/basketball_mini_hud_active.png` (Mini HUD 52px bar)
- `/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/amazon_consistent_dark_ui.png` (Amazon dark input isolation)
- `/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/complex_saucedemo_batch_confirmation.png` (Teach 1 -> Batch N diff card)

Please structure your assessment into these 5 sections:

### 1. Executive Verdict & True Quality Score (1–100)
- Is this a genuine autonomous web agent, or an elaborate rule-based expert system disguised with simulated AI telemetry?
- What is the true technical grade?

### 2. Exhaustive Audit of Hardcoded Logic, Faked Telemetry & Benchmark Overfitting
- Call out specific line numbers and patterns where we bypass LLMs or fake decisions.
- Dissect the Giskard benchmark cheating in `agentHarness.ts` (catalog filtering).
- Dissect the synthetic `DecisionTrace` records (hardcoded 0.94-1.0 confidence, fake latency, fake winning margins).
- Dissect the pseudo-random physics in `vegaEngine.ts` and keyword counting in `layaEngine.ts`.

### 3. Chat Assistant UI & Ergonomics Assessment
- Critique the UI design, CSS isolation (`z-index: 2147483647`, obsidian glass, inline defensive styles), zero-occlusion docking, and Mini HUD bar based on the screenshots and code.
- Assess plant-floor usability for industrial technicians on rugged laptops (Panasonic Toughbook) under outdoor/high-glare environments.

### 4. Critical Failure Modes & Brittleness
- Where will this harness break when deployed on real industrial switches (Siemens, Schneider, Moxa, Phoenix Contact) or arbitrary real-world websites?
- Multi-page hard reloads (`window.location.href`) vs. `sessionStorage` state machine.
- Frame/frameset architectures and synchronous native alerts (`window.alert`).
- Indirect prompt injection in DOM attributes.

### 5. Architectural Roadmap & Recommended Refactor
- How should Antigravity refactor this codebase?
- What should be removed immediately?
- How to transition from regex fast-paths to a genuine, sub-15MB on-device neural decision head without blowing up latency?
- Concrete architectural next steps.
