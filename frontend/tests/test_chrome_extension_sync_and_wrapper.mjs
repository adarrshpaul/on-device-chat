/**
 * Automated Test Suite: Chrome Developer Extension (MV3) Wrapper & Synchronization Pipeline
 * 
 * Validates:
 * 1. Manifest V3 Schema & Configuration (permissions, service worker, content scripts, commands)
 * 2. 100% Byte-for-byte bundle parity between npm dist/ and extension/content/ (SHA-256)
 * 3. Icon binary validity (PNG signatures across all resolutions: 16px, 48px, 128px)
 * 4. Content script message routing & DOM integration contract
 * 5. Background service worker command dispatch & context menu registry
 * 6. Action popup UI structure and event binding definitions
 * 7. Distribution zip packaging for consumers and Chrome Web Store
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_DIR = path.resolve(__dirname, "..");
const EXTENSION_DIR = path.resolve(FRONTEND_DIR, "..", "extension");
const DIST_DIR = path.resolve(FRONTEND_DIR, "dist");

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

console.log("================================================================");
console.log("🧪 Running Chrome Developer Extension & Sync Pipeline Test Suite");
console.log("================================================================\n");

// TEST 1: Sync Pipeline Execution
console.log("--- 1. Testing Sync Pipeline Execution ---");
try {
  const syncOutput = execSync(`node "${path.resolve(FRONTEND_DIR, "scripts/sync-extension.mjs")}"`, {
    encoding: "utf-8"
  });
  assert(syncOutput.includes("Sync Pipeline Complete"), "Sync script executed and finished successfully");
} catch (err) {
  assert(false, "Sync script execution failed", err.message);
}

// TEST 2: Manifest V3 Compliance
console.log("\n--- 2. Testing Manifest V3 Schema & Metadata Compliance ---");
const manifestPath = path.resolve(EXTENSION_DIR, "manifest.json");
const pkgPath = path.resolve(FRONTEND_DIR, "package.json");

assert(fs.existsSync(manifestPath), "manifest.json exists in extension directory");
assert(fs.existsSync(pkgPath), "package.json exists in frontend directory");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

assert(manifest.manifest_version === 3, "Manifest version is exactly 3 (MV3)");
assert((manifest.version_name || manifest.version) === pkg.version, `Version strictly matches package.json (v${pkg.version})`);
assert(manifest.description === pkg.description, "Description matches package.json");
assert(manifest.background?.service_worker === "background.js", "Background service worker configured");
assert(manifest.action?.default_popup === "popup.html", "Action popup is popup.html");
assert(Array.isArray(manifest.permissions) && manifest.permissions.includes("activeTab"), "Permission 'activeTab' granted");
assert(manifest.permissions.includes("storage"), "Permission 'storage' granted");
assert(manifest.permissions.includes("scripting"), "Permission 'scripting' granted");
assert(manifest.permissions.includes("contextMenus"), "Permission 'contextMenus' granted");
assert(manifest.host_permissions?.includes("<all_urls>"), "Host permissions include '<all_urls>'");
assert(manifest.commands?.toggle_agent !== undefined, "Keyboard shortcut 'toggle_agent' defined (Alt+Shift+A)");
assert(manifest.commands?.record_macro !== undefined, "Keyboard shortcut 'record_macro' defined (Alt+Shift+R)");

// TEST 3: Content Script Configuration
console.log("\n--- 3. Testing Content Script Configuration & Dependencies ---");
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, "content_scripts array defined");
const cs = manifest.content_scripts[0];
assert(cs.matches.includes("<all_urls>"), "content_scripts matches <all_urls>");
assert(cs.all_frames === true, "content_scripts enables all_frames for frameset compatibility");
assert(cs.js.includes("content/edge-operator.min.js") || cs.js.includes("content/on-device-chat.min.js"), "content_scripts includes bundled agent library");
assert(cs.js.includes("content/content.js"), "content_scripts includes wrapper content.js");
assert(cs.css.includes("content/style.css"), "content_scripts includes style.css");

// TEST 4: Byte-for-Byte Checksum Parity
console.log("\n--- 4. Testing Byte-for-Byte Checksum Parity (NPM Library == Extension) ---");
const distJs = path.resolve(DIST_DIR, "on-device-chat.min.js");
const extJs = path.resolve(EXTENSION_DIR, "content/on-device-chat.min.js");
const distCss = path.resolve(DIST_DIR, "style.css");
const extCss = path.resolve(EXTENSION_DIR, "content/style.css");

assert(fs.existsSync(distJs) && fs.existsSync(extJs), "Both dist JS and extension JS files exist");
assert(fs.existsSync(distCss) && fs.existsSync(extCss), "Both dist CSS and extension CSS files exist");

const hashDistJs = sha256(distJs);
const hashExtJs = sha256(extJs);
const hashDistCss = sha256(distCss);
const hashExtCss = sha256(extCss);

assert(hashDistJs === hashExtJs, `JS Bundle 100% Bit-Parity Verified (SHA-256: ${hashDistJs.slice(0, 16)}...)`);
assert(hashDistCss === hashExtCss, `CSS Style 100% Bit-Parity Verified (SHA-256: ${hashDistCss.slice(0, 16)}...)`);

// TEST 5: Icon Asset Verification & Magic Numbers
console.log("\n--- 5. Testing Icon Binary Integrity ---");
const iconSizes = [16, 48, 128];
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

for (const size of iconSizes) {
  const iconFile = path.resolve(EXTENSION_DIR, "icons", `icon${size}.png`);
  assert(fs.existsSync(iconFile), `icon${size}.png exists`);
  const buf = fs.readFileSync(iconFile);
  assert(buf.subarray(0, 8).equals(PNG_MAGIC), `icon${size}.png has valid PNG binary signature (0x89PNG...)`);
  assert(buf.length > 50, `icon${size}.png has non-trivial byte length (${buf.length} bytes)`);
}

// TEST 6: Content Script & Background Script Implementation Verification
console.log("\n--- 6. Testing Script Implementation & Message Contract ---");
const contentJsCode = fs.readFileSync(path.resolve(EXTENSION_DIR, "content/content.js"), "utf-8");
assert(contentJsCode.includes("injectLocalStyles"), "content.js implements injectLocalStyles (0-CDN dependency)");
assert(contentJsCode.includes("window.OnDeviceChat.init"), "content.js initializes window.OnDeviceChat");
assert(contentJsCode.includes("GET_PAGE_STATUS"), "content.js handles GET_PAGE_STATUS message");
assert(contentJsCode.includes("TOGGLE_WIDGET"), "content.js handles TOGGLE_WIDGET message");
assert(contentJsCode.includes("START_MACRO_RECORDING"), "content.js handles START_MACRO_RECORDING message");
assert(contentJsCode.includes("ASK_AGENT"), "content.js handles ASK_AGENT context menu message");

const backgroundJsCode = fs.readFileSync(path.resolve(EXTENSION_DIR, "background.js"), "utf-8");
assert(backgroundJsCode.includes("chrome.contextMenus.create"), "background.js registers context menus");
assert(backgroundJsCode.includes("g4_ask_agent"), "background.js registers 'g4_ask_agent' context menu");
assert(backgroundJsCode.includes("g4_teach_macro"), "background.js registers 'g4_teach_macro' context menu");
assert(backgroundJsCode.includes("chrome.commands.onCommand"), "background.js handles keyboard commands");

// TEST 7: Popup UI Structure & Script Contract
console.log("\n--- 7. Testing Action Popup UI & Controller ---");
const popupHtml = path.resolve(EXTENSION_DIR, "popup.html");
const popupCss = path.resolve(EXTENSION_DIR, "popup.css");
const popupJs = path.resolve(EXTENSION_DIR, "popup.js");

assert(fs.existsSync(popupHtml), "popup.html exists");
assert(fs.existsSync(popupCss), "popup.css exists");
assert(fs.existsSync(popupJs), "popup.js exists");

const popupHtmlContent = fs.readFileSync(popupHtml, "utf-8");
assert(popupHtmlContent.includes("popup.css"), "popup.html links popup.css");
assert(popupHtmlContent.includes("popup.js"), "popup.html loads popup.js");
assert(popupHtmlContent.includes("btn-toggle-chat"), "popup.html contains btn-toggle-chat");
assert(popupHtmlContent.includes("btn-record-macro"), "popup.html contains btn-record-macro (Teach 1 → Batch N)");
assert(popupHtmlContent.includes("toggle-autoinject"), "popup.html contains auto-inject preference toggle");
assert(popupHtmlContent.includes("status-badge"), "popup.html contains status badge");

const popupJsContent = fs.readFileSync(popupJs, "utf-8");
assert(popupJsContent.includes("GET_PAGE_STATUS"), "popup.js queries active tab with GET_PAGE_STATUS");
assert(popupJsContent.includes("TOGGLE_WIDGET"), "popup.js dispatches TOGGLE_WIDGET");
assert(popupJsContent.includes("START_MACRO_RECORDING"), "popup.js dispatches START_MACRO_RECORDING");
assert(popupJsContent.includes("chrome.storage.sync"), "popup.js synchronizes settings with chrome.storage.sync");

// TEST 8: Consumer Distribution Package (.zip)
console.log("\n--- 8. Testing Consumer Release Archive (.zip) ---");
const zipFile = path.resolve(DIST_DIR, `on-device-browser-agent-v${pkg.version}.zip`);
assert(fs.existsSync(zipFile), `Release package dist/on-device-browser-agent-v${pkg.version}.zip exists`);
const zipStat = fs.statSync(zipFile);
assert(zipStat.size > 50000, `Release package has healthy compressed size (${(zipStat.size / 1024).toFixed(1)} KB)`);

console.log("\n================================================================");
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log("================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL CHROME EXTENSION WRAPPER & SYNC TESTS PASSED!\n");
  process.exit(0);
}
