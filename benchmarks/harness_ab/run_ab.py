"""Harness A/B benchmark runner (see PLAN.md). Python 3.12 + Playwright.

Usage: python run_ab.py <bundle_A.js> <bundle_B.js> [--reps 5] [--only task_id] [--smoke]
The OpenRouter key is read from macOS Keychain (OPENROUTER_API_KEY) here, never passed to the page.
Every run writes runs/<run_id>.json with the full model transcript, harness result and checker outcome.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
import subprocess
import time
import uuid

import requests
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("BENCH_MODEL", "gemini-3.5-flash-lite")
ENDPOINT = os.environ.get("BENCH_ENDPOINT", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions")
MAX_STEPS = 12
RUN_TIMEOUT_MS = 240_000


def keychain(name: str) -> str:
    return subprocess.run(["security", "find-generic-password", "-w", "-a", os.environ["USER"], "-s", name],
                          capture_output=True, text=True, check=True).stdout.strip()


def sha256(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


class Model:
    """Same model and decoding for both versions; logs every call."""

    def __init__(self) -> None:
        try:
            self.key = keychain("GOOGLE_API_KEY")
            self.endpoint = ENDPOINT
            self.model = MODEL
        except Exception:
            self.key = keychain("OPENROUTER_API_KEY")
            self.endpoint = "https://openrouter.ai/api/v1/chat/completions"
            self.model = "google/gemma-3-4b-it"
        self.calls: list[dict] = []

    def __call__(self, messages_json: str) -> str:
        messages = json.loads(messages_json)
        last_err = None
        for attempt in range(3):
            t0 = time.time()
            try:
                headers = {"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
                if "openrouter" in self.endpoint:
                    headers.update({"HTTP-Referer": "https://automation.paulcreates.online",
                                    "X-Title": "on-device-chat harness A/B benchmark"})
                r = requests.post(self.endpoint, timeout=90, headers=headers,
                                  json={"model": self.model, "messages": messages, "temperature": 0, "max_tokens": 600})
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
                body = r.json()
                text = body["choices"][0]["message"]["content"] or ""
                self.calls.append({"messages": messages, "response": text, "ms": round((time.time() - t0) * 1000),
                                   "usage": body.get("usage"), "provider": body.get("provider", "google")})
                return text
            except Exception as e:  # provider failure: retry, then surface as infra failure
                last_err = str(e)
                time.sleep(2 * (attempt + 1))
        self.calls.append({"messages": messages, "error": last_err})
        raise RuntimeError(f"INFRA: model call failed after retries: {last_err}")


RUN_JS = """async ([goal, maxSteps]) => {
  const H = window.EdgeOperator && window.EdgeOperator.AgentHarness;
  if (!H) return { error: 'AgentHarness not found on window.EdgeOperator' };
  const h = new H({ maxSteps });
  const r = await h.runLoop(goal, async (msgs) => await window.__benchModel(JSON.stringify(msgs)));
  return { final: r.final ?? null, steps: (r.trajectory || []).length,
           tools: (r.trajectory || []).map(s => s.tool || (s.decision && s.decision.tool) || null), isMacro: !!r.isMacro };
}"""


def check(page, task: dict, final: str | None) -> bool:
    c = task["check"]
    if c["type"] == "url_contains":
        return c["value"] in page.url
    if c["type"] == "answer_contains":
        return bool(final) and c["value"].lower() in final.lower()
    try:
        return bool(page.evaluate(f"() => {{ try {{ return {c['value']}; }} catch (e) {{ return false; }} }}"))
    except Exception:
        return False


def one_run(browser, bundle: str, version: str, task: dict, rep: int, meta: dict) -> dict:
    model = Model()
    ctx = browser.new_context(bypass_csp=True, viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    console: list[str] = []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text[:300]}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {str(e)[:300]}"))
    page.expose_function("__benchModel", model)
    rec = {"run_id": uuid.uuid4().hex[:12], "version": version, "task": task["id"], "rep": rep, "model": MODEL, **meta,
           "started": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
    t0 = time.time()
    result, ended_by_navigation, infra = None, False, None
    try:
        page.goto(task["start"], timeout=45_000, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        page.add_script_tag(content=open(bundle).read())
        page.wait_for_function("() => !!(window.EdgeOperator && window.EdgeOperator.AgentHarness)", timeout=30_000)
        result = page.evaluate(RUN_JS, [task["goal"], MAX_STEPS])
    except Exception as e:
        msg = str(e)
        if "Execution context was destroyed" in msg or "navigat" in msg.lower():
            ended_by_navigation = True
        elif "INFRA:" in msg:
            infra = msg[:300]
        else:
            rec["error"] = msg[:400]
    try:
        page.wait_for_load_state("domcontentloaded", timeout=15_000)
        page.wait_for_timeout(1000)
    except Exception:
        pass
    final = (result or {}).get("final") if isinstance(result, dict) else None
    passed = False if infra else check(page, task, final)
    claimed_done = bool(final) and not any(w in final.lower() for w in ("could not", "couldn't", "unable", "cannot", "not found"))
    rec.update({"seconds": round(time.time() - t0, 1), "result": result, "final": final, "ended_by_navigation": ended_by_navigation,
                "infra_failure": infra, "passed": passed, "false_completion": bool(claimed_done and not passed), "final_url": page.url,
                "model_calls": len(model.calls), "transcript": model.calls, "console": console[:40]})
    ctx.close()
    return rec


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (round((c - m) / d, 3), round((c + m) / d, 3))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("bundle_a"); ap.add_argument("bundle_b")
    ap.add_argument("--reps", type=int, default=5); ap.add_argument("--only"); ap.add_argument("--smoke", action="store_true")
    a = ap.parse_args()
    tasks = json.load(open(os.path.join(HERE, "tasks.json")))["tasks"]
    if a.only:
        tasks = [t for t in tasks if t["id"] == a.only]
    meta_common = {"tasks_sha256": sha256(os.path.join(HERE, "tasks.json")), "plan_sha256": sha256(os.path.join(HERE, "PLAN.md"))}
    bundles = {"A_0.3.0": (a.bundle_a, sha256(a.bundle_a)), "B_0.4.0": (a.bundle_b, sha256(a.bundle_b))}
    out_dir = os.path.join(HERE, "runs_smoke" if a.smoke else "runs")
    os.makedirs(out_dir, exist_ok=True)
    reps = 1 if a.smoke else a.reps
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for task in tasks:
            for rep in range(1, reps + 1):
                order = ["A_0.3.0", "B_0.4.0"] if rep % 2 else ["B_0.4.0", "A_0.3.0"]
                for v in order:
                    path, h = bundles[v]
                    rec = one_run(browser, path, v, task, rep, {**meta_common, "bundle_sha256": h})
                    json.dump(rec, open(os.path.join(out_dir, f"{task['id']}_{rep}_{v}_{rec['run_id']}.json"), "w"), indent=1)
                    print(f"{task['id']:16} rep{rep} {v:8} pass={rec['passed']!s:5} steps={(rec['result'] or {}).get('steps') if isinstance(rec['result'], dict) else '-'} "
                          f"calls={rec['model_calls']} nav={rec['ended_by_navigation']} infra={bool(rec['infra_failure'])} err={rec.get('error', '')[:60]}", flush=True)
        browser.close()


if __name__ == "__main__":
    main()
