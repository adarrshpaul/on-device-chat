import { createRequire } from "node:module";
import http from "http";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

const PORT = 4398;
const bundlePath = path.resolve("./dist/on-device-chat.min.js");
const stylePath = path.resolve("./dist/style.css");

const mockHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Acme Cloud &bull; API Documentation</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #0f172a; color: #f8fafc; }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 1rem; }
  </style>
</head>
<body>
  <h1>Serverless Edge Compute &bull; API Reference</h1>
  <p>Explore endpoints, request schemas, rate limits, and deployment tokens.</p>
  <script src="/on-device-chat.min.js" data-auto-init data-tier="gemini-nano" data-open="true"></script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(mockHtml);
  } else if (req.url === "/on-device-chat.min.js") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(fs.readFileSync(bundlePath));
  } else if (req.url === "/style.css") {
    res.writeHead(200, { "Content-Type": "text/css" });
    res.end(fs.readFileSync(stylePath));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://127.0.0.1:${PORT}`);
  await page.waitForTimeout(1500);

  // Take screenshot of empty state
  await page.screenshot({ path: "tests/results/quiet_chrome_empty_state.png" });
  console.log("Empty state screenshot saved.");

  // Send a message and take screenshot of thread view
  const inputEl = await page.$("[data-g4-widget] input[type='text']");
  if (inputEl) {
    await inputEl.fill("What actions can you perform on this page?");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "tests/results/quiet_chrome_thread_view.png" });
    console.log("Thread view screenshot saved.");
  }

  await browser.close();
} finally {
  server.close();
}
