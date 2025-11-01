#!/usr/bin/env node

/**
 * Continuously watch wa-client logs and surface pairing-code events with a
 * visual + audible cue. Useful when you cannot stare at the raw docker logs.
 */

import { spawn } from 'node:child_process';
import readline from 'node:readline';

const PAIRING_CODE_TTL_MS = 160_000;

function bell() {
  try {
    process.stdout.write('\x07');
  } catch {
    // ignore
  }
}

function formatPhone(masked) {
  return masked ?? 'unknown';
}

function formatWhen(timestampIso) {
  if (!timestampIso) return 'unknown';
  const when = new Date(timestampIso);
  if (Number.isNaN(when.getTime())) return timestampIso;
  return when.toLocaleTimeString();
}

function prettyDelay(ms) {
  if (!Number.isFinite(ms)) return 'unknown';
  if (ms >= 60_000) {
    const minutes = Math.round(ms / 60_000);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const seconds = Math.round(ms / 1000);
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function sanitize(line) {
  if (typeof line !== 'string') return '';
  const pipeIndex = line.indexOf('|');
  if (pipeIndex >= 0) {
    return line.slice(pipeIndex + 1).trim();
  }
  return line.trim();
}

const docker = spawn('docker', ['compose', 'logs', '-f', 'wa-client'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});

docker.on('error', (err) => {
  console.error('[watch-pairing-code] Failed to start docker compose logs:', err.message);
  process.exitCode = 1;
});

const rl = readline.createInterface({ input: docker.stdout });

rl.on('line', (rawLine) => {
  const line = sanitize(rawLine);
  if (!line) return;

  let parsed;
  if (line.startsWith('{')) {
    try {
      parsed = JSON.parse(line);
    } catch {
      // plain text line, fall through
    }
  }

  const message = parsed?.msg ?? line;
  if (message.includes('Requested phone-number pairing code')) {
    const maskedPhone = formatPhone(parsed?.phoneNumber);
    const code = parsed?.code ?? 'UNKNOWN';
    const attempt = parsed?.attempt ?? 'n/a';
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
    bell();
    console.log('\n=== WhatsApp Pairing Code Available ===');
    console.log(` Code:       ${code}`);
    console.log(` Attempt:    ${attempt}`);
    console.log(` Phone:      ${maskedPhone}`);
    console.log(` Expires at: ${expiresAt.toLocaleTimeString()}`);
    console.log('======================================\n');
    return;
  }

  if (message.includes('Failed to request pairing code automatically') && parsed?.rateLimited) {
    const maskedPhone = formatPhone(parsed?.phoneNumber);
    const nextAt = formatWhen(parsed?.nextRetryAt);
    const delay = prettyDelay(parsed?.nextRetryMs);
    console.log(`[watch] Rate limited for ${maskedPhone}. Next retry in ~${delay} (${nextAt}).`);
    return;
  }

  if (message.includes('Pairing code not received within timeout')) {
    const maskedPhone = formatPhone(parsed?.phoneNumber);
    console.log(`[watch] No code received yet for ${maskedPhone}. Keeping QR suppressed.`);
  }
});

const shutdown = () => {
  rl.close();
  if (!docker.killed) {
    docker.kill('SIGINT');
  }
};

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});
