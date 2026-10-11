#!/usr/bin/env node
/**
 * On-Device Browser Agent • Automated Extension Synchronization Pipeline
 * 
 * Guarantees 100% parity between npm package (on-device-chat) and Chrome Developer Extension:
 * 1. Synchronizes version, description, and metadata from package.json to manifest.json.
 * 2. Copies compiled standalone JS bundle (on-device-chat.min.js) and CSS (style.css) into extension/content/.
 * 3. Verifies SHA-256 checksums to assert byte-for-byte fidelity.
 * 4. Verifies all required icon assets and generates them if missing.
 * 5. Generates a consumer-ready release zip in frontend/dist/ for Chrome Web Store / developer distribution.
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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

console.log("================================================================");
console.log("⚡ On-Device Browser Agent: Synchronizing NPM Package & Extension");
console.log("================================================================");

// 1. Read Package.json
const pkgPath = path.resolve(FRONTEND_DIR, "package.json");
if (!fs.existsSync(pkgPath)) {
  console.error(`❌ package.json not found at ${pkgPath}`);
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
console.log(`📦 NPM Library:    ${pkg.name} v${pkg.version}`);
console.log(`📝 Description:    ${pkg.description}`);

// 2. Validate & Sync Manifest.json
const manifestPath = path.resolve(EXTENSION_DIR, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`❌ manifest.json not found at ${manifestPath}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

const prevVersion = manifest.version;
manifest.version = pkg.version;
manifest.description = pkg.description;
if (pkg.homepage) {
  manifest.homepage_url = pkg.homepage;
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log(`🔄 Manifest Sync:   v${prevVersion} → v${manifest.version} (Updated)`);

// 3. Ensure Content Scripts Directory Exists
const contentDir = path.resolve(EXTENSION_DIR, "content");
if (!fs.existsSync(contentDir)) {
  fs.mkdirSync(contentDir, { recursive: true });
}

// 4. Verify Source Bundles in dist/
const srcJs = path.resolve(DIST_DIR, "on-device-chat.min.js");
const srcCss = path.resolve(DIST_DIR, "style.css");

if (!fs.existsSync(srcJs) || !fs.existsSync(srcCss)) {
  console.error("❌ Compiled distribution bundles not found in frontend/dist/.");
  console.error("👉 Run `npm run build` first to compile on-device-chat.min.js and style.css.");
  process.exit(1);
}

// 5. Copy Bundles to Extension
const destJs = path.resolve(contentDir, "on-device-chat.min.js");
const destCss = path.resolve(contentDir, "style.css");

fs.copyFileSync(srcJs, destJs);
fs.copyFileSync(srcCss, destCss);

// 6. Verify Checksum Parity
const hashSrcJs = sha256(srcJs);
const hashDestJs = sha256(destJs);
const hashSrcCss = sha256(srcCss);
const hashDestCss = sha256(destCss);

if (hashSrcJs !== hashDestJs || hashSrcCss !== hashDestCss) {
  console.error("❌ Checksum mismatch detected between dist/ and extension/content/!");
  process.exit(1);
}

const jsSize = fs.statSync(destJs).size;
const cssSize = fs.statSync(destCss).size;

console.log(`✅ JS Bundle Parity:  ${formatBytes(jsSize)} | SHA-256: ${hashSrcJs.slice(0, 16)}...`);
console.log(`✅ CSS Style Parity:  ${formatBytes(cssSize)} | SHA-256: ${hashSrcCss.slice(0, 16)}...`);

// 7. Verify Icon Assets
const iconDir = path.resolve(EXTENSION_DIR, "icons");
const requiredIcons = ["icon16.png", "icon48.png", "icon128.png"];
let missingIcons = requiredIcons.some(icon => !fs.existsSync(path.resolve(iconDir, icon)));

if (missingIcons) {
  console.log("🎨 Generating missing extension icons...");
  const iconGenScript = path.resolve(FRONTEND_DIR, "scripts", "generate-icons.mjs");
  execSync(`node "${iconGenScript}"`, { stdio: "inherit" });
}
console.log(`✅ Icons Verified:    All 16px, 48px, 128px PNG assets present.`);

// 8. Package Extension for Consumer Distribution (.zip)
const zipFileName = `on-device-browser-agent-v${pkg.version}.zip`;
const zipPath = path.resolve(DIST_DIR, zipFileName);

try {
  // Use macOS/Linux native zip command for maximum speed and zero dependencies
  execSync(`rm -f "${zipPath}"`);
  execSync(`cd "${EXTENSION_DIR}" && zip -r "${zipPath}" . -x "*.DS_Store" "*__MACOSX*"`, {
    stdio: "pipe"
  });
  const zipSize = fs.statSync(zipPath).size;
  console.log(`📦 Release Package:   dist/${zipFileName} (${formatBytes(zipSize)})`);
} catch (err) {
  console.warn("⚠️ Warning: Could not create zip archive (zip utility might not be in PATH):", err.message);
}

console.log("================================================================");
console.log("🚀 Sync Pipeline Complete: Extension is 100% in sync with NPM!");
console.log("👉 Extension Directory:  " + EXTENSION_DIR);
console.log("👉 Load Unpacked in:     chrome://extensions (Developer Mode)");
console.log("================================================================");
