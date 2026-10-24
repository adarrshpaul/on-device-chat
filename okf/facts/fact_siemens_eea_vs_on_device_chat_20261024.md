---
id: fact_siemens_eea_vs_on_device_chat_20261024
entity: on_device_chat
property: competitor_comparison_siemens_eea
layer: current
valid_from: 2026-10-24
author: claude-code
trust: vendor-docs (EEA V1.5.1 docs, 5 pages read 2026-10-24); our side machine-confirmed from code
---

# Siemens Eigen Engineering Agent (EEA) vs on-device-chat

Sources read: docs.tia.siemens.cloud .../eigen-engineering-agent/ (get-to-know, overview, key capabilities, PLC code sample prompts, system requirements).

- **Different categories.** EEA is a domain copilot inside TIA Portal; it edits the project through the TIA API (LAD/SCL blocks, tags, DBs, hardware, SINAMICS drives, WinCC Unified screens and JS, translations, generated test cases, Siemens/SICAR automation frameworks). on-device-chat is a general browser agent (widget + extension) that acts on arbitrary web pages through the DOM/CDP.
- **EEA advantage:** acts through a structured object model (the project), not pixels or DOM, so its actions are typed and checkable. It takes documents as input (@xlsx, @pdf, @md plan). The docs say it "fully executes tasks".
- **Ours:** local inference (WebLLM), no account, any website, trusted input as of TASK-111. Weak spots: the Vega scorer is a keyword heuristic (fact_vega_engine_is_keyword_heuristic_20261024); no irreversible-action gate yet (TASK-112); no document ingestion.
- **Unknown about EEA:** backend model, cloud vs local, approval/undo, pricing. Pages not read: Used cloud services, Data security, Licensing, FAQ.
- **Closer analogue in our portfolio:** the OpenPLC Web Studio assistant, which also generates ST/LD and compiles it in a real engine.
- **Ideas worth taking (not queued):**
  - a "typed adapter" mode: when a site exposes a structured API/state, act through it instead of the DOM;
  - @file ingestion;
  - generated test cases for recorded macros (pairs with self-healing locators, TASK-114 item 6);
  - for OpenPLC, EEA's prompt set (LAD→SCL convert, explain block, remove unused via cross-refs, implement plan from .md) as an assistant feature checklist.
