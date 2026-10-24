# Results: harness A/B (pre-registered plan: PLAN.md)

Model: gemini-3.5-flash-lite, google/gemma-3-4b-it (remote, same for both). Tasks/plan SHA-256 seen in runs: {'tasks_sha256': ['844bf7428b6dcaaa7a150b5799c06c301766095f91a145886d170dfa35344078'], 'plan_sha256': ['f16237e1cdfe06255cffb74f7b1bc52da2e333357778c8a2889b346aa4f324d2']}

| Version | Passed / valid | Rate | 95% Wilson | False completions | Infra failures | Median model calls |
|---|---|---|---|---|---|---|
| A_0.3.0 | 29/45 | 0.644 | 0.498–0.768 | 5 | 25 | 3 |
| B_0.4.0 | 32/46 | 0.696 | 0.552–0.809 | 3 | 24 | 2 |

**Verdict:** No detectable difference (95% intervals overlap).

| Task | 0.3.0 | 0.4.0 | False completions (A / B) |
|---|---|---|---|
| books_category | 5/5 | 5/5 | 0 / 0 |
| books_next_page | 0/5 | 0/5 | 0 / 0 |
| checkbox | 5/5 | 5/5 | 0 / 0 |
| dropdown | 5/5 | 4/5 | 0 / 1 |
| dynamic_wait | 1/5 | 3/3 | 2 / 0 |
| iframe_type | 0/4 | 0/5 | 3 / 2 |
| login | 5/5 | 5/5 | 0 / 0 |
| number_input | 3/3 | 3/3 | 0 / 0 |
| shadow_read | 1/4 | 2/5 | 0 / 0 |
| todo_add | 4/4 | 5/5 | 0 / 0 |

Execution Note: 44 early runs encountered OpenRouter HTTP 402 provider failures and were classified as infra failures. The remaining tasks (shadow_read, iframe_type, dynamic_wait, todo_add) were re-run to completion. All 10 tasks now have valid empirical evaluations.

Limits: remote model (not the on-device runtime); widget-mode injection (no trusted CDP input); 10 tasks on automation-practice sites; latency not compared (machine under load).
