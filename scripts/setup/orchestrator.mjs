import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import boxen from 'boxen';
import chalk from 'chalk';
import enquirer from 'enquirer';
import humanizeDuration from 'humanize-duration';
import ora from 'ora';
import { execa } from 'execa';

import { SetupContext } from './core/context.mjs';
import { parseFlags } from './core/flags.mjs';
import { EnvFile } from './core/env-file.mjs';
import { createOutput } from './ui/output.mjs';
import { registerHotkeys } from './ui/hotkeys.mjs';
import { registerPhase, clearPhases, runPhases } from './phases/registry.mjs';
import { pluginsForStage, clearPlugins } from './plugins/registry.mjs';
import { registerBuiltinPlugins } from './plugins/builtin.mjs';
import { REQUIRED_COMMANDS, PORT_CHECKS, WAIT_FOR_SERVICES } from './utils/constants.mjs';
import { redactPair } from './utils/redact.mjs';
import { describeHotkeys } from './ui/hotkeys.mjs';

const { Confirm, Toggle, MultiSelect, Input } = enquirer;

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(SCRIPT_PATH), '..', '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const ENV_TEMPLATE_PATH = path.join(ROOT_DIR, '.env.example');

const HTTP_HEALTH_TARGETS = [
  { name: 'Reverse proxy', envPort: 'REVERSE_PROXY_PORT', defaultPort: 8088, path: '/healthz', requiresToken: true },
  { name: 'Control plane (via reverse proxy)', envPort: 'REVERSE_PROXY_PORT', defaultPort: 8088, path: '/healthz', requiresToken: true }
];

const TROUBLESHOOTING_LINES = [
  'Missing API keys: re-run ./setup.sh without --noninteractive or edit .env directly.',
  'Queue naming errors: queue names should contain letters, numbers, or hyphens only.',
  'WhatsApp login stuck: docker compose logs wa-client and unlink previous device sessions.',
  'Port in use: adjust REVERSE_PROXY_PORT or CONTROL_PLANE_PORT inside .env, then rerun ./setup.sh --clean.',
  'Unexpected crashes: inspect docker compose logs <service> and node scripts/validate-config.js.'
];

const DEFAULT_REMOTE_AUTH_PHONE = 'REDACTED_PHONE_NUMBER';

const API_INTEGRATIONS = [
  {
    key: 'VT_API_KEY',
    flag: null,
    title: 'VirusTotal',
    importance: 'recommended',
    docs: 'Improves verdict accuracy for URL scanning.'
  },
  {
    key: 'GSB_API_KEY',
    flag: null,
    title: 'Google Safe Browsing',
    importance: 'recommended',
    docs: 'Adds Google Safe Browsing verdicts; ensure billing is enabled for production use.'
  },
  {
    key: 'URLSCAN_API_KEY',
    flag: 'URLSCAN_ENABLED',
    title: 'urlscan.io',
    importance: 'recommended',
    docs: 'Enables rich urlscan.io submissions; free tier allows ~50 scans/day.'
  },
  {
    key: 'WHOISXML_API_KEY',
    flag: 'WHOISXML_ENABLED',
    title: 'WhoisXML',
    importance: 'optional',
    docs: 'Enhances WHOIS context for suspicious domains.'
  },
  {
    key: 'PHISHTANK_APP_KEY',
    flag: null,
    title: 'PhishTank',
    importance: 'optional',
    docs: 'Contributes community phishing intelligence; currently rate-limited.'
  }
];

const SKIP_PREREQ_CHECKS = process.env.SETUP_SKIP_PREREQUISITES === '1';
const SKIP_DOCKER_CHECKS = process.env.SETUP_SKIP_DOCKER === '1';
const SKIP_PORT_CHECKS = process.env.SETUP_SKIP_PORT_CHECKS === '1';

async function ensureNodeVersion() {
  const [major] = process.versions.node.split('.').map(Number);
  if (Number.isFinite(major) && major < 18) {
    throw new Error('Node.js 18 or newer is required to run the setup wizard.');
  }
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Global fetch API not detected. Upgrade to Node.js 18+ or enable experimental-fetch.');
  }
}

