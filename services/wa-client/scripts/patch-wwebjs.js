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

if (!fs.existsSync(clientJsPath)) {
  console.log('whatsapp-web.js not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(clientJsPath, 'utf8');

// The old selectors that WhatsApp has deprecated
const oldSelectors = [
  `const INTRO_IMG_SELECTOR = '[data-testid="intro-md-beta-logo-dark"], [data-testid="intro-md-beta-logo-light"], [data-asset-intro-image-light="true"], [data-asset-intro-image-dark="true"]';`,
  `const INTRO_IMG_SELECTOR = '[data-icon="intro-md-beta-logo-dark"], [data-icon="intro-md-beta-logo-light"], [data-asset-intro-image-light="true"], [data-asset-intro-image-dark="true"]';`,
];

// New selector that works with current WhatsApp Web UI
// Uses the chat icon which appears when WhatsApp is fully loaded
const newSelector = `const INTRO_IMG_SELECTOR = '[data-icon="chat"], [data-icon="intro-md-beta-logo-dark"], [data-icon="intro-md-beta-logo-light"], [data-testid="intro-md-beta-logo-dark"], [data-testid="intro-md-beta-logo-light"], div[role="textbox"]';`;

let patched = false;
for (const oldSelector of oldSelectors) {
  if (content.includes(oldSelector)) {
    content = content.replace(oldSelector, newSelector);
    patched = true;
    console.log('✅ Patched INTRO_IMG_SELECTOR in whatsapp-web.js');
    break;
  }
}

// Also try a regex approach for any variations
if (!patched) {
  const selectorRegex = /const INTRO_IMG_SELECTOR = ['"`][^'"`]+['"`];/;
  if (selectorRegex.test(content)) {
    content = content.replace(selectorRegex, newSelector);
    patched = true;
    console.log('✅ Patched INTRO_IMG_SELECTOR in whatsapp-web.js (regex)');
  }
}

if (patched) {
  fs.writeFileSync(clientJsPath, content, 'utf8');
  console.log('✅ whatsapp-web.js patch applied successfully');
} else if (content.includes('[data-icon="chat"]')) {
  console.log('ℹ️  whatsapp-web.js already patched');
} else {
  console.log('⚠️  Could not find INTRO_IMG_SELECTOR to patch');
  console.log('   You may need to manually update node_modules/whatsapp-web.js/src/Client.js');
}

