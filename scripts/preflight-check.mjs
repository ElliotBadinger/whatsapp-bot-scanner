#!/usr/bin/env node
/**
 * Pre-flight Check Script
 * 
 * Verifies that all dependencies and configurations are correctly set up
 * before starting the WhatsApp Bot Scanner services.
 */

import { createRequire } from 'module';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

const CHECK = `${colors.green}✓${colors.reset}`;
const CROSS = `${colors.red}✗${colors.reset}`;
const WARN = `${colors.yellow}⚠${colors.reset}`;
const INFO = `${colors.blue}ℹ${colors.reset}`;

let hasErrors = false;
let hasWarnings = false;

function log(symbol, message) {
  console.log(`  ${symbol} ${message}`);
}

function section(title) {
  console.log(`\n${colors.blue}${title}${colors.reset}`);
  console.log(colors.dim + '─'.repeat(50) + colors.reset);
}

function checkEnvVar(name, required = true, defaultValue = null) {
  const value = process.env[name];
  if (value) {
    const masked = name.includes('KEY') || name.includes('SECRET') || name.includes('PASSWORD')
      ? value.slice(0, 4) + '***'
      : value;
    log(CHECK, `${name} = ${masked}`);
    return true;
  } else if (defaultValue !== null) {
    log(WARN, `${name} not set (default: ${defaultValue})`);
    hasWarnings = true;
    return true;
  } else if (required) {
    log(CROSS, `${name} is required but not set`);
    hasErrors = true;
    return false;
  } else {
    log(INFO, `${name} not set (optional)`);
    return true;
  }
}

function checkFile(path, description) {
  const fullPath = resolve(rootDir, path);
  if (existsSync(fullPath)) {
    log(CHECK, `${description}: ${path}`);
    return true;
  } else {
    log(CROSS, `${description} not found: ${path}`);
    hasErrors = true;
    return false;
  }
}

function checkCommand(command, description) {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    log(CHECK, `${description} (${command})`);
    return true;
  } catch {
    log(CROSS, `${description} not found (${command})`);
    hasErrors = true;
    return false;
  }
}

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major >= 18) {
    log(CHECK, `Node.js version: ${version}`);
    return true;
  } else {
    log(CROSS, `Node.js version ${version} is too old (requires >= 18)`);
    hasErrors = true;
    return false;
  }
}

function checkRedisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    // Just check if we can parse the URL
    new URL(redisUrl);
    log(CHECK, `Redis URL configured: ${redisUrl.replace(/\/\/.*@/, '//***@')}`);
    return true;
  } catch {
    log(CROSS, `Invalid Redis URL: ${redisUrl}`);
    hasErrors = true;
    return false;
  }
}

function checkWhatsAppLibrary() {
  const library = process.env.WA_LIBRARY?.toLowerCase() || 'baileys';
  
  if (library === 'baileys') {
    log(CHECK, `WhatsApp library: Baileys (recommended)`);
    log(INFO, `  Protocol-based, ~50MB RAM, no browser required`);
  } else if (library === 'wwebjs' || library === 'whatsapp-web.js') {
    log(WARN, `WhatsApp library: whatsapp-web.js (legacy)`);
    log(INFO, `  Browser-based, ~500MB RAM, requires Chromium`);
    hasWarnings = true;
    
    // Check for Chromium if using wwebjs
    try {
      execSync('which chromium || which chromium-browser || which google-chrome', { stdio: 'pipe' });
      log(CHECK, `  Chromium/Chrome browser found`);
    } catch {
      log(WARN, `  No Chromium/Chrome browser found (Puppeteer will download one)`);
    }
  } else {
    log(CROSS, `Unknown WhatsApp library: ${library}`);
    hasErrors = true;
  }
  
  return true;
}

function checkPackages() {
  const packages = [
    { name: '@whiskeysockets/baileys', workspace: 'services/wa-client' },
    { name: 'whatsapp-web.js', workspace: 'services/wa-client' },
    { name: 'ioredis', workspace: 'packages/shared' },
    { name: 'bullmq', workspace: 'services/wa-client' },
  ];
  
  for (const pkg of packages) {
    try {
      const pkgPath = resolve(rootDir, pkg.workspace, 'node_modules', pkg.name);
      if (existsSync(pkgPath)) {
        log(CHECK, `${pkg.name} installed`);
      } else {
        // Try root node_modules
        const rootPkgPath = resolve(rootDir, 'node_modules', pkg.name);
        if (existsSync(rootPkgPath)) {
          log(CHECK, `${pkg.name} installed (hoisted)`);
        } else {
          log(CROSS, `${pkg.name} not installed`);
          hasErrors = true;
        }
      }
    } catch {
      log(CROSS, `${pkg.name} check failed`);
      hasErrors = true;
    }
  }
}

function checkDockerNetworking() {
  // Check if Docker is available
  try {
    execSync('docker info', { stdio: 'pipe' });
    log(CHECK, `Docker daemon running`);
  } catch {
    log(INFO, `Docker not running (skip container checks)`);
    return;
  }
  
  // Check for waydroid nftables conflict
  try {
    const nftOutput = execSync('sudo nft list table ip waydroid_filter 2>/dev/null || true', { 
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    if (nftOutput.includes('policy drop')) {
      log(WARN, `Waydroid nftables rules detected - may block Docker networking`);
      log(INFO, `  Run: sudo nft add rule ip waydroid_filter FORWARD accept`);
      hasWarnings = true;
    }
  } catch {
    // No waydroid table, that's fine
  }
}

async function main() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║${colors.reset}    WBScanner Pre-flight Check                  ${colors.blue}║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}`);

  // Load .env if present
  const envPath = resolve(rootDir, '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }

  section('System Requirements');
  checkNodeVersion();
  checkCommand('npm', 'npm package manager');

  section('Configuration Files');
  checkFile('.env', 'Environment file');
  checkFile('package.json', 'Root package.json');
  checkFile('services/wa-client/package.json', 'wa-client package.json');

  section('Environment Variables');
  checkEnvVar('NODE_ENV', false, 'development');
  checkEnvVar('REDIS_URL', false, 'redis://redis:6379/0');
  checkEnvVar('CONTROL_PLANE_API_TOKEN', true);
  checkEnvVar('WA_LIBRARY', false, 'baileys');
  checkEnvVar('WA_AUTH_STRATEGY', false, 'remote');
  checkEnvVar('WA_AUTH_CLIENT_ID', false, 'default');

  section('WhatsApp Library');
  checkWhatsAppLibrary();

  section('Dependencies');
  checkPackages();

  section('Redis Connection');
  checkRedisConnection();

  section('Docker Networking');
  checkDockerNetworking();

  // Summary
  console.log('\n' + colors.dim + '─'.repeat(50) + colors.reset);
  
  if (hasErrors) {
    console.log(`\n${CROSS} ${colors.red}Pre-flight check failed${colors.reset}`);
    console.log(`   Please fix the errors above before starting services.\n`);
    process.exit(1);
  } else if (hasWarnings) {
    console.log(`\n${WARN} ${colors.yellow}Pre-flight check passed with warnings${colors.reset}`);
    console.log(`   Review the warnings above for potential issues.\n`);
    process.exit(0);
  } else {
    console.log(`\n${CHECK} ${colors.green}Pre-flight check passed${colors.reset}`);
    console.log(`   All systems ready!\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${CROSS} Pre-flight check error:`, err);
  process.exit(1);
});
