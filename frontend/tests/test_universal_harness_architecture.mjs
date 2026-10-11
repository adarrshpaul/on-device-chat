import { strict as assert } from 'node:assert';
import { NavPersistenceManager, AgentHarness } from '../dist/index.js';

console.log('======================================================================');
console.log('🚀 TESTING UNIVERSAL HARNESS ARCHITECTURE & PERSISTENCE');
console.log('======================================================================\n');

// Mock browser globals for node testing
if (typeof globalThis.window === 'undefined') {
  const store = new Map();
  globalThis.window = {
    location: { href: 'https://example-shop.com/products', pathname: '/products', origin: 'https://example-shop.com' },
    sessionStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    scrollY: 0,
    scrollTo: () => {},
  };
  globalThis.document = {
    title: 'Acme Organic Foods Store',
    location: globalThis.window.location,
    body: { innerText: 'Welcome to Acme Foods. We carry organic coffee beans, matcha powder, and artisan honey.' },
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, remove: () => {} }),
    documentElement: { lang: 'en', getAttribute: () => null, classList: { contains: () => false, toggle: () => {} } },
  };
}

async function testNavPersistence() {
  console.log('📌 Test 1: Navigation State Machine & SessionStorage Resumption');
  window.sessionStorage.clear();

  // 1. Should be empty initially
  assert.equal(NavPersistenceManager.getPendingTask(), null, 'Pending task should be null initially');

  // 2. Save active in-flight task
  NavPersistenceManager.saveTask({
    id: 'test_task_123',
    userGoal: 'Find fair trade coffee beans and checkout',
    stepIndex: 2,
    maxSteps: 10,
    trajectory: [
      { step: 1, tool: 'click', args: { target: '[1]' }, observationSummary: 'Navigated to coffee section', durationMs: 45 }
    ],
    conversationHistory: [
      { role: 'user', content: 'Find fair trade coffee beans' },
      { role: 'assistant', content: 'Navigating to coffee section' }
    ],
    workingMemory: { lastCategory: 'coffee' },
    originUrl: 'https://example-shop.com/',
    targetUrl: 'https://example-shop.com/products/coffee',
  });

  // 3. Retrieve pending task after page load
  const restored = NavPersistenceManager.getPendingTask();
  assert.ok(restored, 'Pending task should be restored');
  assert.equal(restored.userGoal, 'Find fair trade coffee beans and checkout');
  assert.equal(restored.stepIndex, 2);
  assert.equal(restored.trajectory.length, 1);
  assert.equal(restored.conversationHistory.length, 2);
  console.log('  ✅ PASS: Task serialized and rehydrated across simulated navigation.');

  // 4. Clear task
  NavPersistenceManager.clearTask();
  assert.equal(NavPersistenceManager.getPendingTask(), null, 'Task should be cleared');
  console.log('  ✅ PASS: Task cleared upon workflow completion.\n');
}

async function testDynamicCatalogGrounding() {
  console.log('📌 Test 2: Dynamic Catalog Grounding (Zero Hardcoded Electronics)');
  const harness = new AgentHarness({
    customHostTools: {
      addToCart: async (args) => ({ status: 'added', ...args })
    }
  });

  // Query item present in DOM text ("organic coffee beans")
  const resultPass = await harness.runLoop('add 2 organic coffee beans to cart', async () => JSON.stringify({
    tool: 'addToCart',
    args: { item: 'organic coffee beans', quantity: 2 }
  }));
  assert.ok(!resultPass.final.includes('Catalog verification failed'), 'Item in DOM should be allowed');
  console.log('  ✅ PASS: Dynamically permitted item present in arbitrary non-tech store DOM.');

  // Query item NOT present in DOM text ("flying carpet")
  const resultBlock = await harness.runLoop('buy 1 flying carpet now', async () => JSON.stringify({
    tool: 'addToCart',
    args: { item: 'flying carpet', quantity: 1 }
  }));
  assert.ok(resultBlock.final.includes('Catalog verification failed') || resultBlock.trajectory.some(t => t.observationSummary.includes('Catalog verification failed')), 'Item NOT in DOM should be blocked');
  console.log('  ✅ PASS: Dynamically blocked hallucinated item absent from store DOM.\n');
}

async function testDialogueContextInHarness() {
  console.log('📌 Test 3: Multi-Turn Conversation Memory in Harness');
  const harness = new AgentHarness({});

  let receivedPrompt = '';
  await harness.runLoop(
    'show me the second one',
    async (msgs) => {
      receivedPrompt = msgs.map(m => `${m.role}: ${m.content}`).join('\n');
      return JSON.stringify({ final: 'Found the second item.' });
    },
    0, // Tier 0
    [
      { role: 'user', content: 'What varieties of honey do you offer?' },
      { role: 'assistant', content: 'We offer [1] Wildflower Honey and [2] Clover Honey.' }
    ]
  );

  assert.ok(receivedPrompt.includes('Prior Dialogue Context:'), 'Prompt should include Prior Dialogue Context');
  assert.ok(receivedPrompt.includes('Wildflower Honey'), 'Prompt should preserve previous assistant answer');
  console.log('  ✅ PASS: Prior dialogue turns injected into harness prompt, resolving anaphoric references.\n');
}

async function run() {
  await testNavPersistence();
  await testDynamicCatalogGrounding();
  await testDialogueContextInHarness();
  console.log('======================================================================');
  console.log('🎉 ALL UNIVERSAL HARNESS ARCHITECTURE TESTS PASSED!');
  console.log('======================================================================');
}

run().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
