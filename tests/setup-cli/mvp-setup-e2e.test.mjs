import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const ENV_BACKUP_PATH = path.join(ROOT_DIR, '.env.e2e-backup');

const stripAnsi = (value) => value.replace(/\u001b\[[0-9;]*m/g, '');

async function createFakeDocker(binDir, logFile) {
  const dockerPath = path.join(binDir, 'docker');
  const script = `#!/usr/bin/env bash
set -euo pipefail
LOG_FILE="${logFile}"
# Record invocations for assertions
printf '%s\n' "$*" >> "$LOG_FILE"

if [[ "$1" == "--version" ]]; then
  echo "Docker version 25.0.0"
  exit 0
fi

if [[ "$1" == "info" ]]; then
  exit 0
fi

if [[ "$1" == "inspect" ]]; then
  echo "healthy"
  exit 0
fi

if [[ "$1" == "compose" ]]; then
  shift
  if [[ "$1" == "-f" ]]; then
    shift 2
  fi
  sub="$1"
  shift || true
  case "$sub" in
    ps)
      if [[ "$1" == "--format" ]]; then
        if [[ "$2" == "json" ]]; then
          echo '{"Service":"wa-client","State":"running","Health":"healthy"}'
        fi
      fi
      exit 0
      ;;
    logs)
      exit 0
      ;;
    exec)
      # Always succeed for in-container checks
      exit 0
      ;;
    up|down|build|restart)
      exit 0
      ;;
    *)
      exit 0
      ;;
  esac
fi

exit 0
`;
  await fs.writeFile(dockerPath, script, { mode: 0o755 });
  return dockerPath;
}

describe.sequential('MVP setup onboarding (end-to-end)', () => {
  let tempDir;
  let dockerLog;
  let originalEnvExists = false;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wbscanner-mvp-e2e-'));
    dockerLog = path.join(tempDir, 'docker.log');
    await createFakeDocker(tempDir, dockerLog);

    try {
      await fs.access(ENV_PATH);
      originalEnvExists = true;
      await fs.rename(ENV_PATH, ENV_BACKUP_PATH);
    } catch {
      originalEnvExists = false;
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(ENV_PATH, { force: true });
    } catch {}

    if (originalEnvExists) {
      try {
        await fs.rename(ENV_BACKUP_PATH, ENV_PATH);
      } catch {}
    } else {
      try {
        await fs.rm(ENV_BACKUP_PATH, { force: true });
      } catch {}
    }

    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('completes MVP setup without Docker and writes MVP env', async () => {
    const env = {
      ...process.env,
      PATH: `${tempDir}:${process.env.PATH}`,
      FORCE_COLOR: '0',
    };

    const result = await execa(
      'node',
      ['scripts/unified-cli.mjs', 'setup', '--mvp-mode', '--noninteractive', '--skip-pairing'],
      { cwd: ROOT_DIR, env }
    );

    const output = stripAnsi(`${result.stdout}\n${result.stderr}`);
    expect(output).toContain('API keys skipped (MVP mode)');
    expect(output).toContain('Configuration set to mvp mode');

    const envContent = await fs.readFile(ENV_PATH, 'utf-8');
    expect(envContent).toContain('MVP_MODE=1');
    expect(envContent).toContain('WA_REMOTE_AUTH_STORE=memory');

    const logContent = await fs.readFile(dockerLog, 'utf-8');
    expect(logContent).toContain('compose -f docker-compose.mvp.yml up -d --build');
    expect(logContent).toContain('compose -f docker-compose.mvp.yml exec -T wa-client');
  });
});
