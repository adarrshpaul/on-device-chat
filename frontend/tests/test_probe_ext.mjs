import { chromium } from "playwright";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../extension");
const ARTIFACT_DIR = "/Users/adarrsh/.gemini/antigravity/brain/9028f61e-1ef0-48c8-a5b2-94daaec76136";

console.log("Extension Path:", EXTENSION_PATH);

// 1. Create a mock e-commerce / catalog webpage
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Merchant Portal • Live Extension Test</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; }
    h1 { color: #38bdf8; margin-bottom: 8px; }
    p { color: #94a3b8; margin-bottom: 24px; }
    table { width: 100%; max-width: 900px; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th, td { padding: 14px 18px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #0f172a; color: #cbd5e1; font-weight: 600; font-size: 13px; text-transform: uppercase; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #065f46; color: #34d399; }
    .btn-edit { background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    .price-input { background: #0f172a; border: 1px solid #475569; color: white; padding: 6px 10px; border-radius: 4px; width: 80px; }
  </style>
</head>
<body>
  <h1>Merchant Catalog Manager</h1>
  <p>Testing Chrome Developer Extension (Manifest V3) live on an arbitrary domain.</p>

  <table id="inventory-table">
    <thead>
      <tr>
        <th>SKU</th>
        <th>Product Name</th>
        <th>Stock Status</th>
        <th>Price ($)</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr class="product-row" data-id="p1">
        <td>SKU-001</td>
        <td>Double-Lion Crest Heavy Tee</td>
        <td><span class="badge">In Stock</span></td>
        <td><input type="text" class="price-input" name="price" value="45.00"></td>
        <td><button class="btn-edit" data-action="edit">Edit Row</button></td>
      </tr>
      <tr class="product-row" data-id="p2">
        <td>SKU-002</td>
        <td>Cyberpunk Sigil Acid-Wash Tee</td>
        <td><span class="badge">In Stock</span></td>
        <td><input type="text" class="price-input" name="price" value="50.00"></td>
        <td><button class="btn-edit" data-action="edit">Edit Row</button></td>
      </tr>
      <tr class="product-row" data-id="p3">
        <td>SKU-003</td>
        <td>Edo Bonsai Minimalist Tee</td>
        <td><span class="badge">In Stock</span></td>
        <td><input type="text" class="price-input" name="price" value="42.00"></td>
        <td><button class="btn-edit" data-action="edit">Edit Row</button></td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(HTML_CONTENT);
});

server.listen(4545, async () => {
  console.log("Local test server running at http://127.0.0.1:4545");

  const userDataDir = `/tmp/test-ext-profile-${Date.now()}`;
  let context = null;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--no-default-browser-check"
      ],
      viewport: { width: 1280, height: 800 }
    });

    // Check service worker to get extension ID
    let extensionId = null;
    let serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      const swUrl = serviceWorkers[0].url();
      extensionId = swUrl.split("/")[2];
      console.log("Extension Service Worker detected! Extension ID:", extensionId);
    } else {
      console.log("Waiting for service worker...");
      const sw = await context.waitForEvent("serviceworker", { timeout: 5000 }).catch(() => null);
      if (sw) {
        extensionId = sw.url().split("/")[2];
        console.log("Service worker ready! Extension ID:", extensionId);
      }
    }

    const page = context.pages()[0] || await context.newPage();

    // Listen to console logs in the page
    page.on("console", msg => console.log(`[Page Console ${msg.type()}]:`, msg.text()));

    console.log("Navigating to http://127.0.0.1:4545...");
    await page.goto("http://127.0.0.1:4545", { waitUntil: "networkidle" });

    // Wait up to 5s for the extension content script to mount #gemma4-widget-root
    console.log("Waiting for #gemma4-widget-root or launcher...");
    await page.waitForTimeout(1500);

    const hasRoot = await page.$("#gemma4-widget-root");
    console.log("#gemma4-widget-root present?", !!hasRoot);

    const launcher = await page.$("#g4-floating-launcher, button[aria-label*='AI'], button[aria-label*='Chat']");
    console.log("Launcher button present?", !!launcher);

    const screenshot1 = path.join(ARTIFACT_DIR, "extension_e2e_page_with_launcher.png");
    await page.screenshot({ path: screenshot1 });
    console.log("Screenshot 1 saved:", screenshot1);

    if (launcher) {
      console.log("Clicking launcher...");
      await launcher.click();
      await page.waitForTimeout(1000);

      const screenshot2 = path.join(ARTIFACT_DIR, "extension_e2e_chat_opened.png");
      await page.screenshot({ path: screenshot2 });
      console.log("Screenshot 2 saved:", screenshot2);
    }

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    if (context) await context.close();
    server.close();
    console.log("Test finished & cleaned up.");
  }
});
