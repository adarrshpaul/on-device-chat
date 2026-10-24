import { chromium } from '/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright/index.mjs';

const TARGET_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = '/Users/adarrsh/.gemini/antigravity/brain/9318767d-4270-413c-972b-dce97d26bc12';

async function verifyV050Local() {
  console.log('======================================================================');
  console.log(`🔍 LOCAL VERIFICATION OF ON-DEVICE-CHAT v0.5.0: ${TARGET_URL}`);
  console.log('======================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.error('  [Browser Error]', msg.text());
  });

  console.log('▶ STEP 1: Navigating to local preview...');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log('▶ STEP 2: Opening Chat Copilot via launcher button...');
  const launcher = await page.$('#btn-launch-chat, #g4-floating-launcher, [data-eo-launcher="true"]');
  if (launcher) {
    await launcher.click();
  } else {
    console.error('Could not find launcher button');
  }

  await page.waitForSelector('[data-g4-widget="true"]', { timeout: 8000 });
  console.log('  ✅ Chat widget container mounted.');

  // Wait for dynamic routine prediction
  await page.waitForTimeout(1500);

  // Inspect the Quick Routines labels
  const routinePills = await page.$$eval('[data-g4-widget="true"] button', btns =>
    btns.map(b => b.textContent?.trim() || '').filter(t => t.includes('Cart') || t.includes('Add') || t.includes('Tour'))
  );
  console.log('  Discovered Quick Routine Pills:', routinePills);

  // Take screenshot of main chat with spacious input and disambiguated routines
  await page.screenshot({ path: `${ARTIFACT_DIR}/v050_chat_spacious_input_and_routines.png` });
  console.log(`  📸 Screenshot saved: v050_chat_spacious_input_and_routines.png`);

  // Type something into the composer to test focus and spacious styling
  const inputEl = await page.$('[data-g4-widget="true"] input[type="text"]');
  if (inputEl) {
    await inputEl.fill('Add headphones to cart and notify me');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${ARTIFACT_DIR}/v050_chat_typing_composer.png` });
    console.log(`  📸 Screenshot saved: v050_chat_typing_composer.png`);
    await inputEl.fill('');
  }

  console.log('▶ STEP 3: Navigating to Workflows & Automations Studio tab...');
  // Click the Open Workflows Studio button
  const studioBtn = await page.$('button[title="Open Workflows Studio"], button:has-text("Create Custom")');
  if (studioBtn) {
    await studioBtn.click();
    console.log('  Clicked Open Workflows Studio button');
  } else {
    console.error('  Could not find Open Workflows Studio button');
  }

  await page.waitForTimeout(1500);

  // Take screenshot of elevated Workflows Studio tab
  await page.screenshot({ path: `${ARTIFACT_DIR}/v050_workflows_studio_flowchart.png` });
  console.log(`  📸 Screenshot saved: v050_workflows_studio_flowchart.png`);

  // Verify elements in Workflows Studio
  const studioInfo = await page.evaluate(() => {
    const headerTitle = document.querySelector('h3')?.textContent || '';
    const spans = Array.from(document.querySelectorAll('span'));
    const activeSpan = spans.find(s => s.textContent?.includes('active'));
    const activeBadge = activeSpan ? activeSpan.textContent?.trim() : '';
    const cards = Array.from(document.querySelectorAll('[data-testid^="workflow-card-"]')).map(c => {
      const title = c.querySelector('span.font-extrabold')?.textContent || '';
      const stepItems = Array.from(c.querySelectorAll('div.inline-flex')).map(s => s.textContent?.trim() || '');
      return { title, stepsCount: stepItems.length, steps: stepItems };
    });
    return { headerTitle, activeBadge, cardsCount: cards.length, cards };
  });

  console.log('  Workflows Studio Info:', JSON.stringify(studioInfo, null, 2));

  await browser.close();
  console.log('\n======================================================================');
  console.log('🎉 LOCAL VERIFICATION COMPLETE');
  console.log('======================================================================');
}

verifyV050Local().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
