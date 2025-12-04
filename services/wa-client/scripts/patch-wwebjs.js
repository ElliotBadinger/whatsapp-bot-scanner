#!/usr/bin/env node
/**
 * Patches whatsapp-web.js to fix the INTRO_IMG_SELECTOR issue
 * that prevents the 'ready' event from firing.
 * 
 * WhatsApp frequently changes their UI, breaking the selector.
 * This script updates the selector to work with the current UI.
 */

const fs = require('fs');
const path = require('path');

const clientJsPath = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');

console.log('🔧 Checking whatsapp-web.js for INTRO_IMG_SELECTOR patch...');

if (!fs.existsSync(clientJsPath)) {
  console.log('ℹ️  whatsapp-web.js not found at:', clientJsPath);
  console.log('   Skipping patch (normal during npm install)');
  process.exit(0);
}

let content = fs.readFileSync(clientJsPath, 'utf8');

// New selector that works with current WhatsApp Web UI
// Uses multiple fallbacks including chat icon, textbox, and legacy selectors
const newSelector = `const INTRO_IMG_SELECTOR = '[data-icon="chat"], div[role="textbox"], [data-icon="intro-md-beta-logo-dark"], [data-icon="intro-md-beta-logo-light"], [data-testid="intro-md-beta-logo-dark"], [data-testid="intro-md-beta-logo-light"], [data-asset-intro-image-light="true"], [data-asset-intro-image-dark="true"]'`;

// Check if already patched
if (content.includes('[data-icon="chat"], div[role="textbox"]')) {
  console.log('✅ whatsapp-web.js already patched with robust selector');
  process.exit(0);
}

// Find any INTRO_IMG_SELECTOR definition using multiple regex patterns
const patterns = [
  /const INTRO_IMG_SELECTOR\s*=\s*['"`][^'"`]+['"`];?/g,
  /const INTRO_IMG_SELECTOR\s*=\s*`[^`]+`;?/g,
  /INTRO_IMG_SELECTOR\s*=\s*['"][^'"]+['"];?/g,
];

let patched = false;
let matchedPattern = null;

for (const pattern of patterns) {
  const matches = content.match(pattern);
  if (matches && matches.length > 0) {
    matchedPattern = matches[0];
    console.log('📍 Found selector:', matchedPattern.substring(0, 80) + '...');
    content = content.replace(pattern, newSelector + ';');
    patched = true;
    break;
  }
}

if (patched) {
  fs.writeFileSync(clientJsPath, content, 'utf8');
  console.log('✅ Patched INTRO_IMG_SELECTOR in whatsapp-web.js');
  console.log('   New selector includes: [data-icon="chat"], div[role="textbox"], etc.');
} else {
  // Check if INTRO_IMG_SELECTOR exists at all
  if (content.includes('INTRO_IMG_SELECTOR')) {
    console.log('⚠️  Found INTRO_IMG_SELECTOR but could not match pattern');
    // Extract and show what we found
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('INTRO_IMG_SELECTOR')) {
        console.log(`   Line ${i + 1}: ${lines[i].trim().substring(0, 100)}`);
      }
    }
  } else {
    console.log('ℹ️  INTRO_IMG_SELECTOR not found in Client.js');
    console.log('   This version may use a different mechanism');
  }
}