async function showWelcome(context, output) {
  if (context.flags.noninteractive || !process.stdout.isTTY) {
    output.info('Running in non-interactive mode.');
    return;
  }
  const banner = boxen(
    [
      chalk.bold('WhatsApp Bot Scanner • Adaptive Setup'),
      '',
      'We will guide you through four phases:',
      '  1. Host readiness & repository checks',
      '  2. Environment configuration & integrations',
      '  3. Container build, launch, and checkpoints',
      '  4. Validation, pairing, and support artifacts',
      '',
      `Hotkeys: ${describeHotkeys()}`,
      ''
    ].join(os.EOL),
    { padding: { top: 1, bottom: 1, left: 2, right: 2 }, borderStyle: 'round', borderColor: 'cyan' }
  );
  console.log(banner);
  const confirm = await new Confirm({
    name: 'ready',
    message: 'Ready to begin the guided setup?',
    initial: true
  }).run();
  if (!confirm) {
    output.warn('Setup cancelled by user.');
    await context.finalize('cancelled');
    process.exit(0);
  }
  output.info('Guided mode active. Toggle verbosity anytime with hotkey "v".');
}

async function runPlanningFlow(context, output) {
  if (context.flags.noninteractive || !process.stdout.isTTY) return;
  const selections = await new MultiSelect({
    name: 'actions',
    message: 'Choose any prep steps to run before provisioning',
    hint: 'Space to toggle, Enter to confirm',
    limit: 5,
    choices: [
      { name: 'pull', message: 'Pull latest git commits and container images', value: 'pull', initial: true },
      { name: 'clean', message: 'Stop running containers from previous setup', value: 'clean', initial: true },
      { name: 'reset', message: 'Full reset (delete database + WhatsApp session)', value: 'reset', initial: false }
    ]
  }).run();
  context.flags.pull = selections.includes('pull');
  context.flags.clean = selections.includes('clean');
  context.flags.reset = selections.includes('reset');
  if (context.flags.reset) {
    context.flags.clean = true;
  }
  const branchToggle = await new Toggle({
    name: 'branchToggle',
    message: 'Checkout a specific git branch before continuing?',
    enabled: 'Yes',
    disabled: 'No',
    initial: Boolean(context.flags.branch)
  }).run();
  if (branchToggle) {
    const branchName = await new Input({
      name: 'branch',
      message: 'Enter branch name',
      initial: context.flags.branch,
      validate: value => (value.trim().length === 0 ? 'Branch name cannot be empty.' : true)
    }).run();
    context.flags.branch = branchName.trim();
  }
  output.heading('Plan Summary');
  output.info(`Pull latest code/images: ${context.flags.pull ? 'Yes' : 'No'}`);
  output.info(`Stop existing containers: ${context.flags.clean ? 'Yes' : 'No'}`);
  output.info(`Full reset (volumes): ${context.flags.reset ? 'Yes – destructive' : 'No'}`);
  output.info(`Target branch: ${context.flags.branch || 'Stay on current'}`);
  const proceed = await new Confirm({ name: 'proceed', message: 'Proceed with this plan?', initial: true }).run();
  if (!proceed) {
    output.warn('Setup cancelled before making changes.');
    await context.finalize('cancelled');
    process.exit(0);
  }
  context.recordDecision('plan', {
    pull: context.flags.pull,
    clean: context.flags.clean,
    reset: context.flags.reset,
    branch: context.flags.branch || 'current'
  });
}

function humanize(milliseconds) {
  return humanizeDuration(Math.max(1, Math.round(milliseconds)), { largest: 2, round: true });
}

async function runWithSpinner(context, label, task) {
  if (context.mode === 'expert') {
    context.log('task', { label });
    await task();
    return;
  }
  const spinner = ora({ text: label, color: 'cyan' }).start();
  const start = process.hrtime.bigint();
  try {
    await task();
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    spinner.succeed(`${label} (${humanize(duration)})`);
  } catch (error) {
    spinner.fail(`${label} failed`);
    throw error;
  }
}

async function ensureRepo(context, output) {
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

async function detectDockerCompose(context, runtime, output) {
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

async function preflightChecks(context, runtime, output) {
  output.heading('Preflight Checks');
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
  await detectDockerCompose(context, runtime, output);
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

async function checkoutBranch(context, runtime) {
  if (!context.flags.branch) return;
  await runWithSpinner(context, `git checkout ${context.flags.branch}`, () =>
    execa('git', ['checkout', context.flags.branch], { cwd: ROOT_DIR })
  );
}

async function pullUpdates(context, runtime, output) {
  if (!context.flags.pull) return;
  output.heading('Pulling latest updates');
  const gitPath = path.join(ROOT_DIR, '.git');
  try {
    await fs.access(gitPath);
    await runWithSpinner(context, 'git fetch', () =>
      execa('git', ['fetch', '--all', '--prune'], { cwd: ROOT_DIR })
    );
    await runWithSpinner(context, 'git pull', () =>
      execa('git', ['pull', '--ff-only'], { cwd: ROOT_DIR })
    );
  } catch {
    output.warn('Git repository not detected; skipping git pull.');
  }
  await runWithSpinner(context, 'docker compose pull', () =>
    execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'pull'], { cwd: ROOT_DIR })
  );
}

function generateHexSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateBase64Secret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64');
}

