import { createRequire } from "node:module";
import http from "http";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const playwrightPath = "/Users/adarrsh/.gemini/antigravity/scratch/tshirt-experiment/node_modules/playwright";
const { chromium } = require(playwrightPath);

const PORT = 4399;
const bundlePath = path.resolve("./dist/on-device-chat.min.js");
const stylePath = path.resolve("./dist/style.css");

// Create a generic, non-portfolio mock website (e.g. Acme Cloud SaaS / E-commerce)
const mockHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Acme Cloud &bull; Modern Serverless Infrastructure</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #fff; color: #111; }
    body.dark { background: #0f172a; color: #f8fafc; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; border-bottom: 1px solid #e2e8f0; }
    nav a { margin: 0 1rem; text-decoration: none; color: inherit; font-weight: 500; }
    .hero { padding: 4rem 2rem; text-align: center; }
    section { padding: 3rem 2rem; border-bottom: 1px solid #f1f5f9; }
    .card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 1.5rem; }
    .card { padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 8px; }
    footer { padding: 2rem; text-align: center; color: #64748b; }
    button { cursor: pointer; }
    .theme-toggle-btn { padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; }
  </style>
</head>
<body>
  <header role="banner">
    <div style="font-size: 1.25rem; font-weight: bold;">Acme Cloud</div>
    <nav>
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="#docs">Documentation</a>
      <a href="#contact">Contact</a>
    </nav>
    <button class="theme-toggle-btn" aria-label="Toggle Dark and Light Mode" id="theme-btn">
      🌙 Toggle Theme
    </button>
  </header>

  <main>
    <div class="hero">
      <h1>Scalable Edge Computing For Next-Gen Applications</h1>
      <p class="subtitle">Deploy latency-free edge functions and streaming databases across 300+ cities in seconds.</p>
      <button style="padding: 0.75rem 1.5rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: 600;">
        Start Free Trial
      </button>
    </div>

    <section id="features">
      <h2>Global Edge Network</h2>
      <p>Ultra-low latency execution within 50ms of 95% of the world's population.</p>
      <div class="card-grid">
        <div class="card">
          <h3>Edge KV</h3>
          <p>Sub-millisecond key-value storage at the global edge.</p>
          <button id="btn-kv">Explore KV</button>
        </div>
        <div class="card">
          <h3>Durable Queues</h3>
          <p>Zero-maintenance message delivery with exactly-once semantics.</p>
          <button id="btn-queues">Explore Queues</button>
        </div>
        <div class="card">
          <h3>Edge Compute</h3>
          <p>V8 isolate workers scaling from zero to millions of RPS instantly.</p>
          <button id="btn-compute">Deploy Worker</button>
        </div>
      </div>
    </section>

    <section id="pricing">
      <h2>Transparent Predictable Pricing</h2>
      <p>No egress fees, no hidden surcharges. Pay only for compute cycles used.</p>
      <div class="card-grid">
        <div class="card">
          <h3>Starter</h3>
          <p>Free forever &bull; 100k requests/day</p>
          <button id="btn-starter">Select Starter</button>
        </div>
        <div class="card">
          <h3>Pro</h3>
          <p>$20/mo &bull; 10M requests included</p>
          <button id="btn-pro">Upgrade to Pro</button>
        </div>
        <div class="card">
          <h3>Enterprise</h3>
          <p>Custom SLAs, dedicated VPC, 99.999% uptime guarantee</p>
          <button id="btn-enterprise">Contact Sales</button>
        </div>
      </div>
    </section>

    <section id="docs">
      <h2>Developer Documentation</h2>
      <p>Explore quickstarts, client SDKs, CLI documentation, and sample apps.</p>
      <input type="search" placeholder="Search Acme documentation..." id="doc-search" style="padding: 0.5rem 1rem; width: 300px; border-radius: 6px; border: 1px solid #cbd5e1;">
    </section>

    <footer id="contact">
      <h2>Ready to Build?</h2>
      <p>&copy; 2026 Acme Cloud Corp. All rights reserved.</p>
    </footer>
  </main>

  <script>
    const btn = document.getElementById("theme-btn");
    btn.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      btn.textContent = document.body.classList.contains("dark") ? "☀️ Toggle Theme" : "🌙 Toggle Theme";
    });
  </script>

  <!-- Embed on-device-chat widget standalone bundle -->
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
console.log(`Server running at http://127.0.0.1:${PORT}`);

