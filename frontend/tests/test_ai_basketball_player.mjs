import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const CFT_EXECUTABLE = "/Users/adarrsh/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const ARTIFACT_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136";

async function testAiBasketballPlayer() {
  console.log("🏀 Starting AI Basketball Player on https://basketball.paulcreates.online/ ...");
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

  // Intercept Phaser Game Instance
  await page.addInitScript(() => {
    let _p = undefined;
    Object.defineProperty(window, "Phaser", {
      configurable: true,
      get() { return _p; },
      set(val) {
        _p = val;
        if (val && val.Game) {
          const OrigGame = val.Game;
          val.Game = function(...args) {
            const inst = new OrigGame(...args);
            window.__phaserGame = inst;
            return inst;
          };
          val.Game.prototype = OrigGame.prototype;
        }
      }
    });
  });

  await page.goto("https://basketball.paulcreates.online/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click Classic Mode start button
  const canvas = await page.$("canvas");
  const box = await canvas.boundingBox();
  const startX = box.x + (box.width * (270 / 540));
  const startY = box.y + (box.height * (670 / 950));
  console.log("Clicking start button at:", startX, startY);
  await page.mouse.click(startX, startY);
  await page.waitForTimeout(800);

  // Run the Autopilot Agent loop inside page context for 20 seconds
  console.log("🏀 Launching Physics-Informed Autopilot Agent...");
  const gameLog = await page.evaluate(async () => {
    const game = window.__phaserGame;
    const scene = game.scene.getScene("game_screen");
    const logs = [];
    const startTime = Date.now();

    let lastJumpTime = 0;
    let jumpCount = 0;

    function getTargetHoop() {
      // Determine if moving right or left
      const vx = scene.basketballVelocityX;
      if (vx > 0) {
        // Target is right hoop
        const rightHoops = scene.BasketBallNetBoardRingCollisionArrayRight || [];
        if (rightHoops.length > 0) {
          return {
            x: rightHoops[0].Sensor?.position?.x || 440,
            y: rightHoops[0].Sensor?.position?.y || 400,
            side: "right"
          };
        }
      } else {
        // Target is left hoop
        const leftHoops = scene.BasketBallNetBoardRingCollisionArray || [];
        if (leftHoops.length > 0) {
          return {
            x: leftHoops[0].Sensor?.position?.x || 100,
            y: leftHoops[0].Sensor?.position?.y || 400,
            side: "left"
          };
        }
      }
      return null;
    }

    // Predictive physics simulator
    function shouldJump(ballX, ballY, targetX, targetY, isMovingRight) {
      const now = performance.now();
      // Debounce minimum 200ms between jumps
      if (now - lastJumpTime < 220) return false;

      // 1. Keep-alive boundary check: If falling dangerously low
      if (ballY > 620) {
        return true;
      }

      // 2. Trajectory prediction if jumping right now
      let simX = ballX;
      let simY = ballY;
      let simVx = isMovingRight ? 5.8 : -5.8;
      let simVy = -24; // Jump velocity
      const airFriction = 0.99;
      const gravity = 1.05;

      for (let step = 0; step < 55; step++) {
        simX += simVx;
        simY += simVy;
        simVx *= airFriction;
        simVy += gravity;

        // Check if trajectory enters the hoop cylinder from ABOVE while falling
        const dx = Math.abs(simX - targetX);
        const dy = simY - targetY;

        // Ideal rim entry: within 22px horizontally, crossing hoop level (dy between -5 and +25), falling downward (simVy > 4)
        if (dx < 25 && dy >= -8 && dy <= 30 && simVy > 3) {
          return true;
        }
      }

      // 3. Mid-court boost check: If ball is falling past hoop level and far from target, boost
      const distanceToTarget = Math.abs(ballX - targetX);
      if (distanceToTarget > 180 && ballY > targetY + 60 && scene.basketball.body.velocity.y > 5) {
        return true;
      }

      return false;
    }

    // Agent loop running at 60fps for 25 seconds
    while (Date.now() - startTime < 25000) {
      const ball = scene.basketball;
      const hoop = getTargetHoop();

      if (ball && hoop) {
        const isMovingRight = scene.basketballVelocityX > 0;
        const doJump = shouldJump(ball.x, ball.y, hoop.x, hoop.y, isMovingRight);

        if (doJump) {
          scene.basketballAction();
          lastJumpTime = performance.now();
          jumpCount++;
        }
      }

      // Check current score
      if (scene.score_value !== undefined) {
        const currentScore = scene.score_value;
        const lastEntry = logs[logs.length - 1];
        if (!lastEntry || lastEntry.score !== currentScore) {
          logs.push({
            elapsedSec: Math.round((Date.now() - startTime) / 1000),
            score: currentScore,
            jumps: jumpCount,
            combo: scene.bonusScore
          });
        }
      }

      await new Promise(r => requestAnimationFrame(r));
    }

    return {
      finalScore: scene.score_value,
      totalJumps: jumpCount,
      log: logs,
      timerProgress: scene.timer ? scene.timer.getOverallProgress() : null
    };
  });

  console.log("Autopilot Results:", JSON.stringify(gameLog, null, 2));

  // Take screenshot of live score
  const finalShot = path.join(ARTIFACT_DIR, "basketball_ai_gameplay_score.png");
  await page.screenshot({ path: finalShot });
  console.log("Saved score screenshot:", finalShot);

  await browserContext.close();
}

testAiBasketballPlayer().catch(console.error);
