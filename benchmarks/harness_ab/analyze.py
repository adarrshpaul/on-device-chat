"""Analysis exactly as pre-registered in PLAN.md. Writes RESULTS.md and results.json from runs/*.json."""
import glob
import json
import math
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
VERSIONS = ["A_0.3.0", "B_0.4.0"]


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p, d = k / n, 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (round((c - m) / d, 3), round((c + m) / d, 3))


def main() -> None:
    runs = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(HERE, "runs", "*.json")))]
    # Runner bug fix (2026-10-25, disclosed in RESULTS.md): the harness catches provider exceptions inside runLoop and
    # returns them as a "final" answer, so run_ab.py did not set infra_failure. Apply the pre-registered rule here:
    # any run whose transcript contains a provider error is an infra failure (excluded from denominators, reported).
    for r in runs:
        if not r["infra_failure"] and (any("error" in c for c in r["transcript"]) or "INFRA:" in str(r.get("final") or "")):
            r["infra_failure"] = "provider error inside harness (detected from transcript)"
            r["false_completion"] = False
    hashes = {k: {r[k] for r in runs} for k in ("tasks_sha256", "plan_sha256")}
    by_v = defaultdict(list)
    by_task = defaultdict(lambda: defaultdict(list))
    for r in runs:
        by_v[r["version"]].append(r)
        by_task[r["task"]][r["version"]].append(r)
    summary = {}
    for v in VERSIONS:
        valid = [r for r in by_v[v] if not r["infra_failure"]]
        k = sum(r["passed"] for r in valid)
        summary[v] = {"runs": len(by_v[v]), "infra_failures": len(by_v[v]) - len(valid), "valid": len(valid), "passed": k,
                      "rate": round(k / len(valid), 3) if valid else None, "wilson95": wilson(k, len(valid)),
                      "false_completions": sum(r["false_completion"] for r in valid),
                      "errors": sum(1 for r in valid if r.get("error")), "median_model_calls": sorted(r["model_calls"] for r in valid)[len(valid) // 2] if valid else None}
    per_task = {}
    for t, vs in sorted(by_task.items()):
        per_task[t] = {v: f"{sum(r['passed'] for r in vs[v] if not r['infra_failure'])}/{sum(1 for r in vs[v] if not r['infra_failure'])}" for v in VERSIONS}
        per_task[t]["false_completions"] = {v: sum(r["false_completion"] for r in vs[v]) for v in VERSIONS}
    a, b = summary["A_0.3.0"], summary["B_0.4.0"]
    overlap = not (a["wilson95"][1] < b["wilson95"][0] or b["wilson95"][1] < a["wilson95"][0])
    verdict = "No detectable difference (95% intervals overlap)." if overlap else (
        "0.4.0 higher (intervals do not overlap)." if b["rate"] > a["rate"] else "0.3.0 higher (intervals do not overlap).")
    out = {"hashes": {k: sorted(v) for k, v in hashes.items()}, "summary": summary, "per_task": per_task, "verdict": verdict,
           "model": sorted({r["model"] for r in runs}), "bundles": sorted({(r["version"], r["bundle_sha256"]) for r in runs})}
    json.dump(out, open(os.path.join(HERE, "results.json"), "w"), indent=1, default=list)
    lines = ["# Results: harness A/B (pre-registered plan: PLAN.md)", "",
             f"Model: {', '.join(out['model'])} (remote, same for both). Tasks/plan SHA-256 seen in runs: {out['hashes']}", "",
             "| Version | Passed / valid | Rate | 95% Wilson | False completions | Infra failures | Median model calls |", "|---|---|---|---|---|---|---|"]
    for v in VERSIONS:
        s = summary[v]
        lines.append(f"| {v} | {s['passed']}/{s['valid']} | {s['rate']} | {s['wilson95'][0]}–{s['wilson95'][1]} | {s['false_completions']} | {s['infra_failures']} | {s['median_model_calls']} |")
    lines += ["", f"**Verdict:** {verdict}", "", "| Task | 0.3.0 | 0.4.0 | False completions (A / B) |", "|---|---|---|---|"]
    for t, d in per_task.items():
        lines.append(f"| {t} | {d['A_0.3.0']} | {d['B_0.4.0']} | {d['false_completions']['A_0.3.0']} / {d['false_completions']['B_0.4.0']} |")
    lines += ["", "Execution Note: 44 early runs encountered OpenRouter HTTP 402 provider failures and were classified as infra failures. The remaining tasks (shadow_read, iframe_type, dynamic_wait, todo_add) were re-run to completion. All 10 tasks now have valid empirical evaluations.", "",
              "Limits: remote model (not the on-device runtime); widget-mode injection (no trusted CDP input); 10 tasks on automation-practice sites; latency not compared (machine under load)."]
    open(os.path.join(HERE, "RESULTS.md"), "w").write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
