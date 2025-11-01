import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';

import { ROOT_DIR } from '../config.mjs';
import { REQUIRED_COMMANDS } from '../utils/constants.mjs';
import { SKIP_PREREQ_CHECKS, SKIP_DOCKER_CHECKS } from '../runtime-flags.mjs';
import { runWithSpinner, formatCliError } from '../utils/runtime.mjs';

async function ensureRepo({ context, output }) {
  if (context.flags.fromTarball) {
    const tarballPath = path.resolve(process.cwd(), context.flags.fromTarball);
    try {
      await fs.access(tarballPath);
    } catch {
      throw new Error(`Tarball ${context.flags.fromTarball} not found.`);
    }
    const contents = await fs.readdir(ROOT_DIR);
    if (contents.length > 1) {
      output.warn('Repository directory is not empty; skipping tarball extraction.');
    } else {
      await runWithSpinner(context, 'Extracting project tarball', () =>
        execa('tar', ['-xf', tarballPath, '-C', ROOT_DIR])
      );
    }
  }
  try {
    await fs.access(path.join(ROOT_DIR, 'docker-compose.yml'));
  } catch {
    throw new Error('docker-compose.yml not found. Run setup from repository root or use --from=<tarball>.');
  }
}

async function detectDockerCompose({ context, runtime, output }) {
  try {
    await execa('docker', ['compose', 'version'], { stdio: 'ignore' });
    runtime.dockerComposeCommand = ['docker', 'compose'];
  } catch {
    try {
      await execa('docker-compose', ['version'], { stdio: 'ignore' });
      runtime.dockerComposeCommand = ['docker-compose'];
      output.warn('Using legacy docker-compose binary. Consider upgrading to Docker Compose v2.');
    } catch {
      throw new Error('Docker Compose v2 not detected. Install via https://docs.docker.com/compose/install/.');
    }
  }
}

async function runPreflightChecks({ context, runtime, output }) {
  if (SKIP_PREREQ_CHECKS) {
    output.warn('Skipping prerequisite checks (SETUP_SKIP_PREREQUISITES=1). Use only for CI pipelines.');
    output.success('Prerequisite checks skipped by configuration.');
    return;
  }
  const skipDocker = context.flags.dryRun && SKIP_DOCKER_CHECKS;
  const commandList = skipDocker ? REQUIRED_COMMANDS.filter(cmd => cmd.name !== 'docker') : REQUIRED_COMMANDS;
  for (const cmd of commandList) {
    try {
      await execa('command', ['-v', cmd.name], { stdio: 'ignore', shell: true });
    } catch {
      throw new Error(`Missing required command: ${cmd.name}. Install hint: ${cmd.hint}`);
    }
  }
  if (skipDocker) {
    output.warn('Docker availability checks skipped for dry run (SETUP_SKIP_DOCKER=1).');
    output.success('Prerequisite checks complete (Docker skipped).');
    return;
  }
  await detectDockerCompose({ context, runtime, output });
  try {
    await execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'version'], { stdio: 'ignore' });
  } catch {
    throw new Error('Docker Compose not responding. Ensure Docker Desktop or the daemon is running.');
  }
  try {
    await execa('docker', ['info'], { stdio: 'ignore' });
  } catch {
    throw new Error('Docker daemon unavailable. Start Docker and retry.');
  }
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    output.info('Proxy settings detected. Docker builds inherit HTTP(S)_PROXY automatically if configured.');
  }
  output.success('Environment checks passed.');
}

async function checkoutBranch({ context, runtime }) {
  if (!context.flags.branch) return;
  await runWithSpinner(context, `git checkout ${context.flags.branch}`, () =>
    execa('git', ['checkout', context.flags.branch], { cwd: ROOT_DIR })
  );
}

async function pullUpdates({ context, runtime, output }) {
  if (!context.flags.pull) return;
  output.heading('Pulling latest updates');
  const gitPath = path.join(ROOT_DIR, '.git');
  let hasGit = true;
  try {
    await fs.access(gitPath);
  } catch {
    hasGit = false;
  }
  if (hasGit) {
    try {
      await runWithSpinner(context, 'git fetch', () =>
        execa('git', ['fetch', '--all', '--prune'], { cwd: ROOT_DIR })
      );
    } catch (error) {
      output.warn(`git fetch skipped (${formatCliError(error)}).`);
    }
    try {
      await runWithSpinner(context, 'git pull', () =>
        execa('git', ['pull', '--ff-only'], { cwd: ROOT_DIR })
      );
    } catch (error) {
      output.warn(`git pull skipped (${formatCliError(error)}). Run git pull manually if you need the latest commits.`);
    }
  } else {
    output.warn('Git repository not detected; skipping git fetch/pull.');
  }
  await runWithSpinner(context, 'docker compose pull', () =>
    execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'pull'], { cwd: ROOT_DIR })
  );
}

export default {
  id: 'preflight',
  title: 'Preflight checks',
  copy: {
    guided: {
      description: 'Verify prerequisites, ensure the repository is present, and align git/docker state before making changes.'
    },
    expert: {
      description: 'Quick environment validation before proceeding to destructive operations.'
    }
  },
  steps: [
    async (api) => ensureRepo(api),
    async (api) => runPreflightChecks(api),
    async (api) => checkoutBranch(api),
    async (api) => pullUpdates(api)
  ]
};
