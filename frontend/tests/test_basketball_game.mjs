import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const CFT_EXECUTABLE = "/Users/adarrsh/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const ARTIFACT_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136";

async function probeBasketball() {
  console.log("🏀 Launching browser with extension to inspect basketball.paulcreates.online...");
  const browserContext = await chromium.launchPersistentContext("", {
    executablePath: CFT_EXECUTABLE,
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-sandbox",
    ],
    viewport: { width: 450, height: 850 }, // Mobile portrait viewport typical for basketball games
  });

  const page = await browserContext.newPage();
  console.log("Navigating to https://basketball.paulcreates.online/ ...");
  await page.goto("https://basketball.paulcreates.online/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Take screenshot of initial state
  const initialShot = path.join(ARTIFACT_DIR, "basketball_initial_screen.png");
  await page.screenshot({ path: initialShot });
  console.log("Saved initial screenshot:", initialShot);

  // Probe DOM and JS
  const probeData = await page.evaluate(() => {
    const root = document.getElementById("root");
    const canvases = Array.from(document.querySelectorAll("canvas")).map(c => ({
      width: c.width,
      height: c.height,
      clientWidth: c.clientWidth,
      clientHeight: c.clientHeight,
      id: c.id,
      className: c.className
    }));
    const buttons = Array.from(document.querySelectorAll("button, a, [role='button']")).map(b => ({
      text: b.innerText || b.textContent,
      className: b.className,
      id: b.id
    }));
    const textNodes = Array.from(document.querySelectorAll("p, span, h1, h2, h3, div")).map(el => el.innerText).filter(t => t && t.length < 50);

    // Look for global game variables
    const windowKeys = Object.keys(window).filter(k => 
      k.toLowerCase().includes("game") || 
      k.toLowerCase().includes("score") || 
      k.toLowerCase().includes("phaser") || 
      k.toLowerCase().includes("pixi") || 
      k.toLowerCase().includes("ball") ||
      k.toLowerCase().includes("play")
    );

    const launcher = document.getElementById("g4-floating-launcher");
    return {
      title: document.title,
      canvases,
      buttons,
      sampleTexts: Array.from(new Set(textNodes)).slice(0, 20),
      windowKeys,
      hasLauncher: !!launcher,
      bodyHtmlSnippet: document.body.innerHTML.slice(0, 1000)
    };
  });

  console.log("Probe Data:", JSON.stringify(probeData, null, 2));

  await browserContext.close();
}

probeBasketball().catch(console.error);
