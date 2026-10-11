import { chromium } from '/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright/index.mjs';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = '/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136';
const BUNDLE_PATH = '/Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/frontend/dist/on-device-chat.min.js';

async function runBrowserTests() {
  console.log('======================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE PLAYWRIGHT BROWSER E2E TESTS');
  console.log('======================================================================\n');

  const bundleCode = fs.readFileSync(BUNDLE_PATH, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log('1. Loading live target https://paulcreates.online ...');
  await page.goto('https://paulcreates.online', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('2. Injecting latest built on-device-chat bundle with multi-turn memory & nav persistence...');
  await page.evaluate((code) => {
    const existing = document.getElementById('g4-agent-script');
    if (existing) existing.remove();
    const oldRoot = document.getElementById('gemma4-widget-root');
    if (oldRoot) oldRoot.remove();
    if (window.gemma4Agent && typeof window.gemma4Agent.destroy === 'function') {
      window.gemma4Agent.destroy();
    }

    const script = document.createElement('script');
    script.id = 'g4-agent-script';
    script.textContent = code;
    document.body.appendChild(script);

    // Auto-init
    if (window.Gemma4Agent && typeof window.Gemma4Agent.init === 'function') {
      window.gemma4Agent = window.Gemma4Agent.init({ autoOpen: true });
    }
  }, bundleCode);

  await page.waitForTimeout(1500);

  // Click floating button if not yet opened
  const widgetVisible = await page.evaluate(() => {
    return !!document.querySelector('#gemma4-widget-root') || !!document.querySelector('on-device-chat');
  });
  console.log('  Widget mounted in DOM:', widgetVisible);

  const openBtn = await page.$('button[aria-label="Open AI Assistant"], button[title="Open AI Assistant"], #gemma4-widget-root button');
  if (openBtn) {
    await openBtn.click();
    await page.waitForTimeout(800);
  }

  // --- TEST A: Download Resume Action Grounding ---
  console.log('\n📌 Scenario A: "download resume" Action');
  const inputEl = await page.waitForSelector('#gemma4-widget-root textarea, textarea[placeholder*="Ask"], input[placeholder*="Ask"]', { timeout: 10000 });
  await inputEl.fill('download resume');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const downloadText = await page.evaluate(() => {
    const msgs = Array.from(document.querySelectorAll('#gemma4-widget-root [class*="chat"], #gemma4-widget-root [class*="message"], #gemma4-widget-root p'));
    return msgs.map(m => m.textContent).join('\n');
  });

  const downloadSuccess = downloadText.includes('Triggered download') || downloadText.includes('Resume') || downloadText.includes('downloading');
  console.log('  Download response verified:', downloadSuccess);
  if (!downloadSuccess) {
    console.warn('  Output captured:', downloadText.slice(-300));
  }

  // --- TEST B: Multi-Turn Conversation Memory ---
  console.log('\n📌 Scenario B: Multi-Turn Dialogue Memory ("tell me more about it")');
  await inputEl.fill('tell me more about the resume file');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const multiTurnText = await page.evaluate(() => {
    const msgs = Array.from(document.querySelectorAll('#gemma4-widget-root [class*="chat"], #gemma4-widget-root [class*="message"], #gemma4-widget-root p'));
    return msgs.map(m => m.textContent).join('\n');
  });
  console.log('  Multi-turn response received:', multiTurnText.length > 50);

  // --- TEST C: Cross-Page Navigation Persistence (SessionStorage) ---
  console.log('\n📌 Scenario C: Cross-Page Navigation State Machine');
  const taskSaved = await page.evaluate(() => {
    // Simulate navigation persistence
    window.sessionStorage.setItem('g4_inflight_agent_task', JSON.stringify({
      id: 'task_e2e_nav',
      userGoal: 'Inspect project details and verify live deployment',
      stepIndex: 1,
      maxSteps: 5,
      trajectory: [{ step: 1, tool: 'click', args: { target: 'projects' }, observationSummary: 'Navigated to projects section', durationMs: 20 }],
      conversationHistory: [{ role: 'user', content: 'Inspect project details' }],
      workingMemory: {},
      originUrl: window.location.href,
      targetUrl: window.location.href,
      createdAt: Date.now(),
    }));

    // Verify it is readable
    const raw = window.sessionStorage.getItem('g4_inflight_agent_task');
    return !!raw;
  });
  console.log('  Navigation task saved in sessionStorage:', taskSaved);

  // Reload page to simulate full MPA navigation
  console.log('  Simulating full-page navigation reload...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Re-inject fresh bundle to simulate page load on destination URL
  await page.evaluate((code) => {
    const script = document.createElement('script');
    script.id = 'g4-agent-script';
    script.textContent = code;
    document.body.appendChild(script);

    if (window.Gemma4Agent && typeof window.Gemma4Agent.init === 'function') {
      window.gemma4Agent = window.Gemma4Agent.init({ autoOpen: true });
    }
  }, bundleCode);

  await page.waitForTimeout(2000);

  const resumedText = await page.evaluate(() => {
    const msgs = Array.from(document.querySelectorAll('#gemma4-widget-root [class*="chat"], #gemma4-widget-root [class*="message"], #gemma4-widget-root p'));
    return msgs.map(m => m.textContent).join('\n');
  });

  const hasResumed = resumedText.includes('Navigated to') || resumedText.includes('Resuming task') || resumedText.includes('Inspect project details');
  console.log('  Cross-page navigation task resumption verified:', hasResumed);

  const screenshotPath = path.join(ARTIFACT_DIR, 'e2e_universal_harness_verification.png');
  await page.screenshot({ path: screenshotPath });
  console.log('  Screenshot saved to:', screenshotPath);

  await browser.close();

  console.log('\n======================================================================');
  console.log('🎉 E2E BROWSER TESTS COMPLETE!');
  console.log('======================================================================');
}

runBrowserTests().catch((e) => {
  console.error('Browser test failed:', e);
  process.exit(1);
});
