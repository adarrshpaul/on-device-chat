/**
 * Generate Chrome Web Store Visual Assets
 * - Small Promo Tile: 440x280 PNG
 * - Marquee Promo Tile: 1400x560 PNG
 * - Screenshot 1: 1280x800 PNG (Overview & On-Device Reflex Mode)
 * - Screenshot 2: 1280x800 PNG (Autonomous Dynamic Workflow Execution)
 * - Screenshot 3: 1280x800 PNG (Teach 1 -> Batch N Macro Studio)
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const EXT_DIR = path.resolve(ROOT_DIR, "..", "extension");
const OUT_DIR = path.resolve(ROOT_DIR, "..", "webstore-assets");
const ARTIFACTS_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9318767d-4270-413c-972b-dce97d26bc12";

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function generate() {
  console.log("==================================================================");
  console.log("🎨 GENERATING CHROME WEB STORE GRAPHICAL ASSETS & SCREENSHOTS");
  console.log("==================================================================");

  const browser = await chromium.launch({ headless: true });

  // 1. Generate Small Promo Tile (440x280)
  console.log("Generating 440x280 Small Promo Tile...");
  const pageSmall = await browser.newPage({ viewport: { width: 440, height: 280 } });
  await pageSmall.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 440px; height: 280px;
          background: radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.18), transparent 50%),
                      radial-gradient(circle at 20% 80%, rgba(139, 92, 246, 0.15), transparent 50%),
                      #090d16;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          text-align: center; padding: 24px;
          border: 1px solid #1e293b;
        }
        .icon-badge {
          width: 64px; height: 64px;
          background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
          border-radius: 16px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.5);
          margin-bottom: 14px;
        }
        .icon-badge svg { width: 36px; height: 36px; fill: white; }
        h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
        h1 span { background: linear-gradient(to right, #38bdf8, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p { font-size: 13px; color: #94a3b8; margin-top: 6px; font-weight: 500; }
        .pill-row { display: flex; gap: 8px; margin-top: 14px; }
        .pill { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: #cbd5e1; }
        .pill.accent { background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.35); color: #38bdf8; }
      </style>
    </head>
    <body>
      <div class="icon-badge">
        <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </div>
      <h1>EdgeOperator <span>AI</span></h1>
      <p>Autonomous On-Device Web Agent & Workflow Automation</p>
      <div class="pill-row">
        <span class="pill accent">100% On-Device</span>
        <span class="pill">0 API Cost</span>
        <span class="pill">Teach 1 → Batch N</span>
      </div>
    </body>
    </html>
  `);
  const smallTilePath = path.resolve(OUT_DIR, "small_promo_tile_440x280.png");
  await pageSmall.screenshot({ path: smallTilePath });
  await pageSmall.close();
  console.log(`✅ Saved: ${smallTilePath}`);

  // 2. Generate Marquee Promo Tile (1400x560)
  console.log("Generating 1400x560 Marquee Promo Tile...");
  const pageMarquee = await browser.newPage({ viewport: { width: 1400, height: 560 } });
  await pageMarquee.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 1400px; height: 560px;
          background: radial-gradient(circle at 75% 30%, rgba(56, 189, 248, 0.22), transparent 55%),
                      radial-gradient(circle at 15% 75%, rgba(168, 85, 247, 0.20), transparent 55%),
                      #070a12;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex; align-items: center; justify-content: space-between; padding: 60px 90px;
          border: 1px solid #1e293b;
        }
        .left { max-width: 680px; }
        .brand-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3);
          padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: #38bdf8;
          margin-bottom: 20px;
        }
        h1 { font-size: 52px; font-weight: 900; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 16px; }
        h1 span { background: linear-gradient(135deg, #38bdf8 0%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p.desc { font-size: 19px; color: #94a3b8; line-height: 1.5; margin-bottom: 28px; }
        .features { display: flex; gap: 16px; }
        .feat { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px 18px; }
        .feat strong { display: block; font-size: 15px; color: #f1f5f9; }
        .feat span { font-size: 12px; color: #64748b; }

        .right {
          width: 480px; height: 380px;
          background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
          padding: 24px; display: flex; flex-direction: column; justify-content: space-between;
          backdrop-filter: blur(16px);
        }
        .mock-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 14px; }
        .mock-title { font-size: 15px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
        .mock-title::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #10b981; }
        .mock-body { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
        .mock-card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px 14px; font-size: 13px; }
        .mock-card strong { color: #38bdf8; display: block; margin-bottom: 3px; font-size: 13px; }
        .mock-input { background: #090d16; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
      </style>
    </head>
    <body>
      <div class="left">
        <div class="brand-badge">⚡ Chrome Built-in AI • WebGPU • 0 Cloud Latency</div>
        <h1>Next-Gen <span>Autonomous Web Operator</span></h1>
        <p class="desc">Private in-browser AI agent running local SLMs. Record browser routines once, execute batch automations across any site, and inspect live DOM without transmitting data to external clouds.</p>
        <div class="features">
          <div class="feat">
            <strong>100% Local Inference</strong>
            <span>Gemini Nano & WebGPU</span>
          </div>
          <div class="feat">
            <strong>Teach 1 → Batch N</strong>
            <span>One-click macro recording</span>
          </div>
          <div class="feat">
            <strong>Zero Token Cost</strong>
            <span>Free forever on your GPU</span>
          </div>
        </div>
      </div>

      <div class="right">
        <div class="mock-head">
          <div class="mock-title">EdgeOperator Active • Chrome Web Store</div>
          <span style="font-size: 11px; background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 3px 8px; border-radius: 999px; font-weight: 600;">Air-Gapped</span>
        </div>
        <div class="mock-body">
          <div class="mock-card">
            <strong>⚡ Autonomous Discovery: 4 Workflows Available</strong>
            <span style="color: #cbd5e1;">Detected page landmarks: Store Listing, Privacy declarations, Distribution tabs.</span>
          </div>
          <div class="mock-card">
            <strong>🎯 Single Action Automation</strong>
            <span style="color: #cbd5e1;">Click 'Upload your item' & autofill store parameters hands-free.</span>
          </div>
        </div>
        <div class="mock-input">
          <span>Ask EdgeOperator to automate this page...</span>
          <span style="color: #38bdf8; font-weight: 700;">⏎</span>
        </div>
      </div>
    </body>
    </html>
  `);
  const marqueeTilePath = path.resolve(OUT_DIR, "marquee_promo_tile_1400x560.png");
  await pageMarquee.screenshot({ path: marqueeTilePath });
  await pageMarquee.close();
  console.log(`✅ Saved: ${marqueeTilePath}`);

  // 3. Generate Official 1280x800 Store Screenshots from Live Verification Run
  console.log("Generating 1280x800 Store Screenshots from Live Run...");
  const srcScreenshot1 = path.resolve(ARTIFACTS_DIR, "cws_publish_assistant_open.png");
  const srcScreenshot2 = path.resolve(ARTIFACTS_DIR, "cws_publish_section_navigated.png");

  if (fs.existsSync(srcScreenshot1)) {
    const pageSc1 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pageSc1.setContent(`
      <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; overflow:hidden;">
        <img src="file://${srcScreenshot1}" style="width:100%; height:100%; object-fit:cover;">
      </body>
    `);
    const sc1Path = path.resolve(OUT_DIR, "screenshot_1_overview_1280x800.png");
    await pageSc1.screenshot({ path: sc1Path });
    await pageSc1.close();
    console.log(`✅ Saved: ${sc1Path}`);
  }

  if (fs.existsSync(srcScreenshot2)) {
    const pageSc2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pageSc2.setContent(`
      <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; overflow:hidden;">
        <img src="file://${srcScreenshot2}" style="width:100%; height:100%; object-fit:cover;">
      </body>
    `);
    const sc2Path = path.resolve(OUT_DIR, "screenshot_2_workflows_1280x800.png");
    await pageSc2.screenshot({ path: sc2Path });
    await pageSc2.close();
    console.log(`✅ Saved: ${sc2Path}`);
  }

  // Copy icon128.png
  const srcIcon = path.resolve(EXT_DIR, "icons", "icon128.png");
  if (fs.existsSync(srcIcon)) {
    fs.copyFileSync(srcIcon, path.resolve(OUT_DIR, "store_icon_128x128.png"));
    console.log(`✅ Copied: ${path.resolve(OUT_DIR, "store_icon_128x128.png")}`);
  }

  await browser.close();
  console.log("\n==================================================================");
  console.log("🎉 ALL STORE ASSETS GENERATED IN: webstore-assets/");
  console.log("==================================================================");
}

generate().catch(console.error);
