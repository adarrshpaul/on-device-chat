import { chromium } from '/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright/index.mjs';

const TARGET_URL = 'https://agent.paulcreates.online';

async function verifyLiveChatEnhancements() {
  console.log('======================================================================');
  console.log(`🔍 VERIFYING ENHANCED CHAT ASSISTANT & OPENUI ON: ${TARGET_URL}`);
  console.log('======================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.error('  [Browser Error]', msg.text());
  });

  console.log('▶ STEP 1: Navigating to live site...');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  console.log('▶ STEP 2: Opening Chat Copilot via #btn-launch-chat...');
  await page.click('#btn-launch-chat');
  await page.waitForSelector('[data-g4-widget="true"]', { timeout: 5000 });
  console.log('  ✅ Chat widget container mounted.');

  // Wait for initial greeting and dynamic chips
  await page.waitForTimeout(1200);

  // Capture screenshot of initial chat greeting with dynamic chips
  await page.screenshot({ path: '/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/chat_assistant_greeting_chips.png' });
  console.log('  📸 Screenshot 1 saved: chat_assistant_greeting_chips.png');

  // Verify dynamic action chips
  const chips = await page.$$eval('[data-g4-widget="true"] button', btns =>
    btns.map(b => b.textContent?.trim() || '').filter(t => t.includes('Form') || t.includes('Cart'))
  );
  console.log('  Discovered Dynamic Action Chips in Chat:', chips);

  console.log('▶ STEP 3: Triggering Form Synthesis via chat input ("formulate form")...');
  const chatInput = await page.$('[data-g4-widget="true"] textarea, [data-g4-widget="true"] input[type="text"]');
  if (chatInput) {
    await chatInput.fill('formulate form');
    await page.keyboard.press('Enter');
    console.log('  Sent query: "formulate form"');
  } else {
    console.warn('  ⚠️ Could not find chat input element');
  }

  // Wait for response and OpenUI paramForm component
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/chat_assistant_openui_form.png' });
  console.log('  📸 Screenshot 2 saved: chat_assistant_openui_form.png');

  const hasFormSpec = await page.evaluate(() => {
    return document.querySelector('[data-g4-widget="true"] input, [data-g4-widget="true"] select') !== null;
  });
  console.log('  Interactive OpenUI Form rendered inside chat:', hasFormSpec);

  console.log('▶ STEP 4: Triggering Repeated Click Action ("Add Headphones x3")...');
  if (chatInput) {
    await chatInput.fill('add headphones x3');
    await page.keyboard.press('Enter');
    console.log('  Sent query: "add headphones x3"');
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136/chat_assistant_action_confirm.png' });
  console.log('  📸 Screenshot 3 saved: chat_assistant_action_confirm.png');

  await browser.close();
  console.log('\n======================================================================');
  console.log('🎉 VERIFICATION SCRIPT FINISHED');
  console.log('======================================================================');
}

verifyLiveChatEnhancements().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
