import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const CFT_EXECUTABLE = "/Users/adarrsh/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

async function inspectPhaser() {
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
  await page.waitForTimeout(2000);

  const phaserInfo = await page.evaluate(() => {
    const P = window.Phaser;
    const games = P ? (P.GAMES || []) : [];
    const game = games[0] || window.game;

    if (!game) {
      return { hasPhaser: !!P, gamesCount: games.length, windowKeys: Object.keys(window).filter(k => !k.startsWith("webkit")) };
    }

    const sceneManager = game.scene;
    const scenes = sceneManager ? sceneManager.scenes.map(s => ({
      key: s.scene?.key || s.key,
      sysSettings: s.sys?.settings?.key,
      active: s.sys?.settings?.active,
      visible: s.sys?.settings?.visible,
      data: s.data ? Object.keys(s.data.values || {}) : [],
      keys: Object.keys(s).filter(k => !k.startsWith("_") && typeof s[k] !== "function")
    })) : [];

    return {
      hasPhaser: true,
      phaserVersion: P.VERSION,
      gameConfig: {
        width: game.config?.width,
        height: game.config?.height,
        physics: game.config?.physics?.default
      },
      scenes,
    };
  });

  console.log("Phaser Info:", JSON.stringify(phaserInfo, null, 2));
  await browserContext.close();
}

inspectPhaser().catch(console.error);
