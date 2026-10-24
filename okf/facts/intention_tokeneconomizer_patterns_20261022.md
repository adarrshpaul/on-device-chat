---
id: intention_tokeneconomizer_patterns_20261022
entity: on_device_chat
property: context_cost_control
layer: intention
status: proposed (advisor; nothing built)
valid_from: 2026-10-22T12:45:00Z
valid_to: null
author: claude-code
trust: verified-metadata (GitHub API + README 2026-10-22)
sources: [https://github.com/microsoft/TokenEconomizer, https://arxiv.org/abs/2610.22732]
relates_to: [intention_openui_generative_answers_20261022]
---

# Using Microsoft TokenEconomizer ideas in on-device-chat

## What it is (verified)
Apache-2.0 plugin (MSR + UC Berkeley, 145 stars, pushed 2026-10-22) for **coding agents** (Claude Code, Codex, Copilot CLI, Pi).
It is NOT a library for chat apps, so it can't be dropped in. It has three mechanisms, learned from finished sessions, stored locally, no model calls:
micro-skills (recurring environment facts injected at session start), tool pruning (tools unused for 5 sessions are dropped),
and failure-loop intervention (one redirect, then tell the user; never auto-stop). The paper *reports* 18.4–30.9% lower cost on SWE-Bench (their numbers, not ours).

## Why it matters on-device
Our tokens cost no money, but they cost **prefill latency and context window** (small WebLLM / Gemini Nano contexts are tiny).
So port the *ideas*; don't import the code.

| TokenEconomizer | on-device-chat port |
|---|---|
| Micro-skills per repo | **Per-origin site facts** learned from finished sessions (e.g. "search submits on Enter", "cart button re-renders → re-acquire"), in IndexedDB, injected at session start. Formed only from recurring evidence; retired when contradicted. Each fact is **re-verified against the live DOM before use** (Rule 9: a hint, never a hardcoded workflow). |
| Tool pruning | **Per-origin prompt pruning**: drop actions/tools and OpenUI components (TASK-107) unused on this origin for N sessions → shorter prompt, faster prefill, fits small contexts. Announce in one line; one click restores. |
| Failure-loop intervention | Detect the same failing selector/click/plan repeated K times → one re-plan hint, then tell the user "stuck: stop or teach me". Never silently retry forever. |
| Cache-aware cost | Keep a stable system-prompt prefix so WebLLM can reuse its KV cache; log prefill tokens + ms per turn as the real metric. |

## Measure (Rule 7)
Fixed set of tasks on 3 real sites, run repeatedly from empty memory: prefill tokens/turn, time to first token, task success.
Claim savings only from these runs.

## Separate option: use the plugin itself for our own dev agents
Installing it in Claude Code/Copilot could cut OUR agent costs across these repos. The user must install it themselves.
Recommend `toolprune=propose` (default auto-denies tools without asking).
