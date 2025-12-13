#!/usr/bin/env node
/**
 * Patches whatsapp-web.js to ensure compatibility with the current WhatsApp Web UI.
 *
 * For versions < 1.32.0: Patches INTRO_IMG_SELECTOR for QR code authentication
 * For versions >= 1.32.0: Uses AuthStore-based authentication (no patch needed)
 *
 * The newer versions (1.32.0+) use a completely different authentication mechanism
 * based on AuthStore.AppState which doesn't rely on DOM selectors.
 */

const fs = require("fs");
const path = require("path");

const packageJsonPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "whatsapp-web.js",
  "package.json",
);
const clientJsPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "whatsapp-web.js",
  "src",
  "Client.js",
);

console.log("🔧 Checking whatsapp-web.js version and compatibility...");

if (!fs.existsSync(packageJsonPath)) {
  console.log("ℹ️  whatsapp-web.js not found");
  console.log("   Skipping patch (normal during npm install)");
  process.exit(0);
}

// Check version
let version = "0.0.0";
try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  version = pkg.version || "0.0.0";
} catch (err) {
  console.log("⚠️  Could not read package.json:", err.message);
}

console.log(`📦 whatsapp-web.js version: ${version}`);

// Parse version
const [major, minor] = version.split(".").map(Number);
const isModernVersion = major >= 1 && minor >= 32;

if (isModernVersion) {
  console.log(
    "✅ Version 1.32.0+ detected - uses AuthStore-based authentication",
  );
  console.log("   No DOM selector patches needed");
  console.log("   Phone pairing (requestPairingCode) is supported");
  process.exit(0);
}

// Legacy version - apply INTRO_IMG_SELECTOR patch
console.log("⚠️  Legacy version detected - applying INTRO_IMG_SELECTOR patch");

if (!fs.existsSync(clientJsPath)) {
  console.log("ℹ️  Client.js not found at:", clientJsPath);
  process.exit(0);
}

let content = fs.readFileSync(clientJsPath, "utf8");

// New selector that works with current WhatsApp Web UI
// Uses multiple fallbacks including chat icon, textbox, and legacy selectors
const newSelector = `const INTRO_IMG_SELECTOR = '[data-icon="chat"], div[role="textbox"], [data-icon="intro-md-beta-logo-dark"], [data-icon="intro-md-beta-logo-light"], [data-testid="intro-md-beta-logo-dark"], [data-testid="intro-md-beta-logo-light"], [data-asset-intro-image-light="true"], [data-asset-intro-image-dark="true"]'`;

// Check if already patched
if (content.includes('[data-icon="chat"], div[role="textbox"]')) {
  console.log("✅ whatsapp-web.js already patched with robust selector");
  process.exit(0);
}

// Find any INTRO_IMG_SELECTOR definition using multiple regex patterns
const patterns = [
  /const INTRO_IMG_SELECTOR\s*=\s*['"`][^'"`]+['"`];?/g,
  /const INTRO_IMG_SELECTOR\s*=\s*`[^`]+`;?/g,
  /INTRO_IMG_SELECTOR\s*=\s*['"][^'"]+['"];?/g,
];

let patched = false;

for (const pattern of patterns) {
  const matches = content.match(pattern);
  if (matches && matches.length > 0) {
    console.log("📍 Found selector:", matches[0].substring(0, 80) + "...");
    content = content.replace(pattern, newSelector + ";");
    patched = true;
    break;
  }
}

if (patched) {
  fs.writeFileSync(clientJsPath, content, "utf8");
  console.log("✅ Patched INTRO_IMG_SELECTOR in whatsapp-web.js");
  console.log(
    '   New selector includes: [data-icon="chat"], div[role="textbox"], etc.',
  );
} else {
  if (content.includes("INTRO_IMG_SELECTOR")) {
    console.log("⚠️  Found INTRO_IMG_SELECTOR but could not match pattern");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("INTRO_IMG_SELECTOR")) {
        console.log(`   Line ${i + 1}: ${lines[i].trim().substring(0, 100)}`);
      }
    }
  } else {
    console.log("ℹ️  INTRO_IMG_SELECTOR not found in Client.js");
    console.log("   This version may use a different mechanism");
  }
}
