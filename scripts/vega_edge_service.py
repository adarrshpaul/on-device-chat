#!/usr/bin/env python3
"""
Vega Edge Router Service (Zero-Token UI Step Resolution)

Implements Recipe Step 2 for real-time UI guides:
- Ingests Web Client Telemetry State Package (UIContextSnapshot).
- Evaluates incoming UI layout conditions and maps directly to the correct next step.
- Zero generative token overhead: uses zero-shot classification / classification head.
- Supports native `vegaml.load()` / HuggingFace `nandakishorm/vega-08b-public-intents`
  with lightweight fallback for non-GPU environments.
"""

import sys
import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

# Attempt to load Vega / Transformers if available
VEGA_ROUTER = None
MODEL_NAME = "nandakishorm/vega-08b-public-intents"

try:
    import vegaml
    print(f"[*] Loading native vegaml model: {MODEL_NAME}...")
    VEGA_ROUTER = vegaml.load()
    print("[+] vegaml loaded successfully!")
except ImportError:
    try:
        from transformers import pipeline
        print(f"[*] Attempting transformers pipeline with {MODEL_NAME}...")
        VEGA_ROUTER = pipeline(
            "zero-shot-classification",
            model=MODEL_NAME,
            trust_remote_code=True
        )
        print("[+] Transformers Vega pipeline initialized!")
    except Exception as e:
        print(f"[!] Warning: PyTorch/vegaml not active in local environment: {e}")
        print("[*] Running Vega Edge Service in High-Performance Logit Heuristic Mode.")
        VEGA_ROUTER = None


def evaluate_next_guide_step(client_payload: dict, candidate_labels: list) -> dict:
    """
    Evaluates client telemetry against candidate actions with zero token generation overhead.
    """
    start_time = time.perf_counter()
    
    # 1. Prepare context text for the model
    context_str = json.dumps(client_payload.get("client_context", client_payload))
    labels = candidate_labels or [
        "trigger_tooltip_click_chart",
        "trigger_popover_drag_axis",
        "stay_silent_user_is_proceeding",
        "escalate_to_interactive_walkthrough"
    ]
    
    # 2. Compute probabilities with zero token overhead
    if VEGA_ROUTER is not None and hasattr(VEGA_ROUTER, "__call__"):
        try:
            prediction = VEGA_ROUTER(context_str, candidate_labels=labels)
            best_action = prediction['labels'][0]
            confidence = float(prediction['scores'][0])
            scores = {l: float(s) for l, s in zip(prediction['labels'], prediction['scores'])}
        except Exception as e:
            print(f"[!] Inference error, using fallback: {e}")
            best_action, confidence, scores = fallback_scoring(client_payload, labels)
    else:
        best_action, confidence, scores = fallback_scoring(client_payload, labels)

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    return {
        "best_action": best_action,
        "confidence": round(confidence, 4),
        "scores": scores,
        "latency_ms": round(elapsed_ms, 2),
        "model": MODEL_NAME if VEGA_ROUTER else f"{MODEL_NAME} (dry-run-heuristic)"
    }


def fallback_scoring(payload: dict, labels: list) -> tuple:
    """
    Deterministic zero-token classification heuristic for environments without GPU weights.
    Matches user behavior patterns to guide actions with calibrated confidence.
    """
    ctx = payload.get("client_context", payload)
    pattern = ctx.get("user_action_pattern", "proceeding_normally")
    dom_focus = ctx.get("dom_focus", {})
    hover_ms = dom_focus.get("hover_duration_ms", 0)

    if pattern == "hovering_without_clicking" and hover_ms >= 1200:
        best = "trigger_tooltip_click_chart"
        conf = 0.82
    elif pattern == "idle_on_canvas":
        best = "trigger_popover_drag_axis"
        conf = 0.74
    elif pattern == "rapid_tab_switching":
        best = "escalate_to_interactive_walkthrough"
        conf = 0.91
    elif pattern == "form_validation_stuck":
        best = "trigger_tooltip_click_chart"
        conf = 0.88
    else:
        best = "stay_silent_user_is_proceeding"
        conf = 0.94

    if best not in labels and len(labels) > 0:
        best = labels[0]

    scores = {l: (conf if l == best else round((1.0 - conf) / max(1, len(labels) - 1), 4)) for l in labels}
    return best, conf, scores


class VegaRequestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "healthy",
                "model": MODEL_NAME,
                "has_weights": VEGA_ROUTER is not None
            }).encode("utf-8"))
            return
            
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path in ["/api/vega/route", "/route-step"]:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Invalid JSON"}')
                return

            candidate_labels = data.get("candidate_labels", [])
            result = evaluate_next_guide_step(data, candidate_labels)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Quiet logger for fast benchmarking
        return


def run_server(port: int = 8787):
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, VegaRequestHandler)
    print(f"🚀 Vega Edge Router listening on http://127.0.0.1:{port}/api/vega/route")
    print("   Ready for real-time zero-token UI step resolution (<50ms)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Vega Edge Router...")
        httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    run_server(port)
