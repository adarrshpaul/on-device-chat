---
id: intention_best_harness_techniques_voice_20261024
entity: agent_harness
property: technique_import_claude_code_deepseek_wispr
layer: intention
status: proposed
valid_from: 2026-10-24
author: claude-code
trust: machine-confirmed (code grep 2026-10-24); DeepSeek/Wispr details third-party, unverified
depends_on: [intention_harness_browser_automation_superpowers_20261024, intention_on_device_chat_improvement_plan_20261024]
---

# Import "best harness" techniques into on-device-chat (user request 2026-10-24)

**Interpretation:** copy techniques from Claude Code, DeepSeek's agent stack and Wispr Flow into the on-device harness.
NOT "route tasks to cloud Claude/DeepSeek" (that drops the on-device premise). A cloud path exists already (`geminiApiEngine.ts`) if the user wants a backend option.

## Map: technique → what exists → real gap
| Technique | Source | Already in repo / queue | Gap |
|---|---|---|---|
| Context compaction | Claude Code | `agentHarness.ts` goal compaction (MAX_TRACKED_USER_GOALS) + `mem://` for long observations | tool-output truncation budget per turn |
| Skills / playbooks | Claude Code | `recipeStore.ts`, `loopEngineer.ts` skills | none new |
| Project memory (CLAUDE.md-like) | Claude Code | TASK-108 per-origin site facts | none new |
| Loop guard | Claude Code | TASK-108 | none new |
| Plan → execute | Claude Code plan mode | `plannerAgent.ts` (LLM plan, falls back to single task) | plan held by the harness, shown to user, approved before acting |
| **Todo list held by harness** | Claude Code TodoWrite | none | NEW: harness keeps step list + status; model only marks items; shown in widget |
| **Permission modes** | Claude Code (ask / auto-edit / plan) | TASK-112 gate (proposed) | NEW → folded into TASK-112: modes "ask every action / ask irreversible only / read-only plan" |
| **Pre/post tool hooks** | Claude Code hooks | none | NEW → folded into TASK-112: deterministic hook chain (block, rewrite, log) around `executeTool` |
| Sub-agents with fresh context | Claude Code Agent tool | `plannerAgent` ReAct/CoT dispatch | defer: small models gain little |
| Verify after act | both | `stateDeltaVerifier.ts`, `expertJudge.ts` | none new |
| Waits, self-healing locators | Playwright practice | TASK-114 | none new |
| **Reasoning-history rule** | DeepSeek V3.2/V4 interleaved thinking (third-party sources) | none | NEW: keep thinking text within one tool loop, drop it between user turns; verify against DeepSeek official docs first |
| Append-only session log, everything a plugin | DeepSeek harness (single news item, UNVERIFIED) | `sessionStore.ts` | do not cite until primary repo found |
| **Voice input** | Wispr Flow behaviors (cloud product, internals undocumented) | none (0 SpeechRecognition/Whisper refs) | NEW: on-device Whisper (transformers.js/WebGPU) → small-LLM cleanup: drop fillers, apply self-corrections ("4, no 5pm" → 5pm), tone from target field, personal dictionary; push-to-talk; voice commands into the agent |

## Constraints
- Small models punish prompt growth: implement techniques in harness CODE (hooks, todo state, truncation), not extra prompt rules. `harnessPrompt.ts` is already long.
- §7: no "Claude Code-level"/"best harness" claims in UI/README. Before/after numbers only from TASK-113's real eval.
- Order: commit/review TASK-111 → TASK-112 (gate + modes + hooks) → TASK-116 (todo + reasoning rule) / TASK-115 (voice) → TASK-114.
