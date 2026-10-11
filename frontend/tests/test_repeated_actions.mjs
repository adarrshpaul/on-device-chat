import { chromium } from '/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright/index.mjs';
import * as fs from 'fs';

const BUNDLE_PATH = '/Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/frontend/dist/on-device-chat.min.js';

async function testRepeatedActions() {
  console.log('======================================================================');
  console.log('🔍 INVESTIGATING REPEATED ACTIONS BEHAVIOR IN BROWSER');
  console.log('======================================================================\n');

  const bundleCode = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`  [Browser ${msg.type()}]:`, msg.text());
  });

  await page.goto('https://paulcreates.online', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Inject fresh bundle
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

    if (window.Gemma4Agent && typeof window.Gemma4Agent.init === 'function') {
      window.gemma4Agent = window.Gemma4Agent.init({ autoOpen: true });
    }
  }, bundleCode);

  await page.waitForTimeout(1500);

  // Open widget
  const openBtn = await page.$('button[aria-label="Open AI Assistant"], button[title="Open AI Assistant"], #gemma4-widget-root button');
  if (openBtn) {
    await openBtn.click();
    await page.waitForTimeout(800);
  }

  const inputEl = await page.waitForSelector('#gemma4-widget-root input, #gemma4-widget-root textarea, input[placeholder*="Ask"]', { timeout: 10000 });

  async function sendChatMessage(query) {
    console.log(`\n➡️ Sending: "${query}"`);
    // Wait until send button is ready and not loading
    await page.waitForSelector('#gemma4-widget-root input', { timeout: 10000 });
    const countBefore = await page.evaluate(() => document.querySelectorAll('#gemma4-widget-root .g4-prose').length);
    
    await page.fill('#gemma4-widget-root input', query);
    await page.waitForTimeout(200);
    const sendBtn = await page.$('#gemma4-widget-root button[aria-label="Send message"], #gemma4-widget-root button[title="Send"]');
    if (sendBtn) {
      await sendBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Wait until new response appears and loading is finished
    await page.waitForFunction((prevCount) => {
      const poses = document.querySelectorAll('#gemma4-widget-root .g4-prose');
      const stopBtn = document.querySelector('#gemma4-widget-root button[aria-label="Stop generation"]');
      return poses.length > prevCount && !stopBtn;
    }, countBefore, { timeout: 15000 });

    const lastMsg = await page.evaluate(() => {
      const poses = Array.from(document.querySelectorAll('#gemma4-widget-root .g4-prose'));
      return poses[poses.length - 1]?.textContent || '';
    });
    console.log(`⬅️ Response: ${lastMsg.trim().slice(0, 150)}...`);
    return lastMsg;
  }

  // TEST 1: Toggle Theme repeatedly
  console.log('\n--- TEST 1: Theme Toggle Repeatedly ---');
  const t1 = await sendChatMessage('toggle theme');
  const themeAfter1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || document.body.className);
  console.log('  Theme after turn 1:', themeAfter1);

  const t2 = await sendChatMessage('toggle theme');
  const themeAfter2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || document.body.className);
  console.log('  Theme after turn 2:', themeAfter2);

  const t3 = await sendChatMessage('toggle theme');
  const themeAfter3 = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || document.body.className);
  console.log('  Theme after turn 3:', themeAfter3);

  // TEST 2: Download Resume repeatedly
  console.log('\n--- TEST 2: Download Resume Repeatedly ---');
  const d1 = await sendChatMessage('download resume');
  const d2 = await sendChatMessage('download resume');
  const d3 = await sendChatMessage('download resume');

  // TEST 3: Navigation repeatedly
  console.log('\n--- TEST 3: Section Navigation Repeatedly ---');
  const n1 = await sendChatMessage('go to projects');
  const n2 = await sendChatMessage('go to contact');
  const n3 = await sendChatMessage('go to projects');

  await page.screenshot({ path: '/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/repeated_actions_robustness_verified.png' });
  console.log('📸 Screenshot saved to repeated_actions_robustness_verified.png');

  await browser.close();
  console.log('\n======================================================================');
  console.log('🏁 DIAGNOSTIC COMPLETE');
  console.log('======================================================================');
}

testRepeatedActions().catch((e) => {
  console.error('Diagnostic error:', e);
  process.exit(1);
});
