import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function runWizard(envOverrides: Record<string, string>) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  return spawnSync(
    'node',
    ['scripts/setup-wizard.mjs', '--dry-run', '--noninteractive'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...envOverrides
      },
      encoding: 'utf8',
      stdio: 'pipe'
    }
  );
}

describe('guided setup wizard (dry run)', () => {
  it('runs headless with custom env file and skip flags', () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'wbscanner-setup-test-'));
    const envFile = path.join(tmpDir, '.env.test');
    const result = runWizard({
      SETUP_ENV_PATH: envFile,
      SETUP_SKIP_PREREQUISITES: '1',
      SETUP_SKIP_DOCKER: '1',
      SETUP_SKIP_PORT_CHECKS: '1',
      SETUP_NONINTERACTIVE: '1',
      CI: 'true',
      NO_COLOR: '1'
    });

    if (result.status !== 0) {
      throw new Error(
        `Wizard exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
      );
    }

    expect(result.stdout).toContain('Prerequisite checks skipped');
    expect(result.stdout).toContain('Dry run requested');
    expect(() => statSync(envFile)).not.toThrow();

    const contents = readFileSync(envFile, 'utf8');
    expect(contents).toMatch(/CONTROL_PLANE_API_TOKEN=/);
    expect(contents).toMatch(/WA_REMOTE_AUTH_AUTO_PAIR=/);
  });
});
