#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  console.error(`[validate-config] Missing .env.example at ${envPath}`);
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const lines = content.split(/\r?\n/);
let hasError = false;

lines.forEach((line, index) => {
  if (/^\s*#/.test(line)) {
    return;
  }

  const match = line.match(/^\s*([A-Z0-9_]+_QUEUE)\s*=\s*(.*)$/);
  if (!match) {
    return;
  }

  const [, key, rawValue] = match;
  const value = rawValue.trim();

  if (value.includes(':')) {
    console.error(
      `[validate-config] ${key} in .env.example cannot contain a colon (line ${index + 1}, value: "${value}").`
    );
    hasError = true;
  }
});

if (hasError) {
  console.error('[validate-config] Queue names must exclude colons to avoid BullMQ runtime failures.');
  process.exit(1);
}

console.log('[validate-config] All queue configuration values are valid.');
