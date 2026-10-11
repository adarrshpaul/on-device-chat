import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const CFT_EXECUTABLE = "/Users/adarrsh/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const ARTIFACT_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136";

async function testFullGameHighScore() {
  console.log("🏀 Starting Full 60s Match AI Basketball Player on basketball.paulcreates.online...");
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

  // Run the Autopilot Agent loop for the full 60s match
  console.log("🏀 Launching High-Performance Autopilot Loop for Full Match...");
  const gameLog = await page.evaluate(async () => {
    const game = window.__phaserGame;
    const scene = game.scene.getScene("game_screen");
    const logs = [];
    const startTime = Date.now();

    let lastJumpTime = 0;
    let jumpCount = 0;

    function getTargetHoop() {
      const vx = scene.basketballVelocityX;
      if (vx > 0) {
        const rightHoops = scene.BasketBallNetBoardRingCollisionArrayRight || [];
        if (rightHoops.length > 0) {
          return {
            x: rightHoops[0].Sensor?.position?.x || 440,
            y: rightHoops[0].Sensor?.position?.y || 400,
            side: "right"
          };
        }
      } else {
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
    function shouldJump(ballX, ballY, hoop, isMovingRight) {
      const now = performance.now();
      if (now - lastJumpTime < 200) return false;

      // Safe bounds keep-alive
      if (ballY > 580) {
        return true;
      }

      // If hoop is transitioning or spawning, stay floating safely around mid-court
      if (!hoop) {
        if (ballY > 480 && scene.basketball.body.velocity.y > 2) {
          return true;
        }
        return false;
      }

      const targetX = hoop.x;
      const targetY = hoop.y;

      // Trajectory prediction forward integration (60 frames)
      let simX = ballX;
      let simY = ballY;
      let simVx = isMovingRight ? 5.8 : -5.8;
      let simVy = -24; // If jumped
      const airFriction = 0.99;
      const gravity = 1.05;

      for (let step = 0; step < 60; step++) {
        simX += simVx;
        simY += simVy;
        simVx *= airFriction;
        simVy += gravity;

        // Check if trajectory falls through the hoop rim
        const dx = Math.abs(simX - targetX);
        const dy = simY - targetY;

        // Clean drop: horizontally aligned, slightly above rim crossing down
        if (dx < 26 && dy >= -10 && dy <= 32 && simVy > 2) {
          return true;
        }
      }

      // Mid-court boost: if ball is dropping and far from target
      const distanceToTarget = Math.abs(ballX - targetX);
      if (distanceToTarget > 160 && ballY > targetY + 40 && scene.basketball.body.velocity.y > 4) {
        return true;
      }

      return false;
    }

    // Run until game over or 65s max
    while (Date.now() - startTime < 65000) {
      // Check if transitioned to score_page
      if (game.scene.isActive("score_page") || game.scene.isActive("score_page_back")) {
        break;
      }

      const ball = scene.basketball;
      const hoop = getTargetHoop();

      if (ball && ball.body) {
        const isMovingRight = scene.basketballVelocityX > 0;
        const doJump = shouldJump(ball.x, ball.y, hoop, isMovingRight);

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
            combo: scene.bonusScore,
            turbo: !!scene.turboBoostState
          });
        }
      }

      // Check timer progress
      if (scene.timer && scene.timer.getOverallProgress() >= 0.99) {
        break;
      }

      await new Promise(r => requestAnimationFrame(r));
    }

    // Grab score from registry or scene
    const finalScore = game.registry.get("score") || scene.score_value || 0;

    return {
      finalScore,
      totalJumps: jumpCount,
      log: logs,
      activeScene: game.scene.scenes.find(s => s.sys.settings.active)?.scene.key
    };
  });

  console.log("Full Game Results:", JSON.stringify(gameLog, null, 2));

  // Wait 1.5s for score screen transition
  await page.waitForTimeout(2000);
  const finalScoreShot = path.join(ARTIFACT_DIR, "basketball_final_match_score.png");
  await page.screenshot({ path: finalScoreShot });
  console.log("Saved final match screenshot:", finalScoreShot);

  await browserContext.close();
}

testFullGameHighScore().catch(console.error);