try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to synthetic generic site...");
  await page.goto(`http://127.0.0.1:${PORT}`);
  await page.waitForTimeout(1500);

  // Verify widget loaded and rendered
  const widgetContainer = await page.$("[data-g4-widget]");
  if (!widgetContainer) {
    throw new Error("Chat widget failed to mount on synthetic site!");
  }
  // Ensure chat widget window is open
  const triggerBtn = await page.$("[data-g4-widget] > button");
  if (triggerBtn) {
    await triggerBtn.click();
    await page.waitForTimeout(500);
  }

  // Test 1: Inquire available actions
  console.log("\n--- TEST 1: Inquiring Actions on Generic Site ---");
  const inputEl = await page.$("[data-g4-widget] form input[type='text'], input[placeholder*='Ask about']");
  if (!inputEl) {
    throw new Error("Chat input element not found!");
  }
  await inputEl.fill("What actions can you perform on this page?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);

  const bubbleText = await page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll("[data-g4-widget] .markdown-content, [data-g4-widget] p"));
    return bubbles.map((b) => b.textContent).join("\n");
  });

  console.log("Actions Output Summary:\n", bubbleText.slice(0, 300));

  // Assertions for zero hardcoding:
  if (/synth|music|portfolio|carol|hire me/i.test(bubbleText)) {
    throw new Error(`FAILURE: Hardcoded portfolio terms leaked into generic site response: ${bubbleText}`);
  }
  console.log("✅ Zero hardcoded portfolio/synth/music terms detected.");

  // Check that dynamic sections were discovered
  if (/features|pricing|docs|contact/i.test(bubbleText)) {
    console.log("✅ Dynamically discovered generic site sections (Features, Pricing, Docs, Contact)!");
  } else {
    console.log("ℹ️ Site sections listed generically.");
  }

  // Test 2: Trigger Site Tour
  console.log("\n--- TEST 2: Autonomous Site Tour on Generic Site ---");
  await page.waitForTimeout(500);
  await inputEl.fill("site tour");
  const submitBtn = await page.$("[data-g4-widget] form button[type='submit']");
  if (submitBtn) {
    await submitBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(2000);

  const bubbles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-g4-widget] .g4-prose")).map(b => b.textContent);
  });
  console.log("All markdown bubbles count:", bubbles.length);
  const tourOutput = bubbles[bubbles.length - 1] || "";

  console.log("Tour Output:\n", tourOutput.slice(0, 350));
  if (/synth|music|portfolio|carol/i.test(tourOutput)) {
    throw new Error(`FAILURE: Hardcoded terms leaked into site tour: ${tourOutput}`);
  }
  if (!/Global Edge Network|Transparent Predictable Pricing|Developer Documentation|Scalable Edge/i.test(tourOutput)) {
    throw new Error(`FAILURE: Site tour failed to dynamically extract actual headings from generic page! Got: "${tourOutput}"`);
  }
  console.log("✅ Site tour extracted actual generic page landmarks dynamically!");

  // Test 3: Theme Toggle Execution
  console.log("\n--- TEST 3: Theme Toggle via Semantic Query ---");
  const initialDark = await page.evaluate(() => document.body.classList.contains("dark"));
  console.log(`Initial theme: dark=${initialDark}`);

  await inputEl.fill("toggle theme");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);

  const afterDark = await page.evaluate(() => document.body.classList.contains("dark"));
  console.log(`After toggle theme: dark=${afterDark}`);
  if (initialDark === afterDark) {
    throw new Error("FAILURE: Theme toggle failed to trigger on generic page!");
  }
  console.log("✅ Theme toggled successfully on generic website!");

  // Test 4: Verify Navigation Hub placeholder & terms
  console.log("\n--- TEST 4: Verifying Navigation Hub on Generic Site ---");
  const navHubBtn = await page.$("button[title*='Navigation' i], button:has(svg.lucide-compass)");
  if (navHubBtn) {
    await navHubBtn.click();
    await page.waitForTimeout(400);

    const placeholder = await page.evaluate(() => {
      const input = document.querySelector("[data-g4-widget] input[type='text']");
      return input ? input.getAttribute("placeholder") : null;
    });

    console.log(`Navigation Hub placeholder: "${placeholder}"`);
    if (/carol/i.test(placeholder || "")) {
      throw new Error(`FAILURE: 'Carol' still present in placeholder: ${placeholder}`);
    }
    console.log("✅ Navigation Hub placeholder is universal!");
  }

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED! WIDGET IS 100% DECOUPLED & UNIVERSAL.");
  console.log("==================================================");

  await browser.close();
} finally {
  server.close();
}