function cleanDigits(value) {
  return value ? value.replace(/\D+/g, '') : '';
}

function redact(value) {
  return redactPair('value', value).value;
}

function recordMissingKey(context, runtime, message) {
  runtime.missingKeys.push(message);
  context.log('missingKey', { message });
}

function recordDisabledFeature(context, runtime, message) {
  runtime.disabledFeatures.push(message);
  context.log('disabledFeature', { message });
}

function createPromptHelpers(context) {
  return {
    async confirm(options) {
      if (context.flags.noninteractive) return options.initial ?? false;
      return new Confirm(options).run();
    },
    async input(options) {
      if (context.flags.noninteractive) return options.initial ?? '';
      return new Input(options).run();
    },
    async toggle(options) {
      if (context.flags.noninteractive) return options.initial ?? false;
      return new Toggle(options).run();
    }
  };
}

async function runEnvironmentPlugins(context, runtime, output) {
  const available = pluginsForStage('environment', context);
  if (available.length === 0) return;
  output.heading('Advanced options');
  const prompt = createPromptHelpers(context);
  for (const plugin of available) {
    output.note(`Plugin: ${plugin.title} — ${plugin.description}`);
    if (typeof plugin.run === 'function') {
      await plugin.run({ context, runtime, output, prompt });
    }
  }
}

function createRecoveryManager(context, output) {
  return {
    displayQuickActions() {
      output.heading('Recovery Toolkit');
      output.info('Re-run preflight only → ./setup.sh --quick=preflight');
      output.info('Resume from Docker phase → ./setup.sh --quick=resume-docker');
      output.info('Purge setup caches → ./setup.sh --quick=purge-caches');
      context.log('recoveryHint', { action: 'displayed' });
    }
  };
}

async function purgeSetupCaches(context, output) {
  const cacheDir = path.join(ROOT_DIR, '.setup');
  const logsDir = path.join(ROOT_DIR, 'logs');
  await fs.rm(cacheDir, { recursive: true, force: true });
  let removedLogs = [];
  try {
    const files = await fs.readdir(logsDir);
    for (const file of files) {
      if (file.startsWith('setup-') && (file.endsWith('.md') || file.endsWith('.json'))) {
        await fs.rm(path.join(logsDir, file), { force: true });
        removedLogs.push(file);
      }
    }
  } catch {
    // ignore missing logs directory
  }
  output.success(`Cleared setup cache directory${removedLogs.length ? ` and removed ${removedLogs.length} transcript(s)` : ''}.`);
  context.log('purge', { cacheDir, removedLogs });
}

async function runConfigValidation(context, output) {
  const scriptPath = path.join(ROOT_DIR, 'scripts', 'validate-config.js');
  try {
    await fs.access(scriptPath);
  } catch {
    output.note('No scripts/validate-config.js found; skipping config validation.');
    return;
  }
  output.heading('Validating configuration');
  await runWithSpinner(context, 'node scripts/validate-config.js', () =>
    execa('node', [scriptPath], { cwd: ROOT_DIR, stdout: 'inherit', stderr: 'inherit' })
  );
}

async function verifyApiKeys(context, runtime, output) {
  output.heading('Validating API keys');
  await Promise.all([
    validateVirusTotal(context, runtime, output),
    validateGoogleSafeBrowsing(context, runtime, output),
    validateUrlscan(context, runtime, output),
    validateWhoisXml(context, runtime, output),
    notePhishTank(context, runtime, output)
  ]);
  await runtime.envFile.save();
  output.success('API key validation complete.');
}

