import { chromium } from '/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright/index.mjs';

const TARGET_URL = 'https://agent.paulcreates.online';
const ARTIFACT_DIR = '/Users/adarrsh/.gemini/antigravity/brain/9318767d-4270-413c-972b-dce97d26bc12';

async function main() {
  console.log(`Connecting to ${TARGET_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.error('  [Browser Error]', msg.text());
  });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  // Click launcher
  const launcher = await page.$('#btn-launch-chat, #g4-floating-launcher, [data-eo-launcher="true"]');
  if (launcher) {
    console.log('Found launcher button, clicking...');
    await launcher.click();
    await page.waitForTimeout(1200);
  } else {
    console.warn('Launcher button not found!');
  }

  // Find Studio button
  const studioBtn = await page.$('button[title="Open Workflows Studio"], button:has-text("Create Custom")');
  if (studioBtn) {
    console.log('Found Workflows Studio button, clicking...');
    await studioBtn.click();
    await page.waitForTimeout(1000);
  } else {
    console.warn('Studio button not found!');
  }

  // Find + New Flow button
  const newFlowBtn = await page.$('button:has-text("New Flow"), button:has-text("+ New Flow"), button:has-text("New")');
  if (newFlowBtn) {
    console.log('Found New Flow button, clicking to open redesigned builder drawer...');
    await newFlowBtn.click();
    await page.waitForTimeout(1200);
  } else {
    console.warn('New Flow button not found!');
  }

  // Take screenshot of live deployed 3-stage visual builder drawer
  const screenshotPath = `${ARTIFACT_DIR}/live_deployed_v050_redesigned_builder.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Successfully saved live deployed screenshot to: ${screenshotPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
