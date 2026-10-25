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
  }

  // Hover over an interactive element for 1.5 seconds to trigger dwell telemetry
  console.log('Simulating mouse dwell over interactive product button to test telemetry...');
  const addBtn = await page.$('button:has-text("Add to Cart"), #btn-add-headphones');
  if (addBtn) {
    await addBtn.hover();
    await page.waitForTimeout(1600); // Exceeds 1200ms dwell threshold
  }

  // Take screenshot of live deployed page with active Vega telemetry
  const screenshotPath = `${ARTIFACT_DIR}/live_deployed_vega_telemetry_guide.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Successfully saved live deployed screenshot to: ${screenshotPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