async function validateVirusTotal(context, runtime, output) {
  const env = runtime.envFile;
  const key = env.get('VT_API_KEY');
  if (!key) {
    recordMissingKey(context, runtime, 'VirusTotal disabled without VT_API_KEY.');
    output.warn('VT_API_KEY not set. VirusTotal checks will be skipped.');
    return;
  }
  try {
    const res = await fetchWithTimeout('https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8', {
      headers: { 'x-apikey': key }
    });
    if (res.status === 200) {
      output.success('VirusTotal API key accepted.');
    } else if (res.status === 401 || res.status === 403) {
      throw new Error(`VirusTotal API key rejected (HTTP ${res.status}). Update VT_API_KEY and rerun.`);
    } else {
      output.warn(`VirusTotal validation returned HTTP ${res.status}. Check quota or network.`);
    }
  } catch (error) {
    output.warn(`VirusTotal validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateGoogleSafeBrowsing(context, runtime, output) {
  const env = runtime.envFile;
  const key = env.get('GSB_API_KEY');
  if (!key) {
    recordMissingKey(context, runtime, 'Google Safe Browsing disabled without GSB_API_KEY.');
    output.warn('GSB_API_KEY not set. Google Safe Browsing will be disabled.');
    return;
  }
  try {
    const res = await fetchWithTimeout(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'wbscanner-setup', clientVersion: '2.0' },
          threatInfo: {
            threatTypes: ['MALWARE'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url: 'https://example.com' }]
          }
        })
      }
    );
    if (res.status === 200) {
      output.success('Google Safe Browsing API key accepted.');
    } else if ([400, 401, 403].includes(res.status)) {
      const body = await res.text();
      throw new Error(`GSB API key rejected (HTTP ${res.status}). Response: ${body.slice(0, 120)}`);
    } else {
      output.warn(`GSB validation returned HTTP ${res.status}. Check billing or quota.`);
    }
  } catch (error) {
    output.warn(`GSB validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateUrlscan(context, runtime, output) {
  const env = runtime.envFile;
  const enabled = (env.get('URLSCAN_ENABLED') || 'false').toLowerCase() === 'true';
  const key = env.get('URLSCAN_API_KEY');
  if (!enabled) return;
  if (!key) {
    env.set('URLSCAN_ENABLED', 'false');
    recordDisabledFeature(context, runtime, 'urlscan.io disabled until API key provided.');
    recordMissingKey(context, runtime, 'urlscan.io deep scans unavailable without URLSCAN_API_KEY.');
    return;
  }
  try {
    const res = await fetchWithTimeout('https://urlscan.io/user/quotas', {
      headers: { 'API-Key': key }
    });
    if (res.status === 200) {
      output.success('urlscan.io API key accepted.');
    } else if (res.status === 401 || res.status === 403) {
      env.set('URLSCAN_ENABLED', 'false');
      env.set('URLSCAN_CALLBACK_SECRET', '');
      recordDisabledFeature(context, runtime, 'urlscan.io disabled: API key rejected.');
      recordMissingKey(context, runtime, 'urlscan.io unavailable until a valid key is provided.');
    } else {
      output.warn(`urlscan.io validation returned HTTP ${res.status}.`);
    }
  } catch (error) {
    output.warn(`urlscan.io validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateWhoisXml(context, runtime, output) {
  const env = runtime.envFile;
  const enabled = (env.get('WHOISXML_ENABLED') || 'false').toLowerCase() === 'true';
  const key = env.get('WHOISXML_API_KEY');
  if (!enabled || !key) return;
  try {
    const res = await fetchWithTimeout(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${key}&domainName=example.com&outputFormat=JSON`
    );
    if (res.status === 200) {
      const body = await res.text();
      if (/ErrorMessage/i.test(body)) {
        output.warn('WhoisXML responded with an error message; check quota.');
      } else {
        output.success('WhoisXML API key accepted.');
      }
    } else if (res.status === 401 || res.status === 403) {
      env.set('WHOISXML_ENABLED', 'false');
      recordDisabledFeature(context, runtime, 'WhoisXML disabled: API key rejected.');
    } else {
      output.warn(`WhoisXML validation returned HTTP ${res.status}.`);
    }
  } catch (error) {
    output.warn(`WhoisXML validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function notePhishTank(context, runtime, output) {
  const env = runtime.envFile;
  const phishKey = env.get('PHISHTANK_APP_KEY');
  if (phishKey) {
    output.info('PhishTank key present; API currently rate-limited—perform manual verification later.');
  } else {
    output.warn('PhishTank APP key missing (registration currently limited); continuing without it.');
  }
}

async function configureSecrets(context, runtime, output) {
  const env = runtime.envFile;
  const ensure = (key, generator) => {
    if (!env.get(key)) {
      env.set(key, generator());
      context.recordDecision(`secret:${key}`, 'generated');
    }
  };
  ensure('JWT_SECRET', generateHexSecret);
  ensure('SESSION_SECRET', () => generateBase64Secret(48));
  ensure('CONTROL_PLANE_API_TOKEN', generateHexSecret);
  ensure('WA_REMOTE_AUTH_SHARED_SECRET', generateHexSecret);
  output.success('Core secrets present.');
}

async function promptForApiKeys(context, runtime, output) {
  if (context.flags.noninteractive) {
    output.warn('Skipping interactive API key prompts (--noninteractive).');
    return;
  }
  const env = runtime.envFile;
  const vtInfo = API_INTEGRATIONS.find(item => item.key === 'VT_API_KEY');
  if (vtInfo) {
    output.note(`VirusTotal: ${vtInfo.docs}`);
  }
  const vt = await new Input({
    name: 'vt',
    message: 'VirusTotal API key (leave blank to skip)',
    initial: env.get('VT_API_KEY')
  }).run();
  if (vt) {
    env.set('VT_API_KEY', vt);
    output.info('VirusTotal API key stored (redacted).');
    context.recordDecision('vt.apiKeyProvided', true);
  }
  const gsbInfo = API_INTEGRATIONS.find(item => item.key === 'GSB_API_KEY');
  if (gsbInfo) {
    output.note(`Google Safe Browsing: ${gsbInfo.docs}`);
  }
  const gsb = await new Input({
    name: 'gsb',
    message: 'Google Safe Browsing API key (leave blank to skip)',
    initial: env.get('GSB_API_KEY')
  }).run();
  if (gsb) {
    env.set('GSB_API_KEY', gsb);
    context.recordDecision('gsb.apiKeyProvided', true);
  }
}

async function configureRemoteAuth(context, runtime, output) {
  const env = runtime.envFile;
  const strategy = (env.get('WA_AUTH_STRATEGY') || 'remote').toLowerCase();
  if (strategy !== 'remote' || context.flags.noninteractive) {
    output.info(`WhatsApp auth strategy: ${strategy}`);
    return;
  }
  output.heading('WhatsApp Remote Auth');
  const phoneInitial = env.get('WA_REMOTE_AUTH_PHONE_NUMBER') || DEFAULT_REMOTE_AUTH_PHONE;
  const phoneDigits = await new Input({
    name: 'phone',
    message: 'Phone number for pairing SMS (international format)',
    initial: phoneInitial,
    validate: value => {
      const digits = cleanDigits(value);
      if (digits.length < 10) return 'Enter a valid international number.';
      return true;
    }
  }).run();
  env.set('WA_REMOTE_AUTH_PHONE_NUMBER', phoneDigits);
  const autopair = await new Confirm({
    name: 'autopair',
    message: 'Automatically request phone-number code on stack start?',
    initial: (env.get('WA_REMOTE_AUTH_AUTO_PAIR') || 'true').toLowerCase() === 'true'
  }).run();
  env.set('WA_REMOTE_AUTH_AUTO_PAIR', autopair ? 'true' : 'false');
  output.info(`Remote auth auto pairing: ${autopair ? 'enabled' : 'disabled'}`);
  context.recordDecision('remoteAuth.autoPair', autopair);
}

async function validateQueueNames(context, runtime) {
  const env = runtime.envFile;
  const queues = ['SCAN_REQUEST_QUEUE', 'SCAN_VERDICT_QUEUE', 'SCAN_URLSCAN_QUEUE'];
  for (const key of queues) {
    const value = env.get(key);
    if (!value) throw new Error(`${key} cannot be empty.`);
    if (value.includes(':')) throw new Error(`${key} contains ':' (${value}). Use hyphen-separated names instead.`);
  }
  context.log('queueValidation', { status: 'ok' });
}

async function checkPorts(context, output) {
  if (SKIP_PORT_CHECKS) {
    output.warn('Skipping port collision scan (SETUP_SKIP_PORT_CHECKS=1).');
    return;
  }
  const collisions = [];
  for (const { port, label, envHint } of PORT_CHECKS) {
    if (await isPortInUse(port)) {
      collisions.push({ port, label, envHint });
    }
  }
  if (collisions.length > 0) {
    output.warn('Port conflicts detected:');
    for (const collision of collisions) {
      output.warn(`Port ${collision.port} (${collision.label}) already in use.`);
      if (collision.envHint) {
        output.info(`Update ${collision.envHint} in .env and rerun setup.`);
      }
    }
    if (!context.flags.noninteractive) {
      await new Confirm({
        name: 'continue',
        message: 'Continue despite port conflicts?',
        initial: false
      }).run();
    }
  } else {
    output.success('No blocking port collisions detected.');
  }
}

async function isPortInUse(port) {
  try {
    await execa('lsof', [`-iTCP:${port}`, '-sTCP:LISTEN'], { stdio: 'ignore' });
    return true;
  } catch {
    try {
      const { stdout } = await execa('ss', ['-tulpn'], { stdio: 'pipe' });
      if (stdout.includes(`:${port} `)) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return await new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function cleanUpStack(context, runtime, output) {
  if (context.flags.reset) {
    output.heading('Reset Requested');
    output.warn('Reset will delete Postgres data and the WhatsApp session volume.');
    if (!context.flags.noninteractive) {
      const confirm = await new Confirm({
        name: 'confirmReset',
        message: 'Proceed with destructive reset (DB + WhatsApp session will be deleted)?',
        initial: false
      }).run();
      if (!confirm) {
        context.flags.reset = false;
        output.warn('Reset aborted by user.');
        return;
      }
    }
    await runWithSpinner(context, 'docker compose down -v --remove-orphans', () =>
      execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'down', '-v', '--remove-orphans'], { cwd: ROOT_DIR })
    );
    return;
  }
  if (context.flags.clean) {
    output.heading('Stopping existing stack');
    await runWithSpinner(context, 'docker compose down', () =>
      execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'down'], { cwd: ROOT_DIR })
    );
  }
}

async function buildAndLaunch(context, runtime, output) {
  if (context.flags.dryRun) {
    output.info('Dry run requested: skipping Docker build and launch.');
    return;
  }
  output.heading('Building containers');
  await runWithSpinner(context, 'make build', () =>
    execa('make', ['build'], { cwd: ROOT_DIR, stdio: 'inherit' })
  );
  output.heading('Resetting Docker stack');
  await runWithSpinner(context, 'Stopping existing stack', () =>
    execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'down', '--remove-orphans'], { cwd: ROOT_DIR })
  );
  await runWithSpinner(context, 'Pruning stopped containers', () =>
    execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'rm', '-f'], { cwd: ROOT_DIR })
  );
  output.heading('Preparing WhatsApp session storage');
  await runWithSpinner(context, 'Aligning wa-client session volume', () =>
    execa(
      runtime.dockerComposeCommand[0],
      [...runtime.dockerComposeCommand.slice(1), 'run', '--rm', '--no-deps', '--user', 'root', '--entrypoint', '/bin/sh', 'wa-client', '-c', 'mkdir -p /app/services/wa-client/data/session && chown -R pptruser:pptruser /app/services/wa-client/data'],
      { cwd: ROOT_DIR, stdio: 'inherit' }
    )
  );
  output.heading('Starting stack');
  try {
    await runWithSpinner(context, 'make up', () =>
      execa('make', ['up'], { cwd: ROOT_DIR, stdio: 'inherit' })
    );
  } catch (error) {
    output.warn(`make up failed (exit ${error.exitCode}); retrying with docker compose up -d.`);
    await runWithSpinner(context, 'docker compose up -d', () =>
      execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'up', '-d'], { cwd: ROOT_DIR, stdio: 'inherit' })
    );
  }
}

async function waitForContainerHealth(context, runtime, service, label) {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { stdout } = await execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'ps', '-q', service], { cwd: ROOT_DIR });
    const containerId = stdout.trim();
    if (!containerId) {
      await sleep(2000);
      continue;
    }
    try {
      const { stdout: inspect } = await execa('docker', ['inspect', '-f', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', containerId]);
      const status = inspect.trim();
      if (status === 'healthy' || status === 'running') {
        context.log('serviceReady', { service, status, attempt });
        return;
      }
      if (status === 'unhealthy') {
        throw new Error(`${label} container reported unhealthy. See: docker compose logs ${service}`);
      }
    } catch {
      // ignore
    }
    await sleep(5000);
  }
  throw new Error(`${label} container did not reach healthy state. Investigate with docker compose ps ${service}.`);
}

async function waitForFoundations(context, runtime, output) {
  if (context.flags.dryRun) return;
  output.heading('Waiting for core services');
  for (const { service, label } of WAIT_FOR_SERVICES) {
    await waitForContainerHealth(context, runtime, service, label);
    if (context.mode === 'guided') {
      output.success(`${label} container ready.`);
    }
  }
}

async function tailWhatsappLogs(context, runtime, output) {
  if (context.flags.noninteractive || context.flags.dryRun) {
    output.warn('Skipping WhatsApp log tail (--noninteractive or --dry-run).');
    return;
  }
  output.heading('WhatsApp Pairing');
  const strategy = (runtime.envFile.get('WA_AUTH_STRATEGY') || 'remote').toLowerCase();
  const phone = cleanDigits(runtime.envFile.get('WA_REMOTE_AUTH_PHONE_NUMBER'));
  const autoPair = (runtime.envFile.get('WA_REMOTE_AUTH_AUTO_PAIR') || '').toLowerCase() === 'true';
  if (strategy === 'remote' && phone && autoPair) {
    output.info(`Watching for phone-number pairing code targeting ${redact(phone)}.`);
  } else {
    output.info('A QR code will appear below for manual pairing.');
  }
  await new Promise((resolve) => {
    const tail = spawn(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'logs', '--no-color', '--follow', 'wa-client'], {
      cwd: ROOT_DIR,
      stdio: ['inherit', 'pipe', 'inherit']
    });
    tail.stdout.on('data', chunk => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes('WhatsApp client ready')) {
        tail.kill('SIGINT');
        resolve();
      }
    });
    tail.on('error', () => resolve());
    tail.on('close', () => resolve());
  });
}

async function waitForWhatsappReady(context, runtime) {
  if (context.flags.noninteractive || context.flags.dryRun) return;
  await waitForContainerHealth(context, runtime, 'wa-client', 'WhatsApp client');
}

async function waitForReverseProxy(context, runtime, output) {
  if (context.flags.dryRun) return;
  const token = runtime.envFile.get('CONTROL_PLANE_API_TOKEN');
  if (!token) {
    output.warn('Missing CONTROL_PLANE_API_TOKEN; skipping reverse proxy health checks.');
    return;
  }
  for (const target of HTTP_HEALTH_TARGETS) {
    const port = runtime.envFile.get(target.envPort) || String(target.defaultPort);
    const url = `http://127.0.0.1:${port}${target.path}`;
    await waitForHttp(context, target.name, url, target.requiresToken ? { Authorization: `Bearer ${token}` } : undefined);
  }
}

async function waitForHttp(context, name, url, headers = {}) {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, { headers });
      if (res.ok) {
        context.log('httpHealth', { name, url, attempt });
        return;
      }
    } catch {
      // ignore
    }
    await sleep(5000);
  }
  throw new Error(`${name} did not become healthy at ${url}. Inspect docker compose logs.`);
}

async function smokeTest(context, runtime, output) {
  if (context.flags.dryRun) return;
  output.heading('Smoke Test');
  const token = runtime.envFile.get('CONTROL_PLANE_API_TOKEN');
  if (!token) {
    output.warn('Control plane token missing; cannot run authenticated smoke test.');
    return;
  }
  const reversePort = runtime.envFile.get('REVERSE_PROXY_PORT') || '8088';
  try {
    const res = await fetchWithTimeout(`http://localhost:${reversePort}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      output.success('Control-plane status endpoint reachable.');
    } else {
      output.warn(`Control-plane status check returned HTTP ${res.status}.`);
    }
  } catch {
    output.warn('Control-plane status check failed; verify docker compose logs.');
  }
}

async function offerPairingWatcher(context, output) {
  if (context.flags.noninteractive || context.flags.dryRun) return;
  if ((context.runtime.envFile.get('WA_AUTH_STRATEGY') || 'remote').toLowerCase() !== 'remote') return;
  if ((context.runtime.envFile.get('WA_REMOTE_AUTH_AUTO_PAIR') || '').toLowerCase() !== 'true') {
    output.info('Need audio cues later? Run npm run watch:pairing-code for audible alerts.');
    return;
  }
  if (!(await commandExists('node'))) {
    output.warn('Node.js not detected; cannot launch pairing watcher automatically.');
    return;
  }
  const startWatcher = await new Confirm({
    name: 'watcher',
    message: 'Start the pairing code watcher (plays audio when code arrives)?',
    initial: true
  }).run();
  if (startWatcher) {
    output.info('Press Ctrl+C when you are done listening for codes.');
    try {
      await execa('npm', ['run', '--silent', 'watch:pairing-code'], { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch {
      output.warn('Pairing watcher exited unexpectedly. You can run npm run watch:pairing-code again later.');
    }
  }
}

async function commandExists(command) {
  try {
    await execa('command', ['-v', command], { shell: true, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function registerPhases(context, runtime, output) {
  clearPhases();
  registerPhase({
    id: 'preflight',
    title: 'Preflight checks',
    run: async (ctx) => {
      await ensureRepo(ctx, output);
      await preflightChecks(ctx, runtime, output);
      await checkoutBranch(ctx, runtime);
      await pullUpdates(ctx, runtime, output);
    }
  });
  registerPhase({
    id: 'cleanup',
    title: 'Clean up previous runs',
    run: async (ctx) => {
      await cleanUpStack(ctx, runtime, output);
    }
  });
  registerPhase({
    id: 'environment',
    title: 'Configure environment',
    run: async (ctx) => {
      await runtime.envFile.ensure();
      await configureSecrets(ctx, runtime, output);
      await promptForApiKeys(ctx, runtime, output);
      await configureRemoteAuth(ctx, runtime, output);
      await runEnvironmentPlugins(ctx, runtime, output);
      await validateQueueNames(ctx, runtime);
      await checkPorts(ctx, output);
      await runtime.envFile.save();
    }
  });
  registerPhase({
    id: 'config-validation',
    title: 'Validate configuration',
    run: async (ctx) => {
      await runConfigValidation(ctx, output);
    }
  });
  registerPhase({
    id: 'api-validation',
    title: 'Validate API integrations',
    run: async (ctx) => {
      await verifyApiKeys(ctx, runtime, output);
    }
  });
  registerPhase({
    id: 'docker',
    title: 'Build & launch Docker stack',
    run: async (ctx) => {
      await buildAndLaunch(ctx, runtime, output);
    }
  });
  registerPhase({
    id: 'stabilize',
    title: 'Wait for services',
    run: async (ctx) => {
      await waitForFoundations(ctx, runtime, output);
      await tailWhatsappLogs(ctx, runtime, output);
      await waitForWhatsappReady(ctx, runtime);
      await waitForReverseProxy(ctx, runtime, output);
    }
  });
  registerPhase({
    id: 'smoke',
    title: 'Smoke test and observability',
    run: async (ctx) => {
      await smokeTest(ctx, runtime, output);
      output.heading('Observability & Access');
      const reversePort = runtime.envFile.get('REVERSE_PROXY_PORT') || '8088';
      output.info(`Reverse proxy: http://localhost:${reversePort}`);
      output.info(`Control plane UI: http://localhost:${reversePort}/`);
      output.info('Grafana: http://localhost:3002 (admin / admin)');
      output.info('Prometheus: inside docker network at prometheus:9090');
      const token = runtime.envFile.get('CONTROL_PLANE_API_TOKEN');
      if (token) {
        output.info(`Control plane token (redacted): ${redact(token)}`);
      }
      output.warn('Harden services (TLS + IP restrictions) before exposing beyond localhost.');
      if (runtime.missingKeys.length > 0) {
        output.heading('Pending API Keys');
        for (const item of runtime.missingKeys) {
          output.warn(item);
        }
      }
      if (runtime.disabledFeatures.length > 0) {
        output.heading('Disabled Integrations');
        for (const item of runtime.disabledFeatures) {
          output.warn(item);
        }
      }
      output.heading('Troubleshooting Tips');
      for (const line of TROUBLESHOOTING_LINES) {
        output.info(line);
      }
      await offerPairingWatcher(ctx, output);
    }
  });
}

