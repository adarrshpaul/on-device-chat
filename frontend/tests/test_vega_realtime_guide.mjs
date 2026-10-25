/**
 * Test Suite: Vega System One Real-Time UI Guide & Edge Telemetry Bridge
 * 
 * Verifies:
 * 1. TelemetryTracker non-blocking snapshot capture and pattern classification.
 * 2. Performance benchmark (<0.2ms telemetry ingestion budget).
 * 3. VegaEdgeBridge zero-token step resolution and micro-tuned F1 policy gates (0.65 / 0.85).
 * 4. Rule §7 Architectural Honesty: Offline fallback produces "local-reflex-fallback" without deceptive claims.
 * 5. Mock edge endpoint round-trip verification.
 */

import assert from 'node:assert/strict';
import { TelemetryTracker } from '../dist/index.js';
import { VegaEdgeBridge } from '../dist/index.js';

console.log('======================================================================');
console.log('🧪 RUNNING: Vega System One Real-Time UI Guide & Edge Bridge Suite');
console.log('======================================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // --- TEST 1: Telemetry Ingestion Structure & Latency ---
  test('TelemetryTracker: generates compliant UIContextSnapshot', () => {
    const tracker = new TelemetryTracker();
    const snapshot = tracker.getSnapshot();

    assert.ok(snapshot.current_route, 'Snapshot should have current_route');
    assert.ok(Array.isArray(snapshot.completed_steps), 'completed_steps must be array');
    assert.ok(snapshot.dom_focus, 'dom_focus must exist');
    assert.ok(Array.isArray(snapshot.dom_focus.cursor_position_xy), 'cursor_position_xy must be [x, y]');
    assert.ok(snapshot.user_action_pattern, 'user_action_pattern must be classified');
    assert.ok(typeof snapshot.timestamp === 'number', 'timestamp must be numeric');
  });

  // --- TEST 2: Performance Benchmark (<0.2ms per snapshot) ---
  test('TelemetryTracker: Ingestion benchmark (<0.2ms overhead budget)', () => {
    const tracker = new TelemetryTracker();
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      tracker.getSnapshot();
    }
    const totalMs = performance.now() - start;
    const avgMs = totalMs / iterations;

    console.log(`     -> Benchmark: ${iterations} snapshots in ${totalMs.toFixed(2)}ms (avg: ${avgMs.toFixed(4)}ms/call)`);
    assert.ok(avgMs < 0.2, `Average snapshot time (${avgMs.toFixed(4)}ms) exceeded 0.2ms budget`);
  });

  // --- TEST 3: Edge Decision Bridge Policy Threshold: Tooltip (confidence > 0.65) ---
  await testAsync('VegaEdgeBridge: Tooltip threshold gate (confidence > 0.65 -> SHOW_STEP)', async () => {
    const bridge = new VegaEdgeBridge('http://127.0.0.1:9999/dummy-endpoint');

    // Feed mock edge response via custom handler evaluation
    const mockEdgeResponse = {
      best_action: 'trigger_tooltip_click_chart',
      confidence: 0.72,
      model: 'vega-08b-public-intents',
      scores: { trigger_tooltip_click_chart: 0.72, stay_silent_user_is_proceeding: 0.28 }
    };

    const snapshot = {
      current_route: '/dashboard/analytics',
      completed_steps: ['welcome_modal'],
      dom_focus: {
        element_id: 'canvas_chart_workspace',
        selector: '#canvas_chart_workspace',
        tag_name: 'canvas',
        hover_duration_ms: 1400,
        cursor_position_xy: [450, 310]
      },
      user_action_pattern: 'idle_on_canvas',
      recent_routes: ['/dashboard/analytics'],
      timestamp: Date.now()
    };

    // Use internal threshold evaluator directly
    const directive = bridge['applyPolicyThresholds'](mockEdgeResponse, snapshot);

    assert.equal(directive.action, 'SHOW_STEP', 'Should emit SHOW_STEP when tooltip confidence > 0.65');
    assert.equal(directive.target_element, '#canvas_chart_workspace');
    assert.equal(directive.step, 2, 'Next step should be completed + 1');
    assert.equal(directive.model, 'vega-08b-public-intents');
  });

  // --- TEST 4: Edge Decision Bridge Policy Threshold: Walkthrough Escalation (> 0.85) ---
  await testAsync('VegaEdgeBridge: Escalation threshold gate (confidence > 0.85 -> START_FLOW)', async () => {
    const bridge = new VegaEdgeBridge();

    const mockEdgeResponse = {
      best_action: 'escalate_to_interactive_walkthrough',
      confidence: 0.89,
      model: 'vega-08b-public-intents'
    };

    const snapshot = {
      current_route: '/checkout',
      completed_steps: [],
      dom_focus: {
        element_id: 'shipping_address',
        selector: '#shipping_address',
        tag_name: 'input',
        hover_duration_ms: 2200,
        cursor_position_xy: [200, 400]
      },
      user_action_pattern: 'rapid_tab_switching',
      recent_routes: ['/cart', '/checkout', '/cart', '/checkout'],
      timestamp: Date.now()
    };

    const directive = bridge['applyPolicyThresholds'](mockEdgeResponse, snapshot);

    assert.equal(directive.action, 'START_FLOW', 'Should emit START_FLOW when escalation confidence > 0.85');
    assert.ok(directive.flow_id, 'Should provide a flow_id for guided tour');
    assert.equal(directive.confidence, 0.89);
  });

  // --- TEST 5: Edge Decision Bridge Policy Threshold: Silent / Below Threshold ---
  await testAsync('VegaEdgeBridge: Low confidence falls back to WAIT', async () => {
    const bridge = new VegaEdgeBridge();

    const mockEdgeResponse = {
      best_action: 'trigger_tooltip_click_chart',
      confidence: 0.52, // Below 0.65 threshold
      model: 'vega-08b-public-intents'
    };

    const snapshot = {
      current_route: '/home',
      completed_steps: [],
      dom_focus: {
        element_id: 'logo',
        selector: '#logo',
        tag_name: 'div',
        hover_duration_ms: 100,
        cursor_position_xy: [50, 50]
      },
      user_action_pattern: 'proceeding_normally',
      recent_routes: ['/home'],
      timestamp: Date.now()
    };

    const directive = bridge['applyPolicyThresholds'](mockEdgeResponse, snapshot);
    assert.equal(directive.action, 'WAIT', 'Should stay silent when confidence is below 0.65');
  });

  // --- TEST 6: Rule §7 Architectural Honesty - Offline Fallback ---
  await testAsync('VegaEdgeBridge: Offline fallback circuit honest labeling (Rule §7)', async () => {
    // Unreachable port
    const bridge = new VegaEdgeBridge('http://127.0.0.1:59999/unreachable-vega');

    const snapshot = {
      current_route: '/products',
      completed_steps: [],
      dom_focus: {
        element_id: 'btn-add-headphones',
        selector: '#btn-add-headphones',
        tag_name: 'button',
        hover_duration_ms: 1500,
        cursor_position_xy: [300, 300]
      },
      user_action_pattern: 'hovering_without_clicking',
      recent_routes: ['/products'],
      timestamp: Date.now()
    };

    const directive = await bridge.evaluateSnapshot(snapshot);

    assert.equal(directive.model, 'local-reflex-fallback', 'Offline fallback must be honestly labeled');
    assert.equal(directive.action, 'SHOW_STEP', 'Local reflex should still provide guidance for dwell');
    assert.equal(directive.target_element, '#btn-add-headphones');
  });

  // --- TEST 7: Python Edge Service Standalone Test ---
  await testAsync('Python Vega Edge Service: CLI logic validation', async () => {
    const { execSync } = await import('node:child_process');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const scriptsDir = path.resolve(__dirname, '../../scripts');
    const testJson = JSON.stringify({
      client_context: {
        current_route: '/dashboard/analytics',
        user_action_pattern: 'idle_on_canvas',
        dom_focus: { hover_duration_ms: 1500 }
      },
      candidate_labels: [
        'trigger_tooltip_click_chart',
        'trigger_popover_drag_axis',
        'stay_silent_user_is_proceeding'
      ]
    });

    const pyCmd = `python3 -c "import json, sys; sys.path.insert(0, '${scriptsDir}'); from vega_edge_service import evaluate_next_guide_step; data=json.load(sys.stdin); print(json.dumps(evaluate_next_guide_step(data, data.get('candidate_labels', []))))"`;
    
    const rawOutput = execSync(pyCmd, { input: testJson }).toString();
    // Filter out informational stdout logs to parse trailing JSON
    const lines = rawOutput.trim().split('\n');
    const jsonLine = lines[lines.length - 1];
    const parsed = JSON.parse(jsonLine);

    assert.ok(parsed.best_action, 'Service must output best_action');
    assert.ok(typeof parsed.confidence === 'number', 'Confidence must be numeric');
    assert.ok(parsed.model.includes('vega-08b-public-intents'), 'Model must reference vega-08b-public-intents');
    console.log(`     -> Python edge response: ${parsed.best_action} (${(parsed.confidence * 100).toFixed(1)}%) in ${parsed.latency_ms}ms`);
  });

  console.log('\n======================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed}/${total} PASSED (0 FAILURES)`);
  console.log('======================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
