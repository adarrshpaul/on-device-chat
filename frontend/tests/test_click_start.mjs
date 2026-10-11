import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const CFT_EXECUTABLE = "/Users/adarrsh/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const ARTIFACT_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136";

async function playBasketball() {
  console.log("🏀 Launching browser and navigating to Basketball game...");
  const browserContext = await chromium.launchPersistentContext("", {
    executablePath: CFT_EXECUTABLE,
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-sandbox",
    ],
    viewport: { width: 450, height: 850 },
  });

  const page = await browserContext.newPage();
  await page.goto("https://basketball.paulcreates.online/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);

  const canvas = await page.$("canvas");
  const box = await canvas.boundingBox();
  console.log("Canvas Bounding Box:", box);

  // In Phaser game config: width=540, height=950
  // Classic mode button is at x=270, y=670 in game space
  const clickX = box.x + (box.width * (270 / 540));
  const clickY = box.y + (box.height * (670 / 950));
  console.log(`Clicking Classic Mode button at (${clickX}, ${clickY})...`);

  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(1500);

  const gameplayShot = path.join(ARTIFACT_DIR, "basketball_gameplay_started.png");
  await page.screenshot({ path: gameplayShot });
  console.log("Saved gameplay screenshot:", gameplayShot);

  await browserContext.close();
}

playBasketball().catch(console.error);