export async function runSetup(argv = process.argv.slice(2)) {
  await ensureNodeVersion();
  const context = new SetupContext(ROOT_DIR);
  await context.initialize();
  const flags = parseFlags(argv);
  context.flags = flags;
  if (flags.mode) {
    context.setMode(flags.mode, { reason: 'flag' });
  }
  const output = createOutput(context);

  const runtime = {
    envFile: new EnvFile(ENV_PATH, ENV_TEMPLATE_PATH),
    dockerComposeCommand: ['docker', 'compose'],
    missingKeys: [],
    disabledFeatures: [],
    generateHexSecret,
    generateBase64Secret
  };
  context.runtime = runtime;

  if (flags.quick === 'purge-caches') {
    await purgeSetupCaches(context, output);
    await context.finalize('success');
    return;
  }
  if (flags.quick === 'preflight') {
    flags.stopAfter = 'preflight';
    output.info('Quick action: running preflight checks only.');
    context.recordDecision('quickAction', 'preflight');
  } else if (flags.quick === 'resume-docker') {
    if (!flags.resume) {
      flags.resume = 'docker';
    }
    output.info('Quick action: resuming from Docker launch checkpoint.');
    context.recordDecision('quickAction', 'resume-docker');
  }

  if (!flags.quick) {
    await showWelcome(context, output);
  } else {
    output.note('Quick action bypassed welcome banner.');
  }
  if (!flags.quick) {
    await runPlanningFlow(context, output);
  } else {
    output.note('Skipping planning wizard because a quick action was requested.');
  }
  clearPlugins();
  registerBuiltinPlugins();
  registerPhases(context, runtime, output);

  const recovery = createRecoveryManager(context, output);
  const cleanupHotkeys = registerHotkeys(context, output, recovery);
  try {
    await runPhases(context, { startAt: flags.resume ?? undefined, stopAfter: flags.stopAfter ?? undefined });
    output.success('Setup complete. Re-run ./setup.sh anytime; operations are idempotent.');
    await context.finalize('success');
  } catch (error) {
    context.appendError(error);
    output.error(error.message || 'Setup halted due to an unexpected error.');
    context.setResumeHint(context.currentPhase?.id);
    await context.finalize('failed');
    process.exitCode = 1;
  } finally {
    cleanupHotkeys();
  }
}
