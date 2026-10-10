# State: Multi-Model Ensemble Consensus & Autonomous Website Workflows

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Layer:** current
- **Version:** `0.1.9`
- **Status:** Active / Production Deployed
- **Valid_from:** 2026-10-10T03:55:00Z

## Summary
The on-device chat widget and browser copilot incorporates Jev-style non-autoregressive decision making powered by a Multi-Model Ensemble Decision (MMED) engine, pooling judgments across Laya System 1 (non-autoregressive RLCD reflex head), MiniLM-L6-v2 (semantic dense vector alignment), and System 2 (Gemini Nano / SmolLM2 logical verifiers). Every candidate action and button click executes immediately on the live DOM and yields tangible output telemetry (status, target selector, DOM delta, and duration). A dedicated Website Workflow & Automation system (`WorkflowStudio`, `WorkflowRunner`, `WorkflowStore`) enables users to build, save, edit, and repeat multi-step site automations again and again with 0 prompt token overhead.

## Active Invariants & Rules
1. `Ensemble Consensus`: Candidate actions are scored simultaneously across available on-device models to produce calibrated aggregate probability, agreement ratio, and margin over runner-up.
2. `Guaranteed Action Output`: Clicking ANY interactive action button or choice pill executes the action on the webpage and immediately renders an `ActionOutputCard` displaying target element, execution status, DOM delta, and latency in milliseconds.
3. `Deterministic Workflows`: Users can build multi-step web macros (scroll, click, type, teleport, verify, wait) stored locally in IndexedDB (`gemma4_web_workflows`), executable with 1-click repeatedly with zero prompt token consumption.
4. `Noul Evidence Proof`: Every executed action or workflow step verifies live DOM element presence and visibility to enforce the Zero-Hallucination Shield.
