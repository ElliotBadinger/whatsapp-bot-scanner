#!/usr/bin/env node

/**
 * WhatsApp Bot Scanner – Guided Setup Wizard
 *
 * Node-based orchestration that replaces the legacy bash-heavy flow.
 * Provides an accessible, high-contrast interactive experience for operators.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import boxen from 'boxen';
import chalk from 'chalk';
import enquirer from 'enquirer';
import humanizeDuration from 'humanize-duration';
import logSymbols from 'log-symbols';
import ora from 'ora';
import { Listr } from 'listr2';
import { execa } from 'execa';

const { Confirm, Toggle, MultiSelect, Input } = enquirer;

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(SCRIPT_PATH), '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const ENV_TEMPLATE_PATH = path.join(ROOT_DIR, '.env.example');

const DOCKER_COMPOSE_FALLBACK = ['docker-compose'];

const DEFAULT_REMOTE_AUTH_PHONE = 'REDACTED_PHONE_NUMBER';

const REQUIRED_COMMANDS = [
  { name: 'docker', hint: 'Install instructions: https://docs.docker.com/engine/install/' },
  { name: 'make', hint: 'Install via your package manager (e.g. `brew install make` or `sudo apt install make`).' },
  { name: 'curl', hint: 'Install via https://curl.se/download.html' },
  { name: 'sed', hint: 'Install via GNU sed package.' },
  { name: 'awk', hint: 'Install via GNU awk (`gawk`).' },
  { name: 'openssl', hint: 'Install via OpenSSL binary package.' }
];

const API_INTEGRATIONS = [
  {
    key: 'VT_API_KEY',
    flag: null,
    title: 'VirusTotal',
    importance: 'recommended',
    steps: [
      'Sign in or create an account at https://www.virustotal.com/gui/join-us.',
      'Open your avatar menu → API key.',
      'Copy the 64-character token.'
    ],
    docs: 'Improves verdict accuracy for URL scanning.'
  },
  {
    key: 'GSB_API_KEY',
    flag: null,
    title: 'Google Safe Browsing',
    importance: 'recommended',
    steps: [
      'In Google Cloud Console, create/select a project.',
      'Enable the “Safe Browsing API”.',
      'Create credentials → API key.'
    ],
    docs: 'Adds Google Safe Browsing verdicts; ensure billing is enabled for production use.'
  },
  {
    key: 'URLSCAN_API_KEY',
    flag: 'URLSCAN_ENABLED',
    title: 'urlscan.io',
    importance: 'recommended',
    steps: [
      'Create an account at https://urlscan.io/signup/.',
      'Visit https://urlscan.io/user/api and copy your API key.'
    ],
    docs: 'Enables rich urlscan.io submissions; free tier allows ~50 scans/day.'
  },
  {
    key: 'WHOISXML_API_KEY',
    flag: 'WHOISXML_ENABLED',
    title: 'WhoisXML (optional)',
    importance: 'optional',
    steps: [
      'Register at https://user.whoisxmlapi.com/identity/register.',
      'Open https://user.whoisxmlapi.com/api-key-management and copy the API key.'
    ],
    docs: 'Enhances WHOIS context for suspicious domains.'
  },
  {
    key: 'PHISHTANK_APP_KEY',
    flag: null,
    title: 'PhishTank (optional)',
    importance: 'optional',
    steps: [
      'Register at https://www.phishtank.com/register.php (when registration is open).',
      'Find the APP key on https://www.phishtank.com/api_info.php.'
    ],
    docs: 'Contributes community phishing intelligence; currently rate-limited.'
  }
];

const PORT_CHECKS = [
  { port: 8088, label: 'Reverse proxy', envHint: 'REVERSE_PROXY_PORT' },
  { port: 8080, label: 'Control plane', envHint: 'CONTROL_PLANE_PORT' },
  { port: 3002, label: 'Grafana', envHint: 'GRAFANA_PORT' },
  { port: 3000, label: 'WA client (internal)', envHint: null }
];

const WAIT_FOR = [
  { service: 'postgres', label: 'Postgres' },
  { service: 'redis', label: 'Redis' },
  { service: 'scan-orchestrator', label: 'Scan orchestrator' },
  { service: 'control-plane', label: 'Control plane' }
];

const HTTP_HEALTH_TARGETS = [
  {
    name: 'Reverse proxy',
    envPort: 'REVERSE_PROXY_PORT',
    defaultPort: 8088,
    path: '/healthz',
    requiresToken: true
  },
  {
    name: 'Control plane (via reverse proxy)',
    envPort: 'REVERSE_PROXY_PORT',
    defaultPort: 8088,
    path: '/healthz',
    requiresToken: true
  }
];

const TROUBLESHOOTING_LINES = [
  'Missing API keys: re-run `./setup.sh` without `--noninteractive` or edit `.env` directly.',
  'Queue naming errors: queue names should contain letters, numbers, or hyphens only.',
  'WhatsApp login stuck: `docker compose logs wa-client` and unlink previous device sessions.',
  'Port in use: adjust `REVERSE_PROXY_PORT` or `CONTROL_PLANE_PORT` inside `.env`, then rerun `./setup.sh --clean`.',
  'Unexpected crashes: inspect `docker compose logs <service>` and `node scripts/validate-config.js`.',
  'Reset everything: `./setup.sh --reset` (wipes DB + WhatsApp session) followed by a fresh run.'
];

const MISSING_KEYS = [];
const DISABLED_FEATURES = [];

const CLI_FLAGS = {
  clean: false,
  reset: false,
  noninteractive: false,
  pull: false,
  branch: '',
  fromTarball: '',
  dryRun: false,
  skipPreflight: false,
  skipApiValidation: false
};

let dockerComposeCommand = ['docker', 'compose'];
let stackWasStopped = false;

const envEntries = [];
let envLoaded = false;

function isTTY() {
  return process.stdout.isTTY && !process.env.CI;
}

function formatHeading(text) {
  return chalk.cyan.bold(`\n==> ${text}\n`);
}

function logInfo(message) {
  console.log(`${logSymbols.info} ${message}`);
}

function logWarn(message) {
  console.log(`${logSymbols.warning} ${chalk.yellow(message)}`);
}

function logSuccess(message) {
  console.log(`${logSymbols.success} ${chalk.green(message)}`);
}

function logError(message) {
  console.error(`${logSymbols.error} ${chalk.red(message)}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg === '--clean') CLI_FLAGS.clean = true;
    else if (arg === '--reset') CLI_FLAGS.reset = true;
    else if (arg === '--noninteractive') CLI_FLAGS.noninteractive = true;
    else if (arg === '--pull') CLI_FLAGS.pull = true;
    else if (arg.startsWith('--branch=')) CLI_FLAGS.branch = arg.split('=')[1];
    else if (arg.startsWith('--from=')) CLI_FLAGS.fromTarball = arg.split('=')[1];
    else if (arg === '--dry-run') CLI_FLAGS.dryRun = true;
    else if (arg === '--skip-preflight') CLI_FLAGS.skipPreflight = true;
    else if (arg === '--skip-api-validation') CLI_FLAGS.skipApiValidation = true;
    else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      logError(`Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (process.env.SETUP_NONINTERACTIVE === '1' || process.env.CI === 'true') {
    CLI_FLAGS.noninteractive = true;
  }
}

function printHelp() {
  console.log(`Usage: ./setup.sh [options]

Options:
  --clean             Stop existing stack before setup.
  --reset             Stop stack and remove volumes (DESTROYS DB + WhatsApp session).
  --noninteractive    Run without prompts; leaves placeholders and disables optional integrations.
  --pull              Pull latest git commits and container images.
  --branch=<name>     Checkout the specified git branch before running.
  --from=<tarball>    Use a local project tarball (air-gapped installs).
  --dry-run           Run preflight + planning only; skip Docker build/run.
  --skip-preflight     Bypass host prerequisite checks (useful for CI with limited tooling).
  --skip-api-validation Skip outbound API validation calls.
  -h, --help          Show this message.

Environment flags:
  SETUP_NONINTERACTIVE=1  Force non-interactive mode.
  CI=true                 Implies --noninteractive.
`);
}

async function ensureNodeVersion() {
  const [major] = process.versions.node.split('.').map(Number);
  if (Number.isFinite(major) && major < 18) {
    logError('Node.js 18 or newer is required to run the setup wizard.');
    process.exit(1);
  }
  if (typeof globalThis.fetch !== 'function') {
    logError('Global fetch API not detected. Upgrade to Node.js 18+ or enable experimental-fetch.');
    process.exit(1);
  }
}

async function welcome() {
  if (CLI_FLAGS.noninteractive || !isTTY()) {
    logInfo('Running in non-interactive mode.');
    return;
  }
  const box = boxen(
    [
      chalk.bold('WhatsApp Bot Scanner • Guided Setup'),
      '',
      'We will walk through 4 phases:',
      '  1. Check your tools and repo state',
      '  2. Configure environment + API keys',
      '  3. Build and launch Docker stack',
      '  4. Confirm WhatsApp pairing & next steps',
      '',
      'Estimated duration: ~8–12 minutes (downloads may vary)',
      'You can cancel anytime with Ctrl+C; changes will be saved up to that point.'
    ].join('\n'),
    {
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  );
  console.log(box);
  const confirm = await new Confirm({
    name: 'ready',
    message: 'Ready to begin the guided setup?'
  }).run();
  if (!confirm) {
    logWarn('Setup cancelled by user.');
    process.exit(0);
  }
}

async function planWizard() {
  if (CLI_FLAGS.noninteractive || !isTTY()) {
    return;
  }

  const selections = await new MultiSelect({
    name: 'actions',
    message: 'Choose any prep steps you would like us to handle before provisioning',
    hint: 'Space to toggle, Enter to confirm',
    limit: 5,
    choices: [
      { name: 'pull', message: 'Pull latest git commits and container images', value: 'pull', initial: true },
      { name: 'clean', message: 'Stop running containers from previous setup', value: 'clean', initial: true },
      { name: 'reset', message: 'Full reset (delete database + WhatsApp session)', value: 'reset', initial: false }
    ]
  }).run();

  CLI_FLAGS.pull = selections.includes('pull');
  CLI_FLAGS.clean = selections.includes('clean');
  CLI_FLAGS.reset = selections.includes('reset');
  if (CLI_FLAGS.reset) {
    CLI_FLAGS.clean = true;
  }

  const branchQuestion = await new Toggle({
    name: 'branchToggle',
    message: 'Do you want to checkout a specific git branch before continuing?',
    enabled: 'Yes',
    disabled: 'No',
    initial: false
  }).run();

  if (branchQuestion) {
    const branchName = await new Input({
      name: 'branch',
      message: 'Enter branch name',
      validate: value => value.trim().length === 0 ? 'Branch name cannot be empty.' : true
    }).run();
    CLI_FLAGS.branch = branchName.trim();
  }

  console.log(formatHeading('Plan Summary'));
  console.log(`• Pull latest code/images: ${CLI_FLAGS.pull ? chalk.green('Yes') : chalk.gray('No')}`);
  console.log(`• Stop existing containers: ${CLI_FLAGS.clean ? chalk.green('Yes') : chalk.gray('No')}`);
  console.log(`• Full reset (remove volumes): ${CLI_FLAGS.reset ? chalk.yellow('Yes – destructive') : chalk.gray('No')}`);
  console.log(`• Target branch: ${CLI_FLAGS.branch ? chalk.green(CLI_FLAGS.branch) : chalk.gray('Stay on current')}`);
  console.log('');
  const proceed = await new Confirm({ name: 'go', message: 'Proceed with this plan?' }).run();
  if (!proceed) {
    logWarn('Setup cancelled before making changes.');
    process.exit(0);
  }
}

async function ensureRepo() {
  if (CLI_FLAGS.fromTarball) {
    const tarballPath = path.resolve(process.cwd(), CLI_FLAGS.fromTarball);
    try {
      await fs.access(tarballPath);
    } catch {
      throw new Error(`Tarball ${CLI_FLAGS.fromTarball} not found.`);
    }

    const contents = await fs.readdir(ROOT_DIR);
    if (contents.length > 1) {
      logWarn('Repository directory is not empty; skipping tarball extraction.');
    } else {
      await runWithSpinner('Extracting project tarball', () =>
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

async function detectDockerCompose() {
  try {
    await execa('docker', ['compose', 'version'], { stdio: 'ignore' });
    dockerComposeCommand = ['docker', 'compose'];
  } catch {
    try {
      await execa('docker-compose', ['version'], { stdio: 'ignore' });
      dockerComposeCommand = [...DOCKER_COMPOSE_FALLBACK];
      logWarn('Using legacy docker-compose binary. Consider upgrading to Docker Compose v2.');
    } catch {
      throw new Error('Docker Compose v2 not detected. Install via https://docs.docker.com/compose/install/.');
    }
  }
}

async function preflightChecks() {
  if (CLI_FLAGS.skipPreflight) {
    logWarn('Skipping preflight checks (--skip-preflight provided). Docker requirements were not verified.');
    return;
  }
  console.log(formatHeading('Preflight Checks'));
  for (const cmd of REQUIRED_COMMANDS) {
    try {
      await execa('command', ['-v', cmd.name], { stdio: 'ignore', shell: true });
    } catch {
      throw new Error(`Missing required command: ${cmd.name}\nInstall hint: ${cmd.hint}`);
    }
  }
  await detectDockerCompose();

  try {
    await execa(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'version'], { stdio: 'ignore' });
  } catch {
    throw new Error('Docker Compose not responding. Ensure Docker Desktop or the daemon is running.');
  }

  try {
    await execa('docker', ['info'], { stdio: 'ignore' });
  } catch {
    throw new Error('Docker daemon unavailable. Start Docker and retry.');
  }

  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    logInfo('Proxy settings detected. Docker builds inherit HTTP(S)_PROXY automatically if configured.');
  }

  logSuccess('Environment checks passed.');
}

async function checkoutBranch() {
  if (!CLI_FLAGS.branch) return;
  console.log(formatHeading(`Checking out branch ${CLI_FLAGS.branch}`));
  if (!(await pathExists(path.join(ROOT_DIR, '.git')))) {
    throw new Error('--branch requires a git repository.');
  }
  await runWithSpinner('git fetch', () => execa('git', ['fetch', '--all', '--prune'], { cwd: ROOT_DIR }));
  await runWithSpinner(`git checkout ${CLI_FLAGS.branch}`, () =>
    execa('git', ['checkout', CLI_FLAGS.branch], { cwd: ROOT_DIR })
  );
}

async function pullUpdates() {
  if (!CLI_FLAGS.pull) return;
  console.log(formatHeading('Pulling latest updates'));
  if (await pathExists(path.join(ROOT_DIR, '.git'))) {
    await runWithSpinner('git pull', () =>
      execa('git', ['pull', '--ff-only'], { cwd: ROOT_DIR })
    );
  }
  await runWithSpinner('docker compose pull', () =>
    execa(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'pull'], { cwd: ROOT_DIR })
  );
}

async function ensureEnvFile() {
  if (await pathExists(ENV_PATH)) {
    await loadEnvEntries();
    logInfo('Using existing .env file. Existing values will be preserved.');
    return;
  }
  if (!(await pathExists(ENV_TEMPLATE_PATH))) {
    throw new Error('.env.example missing. Cannot bootstrap environment.');
  }
  await fs.copyFile(ENV_TEMPLATE_PATH, ENV_PATH);
  await loadEnvEntries();
  logSuccess('Created .env from template.');
}

async function loadEnvEntries() {
  const contents = await fs.readFile(ENV_PATH, 'utf8');
  envEntries.length = 0;
  const lines = contents.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (match) {
      envEntries.push({ type: 'pair', key: match[1], value: match[2] });
    } else if (line.trim() === '') {
      envEntries.push({ type: 'blank', raw: line });
    } else {
      envEntries.push({ type: 'comment', raw: line });
    }
  }
  envLoaded = true;
}

function getEnvVar(key) {
  ensureEnvLoaded();
  const entry = envEntries.find(e => e.type === 'pair' && e.key === key);
  return entry ? entry.value : '';
}

function ensureEnvLoaded() {
  if (!envLoaded) {
    throw new Error('Environment file not loaded yet.');
  }
}

function setEnvVar(key, value) {
  ensureEnvLoaded();
  const existing = envEntries.find(e => e.type === 'pair' && e.key === key);
  if (existing) {
    existing.value = value;
  } else {
    if (envEntries.length > 0 && envEntries.at(-1).type !== 'blank') {
      envEntries.push({ type: 'blank', raw: '' });
    }
    envEntries.push({ type: 'pair', key, value });
  }
}

async function saveEnvFile() {
  ensureEnvLoaded();
  const lines = envEntries.map(entry => {
    if (entry.type === 'pair') return `${entry.key}=${entry.value}`;
    return entry.raw ?? '';
  });
  await fs.writeFile(ENV_PATH, lines.join(os.EOL), 'utf8');
}

function generateHexSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateBase64Secret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64');
}

function redact(value) {
  if (!value) return '****';
  if (value.length <= 8) return '****';
  return `****${value.slice(-4)}`;
}

function recordMissingKey(message) {
  if (!MISSING_KEYS.includes(message)) {
    MISSING_KEYS.push(message);
  }
}

function recordDisabledFeature(message) {
  if (!DISABLED_FEATURES.includes(message)) {
    DISABLED_FEATURES.push(message);
  }
}

async function configureSecrets() {
  setEnvVarIfUnset('CONTROL_PLANE_API_TOKEN', generateHexSecret());
  if (!getEnvVar('URLSCAN_CALLBACK_URL')) {
    setEnvVar('URLSCAN_CALLBACK_URL', 'http://reverse-proxy:8088/urlscan/callback');
  }
}

function setEnvVarIfUnset(key, generator) {
  const current = getEnvVar(key);
  if (current && current !== 'change-me') return;
  const value = typeof generator === 'function' ? generator() : generator;
  setEnvVar(key, value);
  logInfo(`Generated ${key} (stored in .env as ${redact(value)}).`);
}

async function promptForApiKeys() {
  for (const integration of API_INTEGRATIONS) {
    const existing = getEnvVar(integration.key);
    if (existing) continue;

    if (CLI_FLAGS.noninteractive) {
      if (integration.flag) {
        setEnvVar(integration.flag, 'false');
        recordDisabledFeature(`${integration.title} disabled (non-interactive run).`);
      }
      recordMissingKey(`${integration.title} (${integration.importance}) missing; re-run setup interactively.`);
      continue;
    }

    console.log(formatHeading(`${integration.title} API Key`));
    if (integration.docs) {
      logInfo(integration.docs);
    }
    for (const step of integration.steps) {
      logInfo(step);
    }

    const answer = await new Input({
      name: 'apiKey',
      message: `Paste ${integration.title} API key (leave blank to skip for now)`
    }).run();

    if (!answer.trim()) {
      if (integration.flag) {
        setEnvVar(integration.flag, 'false');
        recordDisabledFeature(`${integration.title} disabled until API key is provided.`);
      }
      recordMissingKey(`${integration.title} (${integration.importance}) missing; add later for better coverage.`);
      logWarn(`Skipped ${integration.title} key.`);
      continue;
    }

    setEnvVar(integration.key, answer.trim());
    logSuccess(`${integration.title} key stored (redacted: ${redact(answer.trim())}).`);
    if (integration.flag && getEnvVar(integration.flag).toLowerCase() === 'false') {
      setEnvVar(integration.flag, 'true');
    }
  }
}

async function configureRemoteAuth() {
  if (!getEnvVar('WA_AUTH_STRATEGY') || getEnvVar('WA_AUTH_STRATEGY') === 'local') {
    setEnvVar('WA_AUTH_STRATEGY', 'remote');
    logInfo('Defaulted WA_AUTH_STRATEGY to remote.');
  }

  setEnvVarIfUnset('WA_REMOTE_AUTH_DATA_KEY', generateBase64Secret);

  let phone = cleanDigits(getEnvVar('WA_REMOTE_AUTH_PHONE_NUMBER'));
  const defaultDigits = cleanDigits(DEFAULT_REMOTE_AUTH_PHONE);
  if (phone === '27632710634' && defaultDigits) {
    phone = defaultDigits;
    setEnvVar('WA_REMOTE_AUTH_PHONE_NUMBER', phone);
    logInfo(`Replaced legacy RemoteAuth phone with default (${redact(phone)}).`);
  }

  if (!phone) {
    if (CLI_FLAGS.noninteractive) {
      logWarn('WA_REMOTE_AUTH_PHONE_NUMBER not set; QR pairing will be required.');
    } else {
      phone = await promptForPhone(defaultDigits);
    }
  }

  if (phone) {
    setEnvVar('WA_REMOTE_AUTH_PHONE_NUMBER', phone);
    logInfo(`RemoteAuth pairing will target ${redact(phone)}.`);
    await configureAutoPair(phone);
  }
}

function cleanDigits(input = '') {
  return input.replace(/\D+/g, '');
}

async function promptForPhone(defaultDigits) {
  console.log(formatHeading('WhatsApp RemoteAuth Phone'));
  logInfo('Provide the phone number WhatsApp should send pairing codes to (digits only).');
  logInfo('Type "skip" to use QR-code pairing instead.');
  while (true) {
    const answer = await new Input({
      name: 'phone',
      message: 'WhatsApp phone number'
    }).run();
    const trimmed = answer.trim();
    if (!trimmed) {
      logWarn('Phone number cannot be empty.');
      continue;
    }
    if (trimmed.toLowerCase() === 'skip') {
      logWarn('Skipping phone-number pairing; QR pairing will be required.');
      return '';
    }
    const digits = cleanDigits(trimmed);
    if (digits.length >= 8 && digits.length <= 15) {
      return digits;
    }
    logWarn('Invalid phone number. Provide 8-15 digits (no symbols).');
  }
}

async function configureAutoPair(phoneDigits) {
  const existing = getEnvVar('WA_REMOTE_AUTH_AUTO_PAIR');
  if (existing) return;
  if (CLI_FLAGS.noninteractive) {
    setEnvVar('WA_REMOTE_AUTH_AUTO_PAIR', 'false');
    return;
  }

  console.log(formatHeading('Linking your WhatsApp'));
  logInfo(`We can request a one-time code automatically and display it for ${redact(phoneDigits)}.`);
  logInfo('If you prefer to scan a QR code yourself, choose “No” and we will show the QR in the logs.');
  const enable = await new Confirm({
    name: 'autopair',
    message: 'Request phone-number code automatically when services start?',
    initial: true
  }).run();
  setEnvVar('WA_REMOTE_AUTH_AUTO_PAIR', enable ? 'true' : 'false');
  if (enable) {
    logSuccess('Auto pairing enabled. The pairing watcher can alert you when the code arrives.');
  } else {
    logWarn('Auto pairing disabled; you will scan a QR code after the stack starts.');
  }
}

async function validateQueueNames() {
  const queues = ['SCAN_REQUEST_QUEUE', 'SCAN_VERDICT_QUEUE', 'SCAN_URLSCAN_QUEUE'];
  for (const key of queues) {
    const value = getEnvVar(key);
    if (!value) throw new Error(`${key} cannot be empty.`);
    if (value.includes(':')) throw new Error(`${key} contains ':' (${value}). Use hyphen-separated names instead.`);
  }
  logSuccess('Queue naming looks good.');
}

async function checkPorts() {
  const collisions = [];
  for (const { port, label, envHint } of PORT_CHECKS) {
    if (await isPortInUse(port)) {
      collisions.push({ port, label, envHint });
    }
  }
  if (collisions.length > 0) {
    logWarn('Port conflicts detected:');
    for (const collision of collisions) {
      logWarn(`• Port ${collision.port} (${collision.label}) is already in use.`);
      if (collision.envHint) {
        logInfo(`  Update ${collision.envHint} in .env and rerun setup.`);
      }
    }
    if (!CLI_FLAGS.noninteractive) {
      await new Confirm({
        name: 'continue',
        message: 'Continue despite port conflicts?',
        initial: false
      }).run();
    }
  } else {
    logSuccess('No blocking port collisions detected.');
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
      // ignore; fall through to bind test
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

async function prepareEnvironment() {
  console.log(formatHeading('Preparing Environment'));
  await ensureEnvFile();
  await configureSecrets();
  await promptForApiKeys();
  await configureRemoteAuth();
  await validateQueueNames();
  await checkPorts();
  await saveEnvFile();
  logSuccess('.env configured.');
}

async function runConfigValidation() {
  const scriptPath = path.join(ROOT_DIR, 'scripts', 'validate-config.js');
  if (!(await pathExists(scriptPath))) return;
  if (!(await commandExists('node'))) {
    logWarn('Node.js not detected; skipping scripts/validate-config.js validation.');
    return;
  }
  console.log(formatHeading('Validating configuration'));
  await runWithSpinner('node scripts/validate-config.js', () =>
    execa('node', [scriptPath], { cwd: ROOT_DIR, stdout: 'inherit', stderr: 'inherit' })
  );
}

async function verifyApiKeys() {
  console.log(formatHeading('Validating API keys'));
  if (CLI_FLAGS.skipApiValidation) {
    logWarn('Skipping outbound API validation (--skip-api-validation provided).');
    await notePhishTank();
    logInfo('API key validation skipped.');
    return;
  }
  await Promise.all([
    validateVirusTotal(),
    validateGoogleSafeBrowsing(),
    validateUrlscan(),
    validateWhoisXml(),
    notePhishTank()
  ]);
  await saveEnvFile();
  logSuccess('API key validation complete.');
}

async function validateVirusTotal() {
  const key = getEnvVar('VT_API_KEY');
  if (!key) {
    recordMissingKey('VirusTotal disabled without VT_API_KEY.');
    logWarn('VT_API_KEY not set. VirusTotal checks will be skipped.');
    return;
  }
  try {
    const res = await fetchWithTimeout('https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8', {
      headers: { 'x-apikey': key }
    });
    if (res.status === 200) {
      logSuccess('VirusTotal API key accepted.');
    } else if (res.status === 401 || res.status === 403) {
      throw new Error(`VirusTotal API key rejected (HTTP ${res.status}). Update VT_API_KEY and rerun.`);
    } else {
      logWarn(`VirusTotal validation returned HTTP ${res.status}. Check quota or network.`);
    }
  } catch (error) {
    logWarn(`VirusTotal validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateGoogleSafeBrowsing() {
  const key = getEnvVar('GSB_API_KEY');
  if (!key) {
    recordMissingKey('Google Safe Browsing disabled without GSB_API_KEY.');
    logWarn('GSB_API_KEY not set. Google Safe Browsing will be disabled.');
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
      logSuccess('Google Safe Browsing API key accepted.');
    } else if ([400, 401, 403].includes(res.status)) {
      const body = await res.text();
      throw new Error(`GSB API key rejected (HTTP ${res.status}). Response: ${body.slice(0, 120)}`);
    } else {
      logWarn(`GSB validation returned HTTP ${res.status}. Check billing or quota.`);
    }
  } catch (error) {
    logWarn(`GSB validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateUrlscan() {
  const enabled = getEnvVar('URLSCAN_ENABLED');
  const key = getEnvVar('URLSCAN_API_KEY');
  if (enabled.toLowerCase() !== 'true') return;
  if (!key) {
    setEnvVar('URLSCAN_ENABLED', 'false');
    recordDisabledFeature('urlscan.io disabled until API key provided.');
    recordMissingKey('urlscan.io deep scans unavailable without URLSCAN_API_KEY.');
    return;
  }
  try {
    const res = await fetchWithTimeout('https://urlscan.io/user/quotas', {
      headers: { 'API-Key': key }
    });
    if (res.status === 200) {
      logSuccess('urlscan.io API key accepted.');
    } else if (res.status === 401 || res.status === 403) {
      setEnvVar('URLSCAN_ENABLED', 'false');
      setEnvVar('URLSCAN_CALLBACK_SECRET', '');
      recordDisabledFeature('urlscan.io disabled: API key rejected.');
      recordMissingKey('urlscan.io unavailable until a valid key is provided.');
    } else {
      logWarn(`urlscan.io validation returned HTTP ${res.status}.`);
    }
  } catch (error) {
    logWarn(`urlscan.io validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateWhoisXml() {
  const enabled = getEnvVar('WHOISXML_ENABLED');
  const key = getEnvVar('WHOISXML_API_KEY');
  if (enabled.toLowerCase() !== 'true' || !key) return;
  try {
    const res = await fetchWithTimeout(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${key}&domainName=example.com&outputFormat=JSON`
    );
    if (res.status === 200) {
      const body = await res.text();
      if (/ErrorMessage/i.test(body)) {
        logWarn('WhoisXML responded with an error message; check quota.');
      } else {
        logSuccess('WhoisXML API key accepted.');
      }
    } else if (res.status === 401 || res.status === 403) {
      setEnvVar('WHOISXML_ENABLED', 'false');
      recordDisabledFeature('WhoisXML disabled: API key rejected.');
    } else {
      logWarn(`WhoisXML validation returned HTTP ${res.status}.`);
    }
  } catch (error) {
    logWarn(`WhoisXML validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function notePhishTank() {
  const phishKey = getEnvVar('PHISHTANK_APP_KEY');
  if (phishKey) {
    logInfo('PhishTank key present; API currently rate-limited—perform manual verification later.');
  } else {
    logWarn('PhishTank APP key missing (registration currently limited); continuing without it.');
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

async function cleanUpStack() {
  if (CLI_FLAGS.reset) {
    console.log(formatHeading('Reset Requested'));
    logWarn('Reset will delete Postgres data and the WhatsApp session volume.');
    if (!CLI_FLAGS.noninteractive) {
      const confirm = await new Confirm({
        name: 'confirmReset',
        message: 'Proceed with destructive reset (DB + WhatsApp session will be deleted)?',
        initial: false
      }).run();
      if (!confirm) {
        CLI_FLAGS.reset = false;
        logWarn('Reset aborted by user.');
        return;
      }
    }
    await runWithSpinner('docker compose down -v --remove-orphans', () =>
      execa(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'down', '-v', '--remove-orphans'], { cwd: ROOT_DIR })
    );
    stackWasStopped = true;
    return;
  }

  if (CLI_FLAGS.clean) {
    console.log(formatHeading('Stopping existing stack'));
    await runWithSpinner('docker compose down', () =>
      execa(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'down'], { cwd: ROOT_DIR })
    );
    stackWasStopped = true;
  }
}

async function buildAndLaunch() {
  if (CLI_FLAGS.dryRun) {
    logInfo('Dry run requested: skipping Docker build and launch.');
    return;
  }
  console.log(formatHeading('Building containers'));
  await runWithSpinner('make build', () =>
    execa('make', ['build'], { cwd: ROOT_DIR, stdio: 'inherit' })
  );

  console.log(formatHeading('Resetting Docker stack'));
  if (stackWasStopped) {
    logInfo('Stack already stopped earlier; skipping docker compose down.');
  } else {
    await runWithSpinner('Stopping existing stack', () =>
      execa(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'down', '--remove-orphans'], { cwd: ROOT_DIR })
    );
    stackWasStopped = true;
  }
  await runWithSpinner('Pruning stopped containers', () =>
    execa(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'rm', '-f'], { cwd: ROOT_DIR })
  );

  console.log(formatHeading('Preparing WhatsApp session storage'));
  await runWithSpinner('Aligning wa-client session volume', () =>
    execa(
      dockerComposeCommand[0],
      [...dockerComposeCommand.slice(1), 'run', '--rm', '--no-deps', '--user', 'root', '--entrypoint', '/bin/sh', 'wa-client', '-c', 'mkdir -p /app/services/wa-client/data/session && chown -R pptruser:pptruser /app/services/wa-client/data'],
      { cwd: ROOT_DIR, stdio: 'inherit' }
    )
  );

  console.log(formatHeading('Starting stack'));
  try {
    await runWithSpinner('make up', () =>
      execa('make', ['up'], { cwd: ROOT_DIR, stdio: 'inherit' })
    );
  } catch (error) {
    logWarn(`make up failed (exit ${error.exitCode}); retrying with docker compose up -d.`);
    await runWithSpinner('docker compose up -d', () =>
      execa(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'up', '-d'], { cwd: ROOT_DIR, stdio: 'inherit' })
    );
  }
}

async function waitForFoundations() {
  if (CLI_FLAGS.dryRun) return;
  console.log(formatHeading('Waiting for core services'));
  for (const { service, label } of WAIT_FOR) {
    await waitForContainerHealth(service, label);
  }
}

async function waitForContainerHealth(service, label) {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { stdout } = await execa(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'ps', '-q', service], { cwd: ROOT_DIR });
    const containerId = stdout.trim();
    if (!containerId) {
      await sleep(2000);
      continue;
    }
    try {
      const { stdout: inspect } = await execa('docker', ['inspect', '-f', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', containerId]);
      const status = inspect.trim();
      if (status === 'healthy' || status === 'running') {
        logSuccess(`${label} container ready (status: ${status}).`);
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

async function waitForReverseProxy() {
  if (CLI_FLAGS.dryRun) return;
  const token = getEnvVar('CONTROL_PLANE_API_TOKEN');
  if (!token) {
    logWarn('Missing CONTROL_PLANE_API_TOKEN; skipping reverse proxy health checks.');
    return;
  }

  for (const target of HTTP_HEALTH_TARGETS) {
    const port = getEnvVar(target.envPort) || String(target.defaultPort);
    const url = `http://127.0.0.1:${port}${target.path}`;
    await waitForHttp(target.name, url, target.requiresToken ? { Authorization: `Bearer ${token}` } : undefined);
  }
}

async function waitForHttp(name, url, headers = {}) {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, { headers });
      if (res.ok) {
        logSuccess(`${name} healthy at ${url}`);
        return;
      }
    } catch {
      // ignore
    }
    await sleep(5000);
  }
  throw new Error(`${name} did not become healthy at ${url}. Inspect docker compose logs.`);
}

async function tailWhatsappLogs() {
  if (CLI_FLAGS.noninteractive || CLI_FLAGS.dryRun) {
    logWarn('Skipping WhatsApp log tail (--noninteractive or --dry-run).');
    return;
  }
  console.log(formatHeading('WhatsApp Pairing'));
  const strategy = (getEnvVar('WA_AUTH_STRATEGY') || 'remote').toLowerCase();
  const phone = cleanDigits(getEnvVar('WA_REMOTE_AUTH_PHONE_NUMBER'));
  const autoPair = (getEnvVar('WA_REMOTE_AUTH_AUTO_PAIR') || '').toLowerCase() === 'true';

  if (strategy === 'remote' && phone && autoPair) {
    logInfo(`Watching for phone-number pairing code targeting ${redact(phone)}.`);
    logInfo('Open WhatsApp → Linked Devices → Link with phone number and enter the displayed code.');
  } else {
    logInfo('A QR code will appear below. Open WhatsApp → Linked Devices → Link a Device and scan it.');
  }
  logInfo("This log stream exits automatically once the client prints 'WhatsApp client ready'.");

  await new Promise((resolve) => {
    const tail = spawn(dockerComposeCommand[0], [...dockerComposeCommand.slice(1), 'logs', '--no-color', '--follow', 'wa-client'], {
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

async function waitForWhatsappReady() {
  if (CLI_FLAGS.noninteractive || CLI_FLAGS.dryRun) return;
  await waitForContainerHealth('wa-client', 'WhatsApp client');
}

async function smokeTest() {
  if (CLI_FLAGS.dryRun) return;
  console.log(formatHeading('Smoke Test'));
  const token = getEnvVar('CONTROL_PLANE_API_TOKEN');
  if (!token) {
    logWarn('Control plane token missing; cannot run authenticated smoke test.');
    return;
  }
  const reversePort = getEnvVar('REVERSE_PROXY_PORT') || '8088';
  try {
    const res = await fetchWithTimeout(`http://localhost:${reversePort}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      logSuccess('Control-plane status endpoint reachable.');
    } else {
      logWarn(`Control-plane status check returned HTTP ${res.status}.`);
    }
  } catch {
    logWarn('Control-plane status check failed; verify docker compose logs.');
  }
  logInfo('Next steps: drop a harmless link (e.g., https://example.com) in your pilot group to confirm verdict logging.');
  logInfo('Admin commands (`!scanner status`, `!scanner mute`, `!scanner unmute`, `!scanner rescan <url>`) are available in group chats.');
}

function printObservability() {
  if (CLI_FLAGS.dryRun) return;
  console.log(formatHeading('Observability & Access'));
  const reversePort = getEnvVar('REVERSE_PROXY_PORT') || '8088';
  logInfo(`Reverse proxy: http://localhost:${reversePort}`);
  logInfo(`Control plane UI: http://localhost:${reversePort}/`);
  logInfo('Grafana: http://localhost:3002 (admin / admin)');
  logInfo('Prometheus: accessible inside docker network at prometheus:9090');
  const token = getEnvVar('CONTROL_PLANE_API_TOKEN');
  if (token) {
    logInfo(`Control plane token (redacted): ${redact(token)}`);
  }
  logWarn('Harden services (TLS + IP restrictions) before exposing beyond localhost.');
}

function printPostrunGaps() {
  if (MISSING_KEYS.length > 0) {
    console.log(formatHeading('Pending API Keys'));
    for (const entry of MISSING_KEYS) {
      logWarn(entry);
    }
  }
  if (DISABLED_FEATURES.length > 0) {
    console.log(formatHeading('Disabled Integrations'));
    for (const entry of DISABLED_FEATURES) {
      logWarn(entry);
    }
  }
}

function printTroubleshooting() {
  console.log(formatHeading('Troubleshooting Tips'));
  for (const line of TROUBLESHOOTING_LINES) {
    logInfo(line);
  }
}

async function offerPairingWatcher() {
  if (CLI_FLAGS.noninteractive || CLI_FLAGS.dryRun) return;
  if ((getEnvVar('WA_AUTH_STRATEGY') || 'remote').toLowerCase() !== 'remote') return;
  if ((getEnvVar('WA_REMOTE_AUTH_AUTO_PAIR') || '').toLowerCase() !== 'true') {
    logInfo('Need audio cues later? Run `npm run watch:pairing-code` for audible alerts.');
    return;
  }
  if (!(await commandExists('node'))) {
    logWarn('Node.js not detected; cannot launch pairing watcher automatically.');
    return;
  }
  const startWatcher = await new Confirm({
    name: 'watcher',
    message: 'Start the pairing code watcher (plays audio when code arrives)?',
    initial: true
  }).run();
  if (startWatcher) {
    logInfo('Press Ctrl+C when you are done listening for codes.');
    try {
      await execa('npm', ['run', '--silent', 'watch:pairing-code'], { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch {
      logWarn('Pairing watcher exited unexpectedly. You can run `npm run watch:pairing-code` again later.');
    }
  } else {
    logInfo('No problem. Run `npm run watch:pairing-code` later if you change your mind.');
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

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function runWithSpinner(label, task) {
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

function humanize(milliseconds) {
  return humanizeDuration(Math.max(1, Math.round(milliseconds)), { largest: 2, round: true });
}

async function main() {
  try {
    parseArgs();
    await ensureNodeVersion();
    await welcome();
    await planWizard();

    const tasks = new Listr(
      [
        {
          title: 'Preflight checks',
          task: () =>
            new Listr(
              [
                { title: 'Ensure repository structure', task: ensureRepo },
                { title: 'Validate host prerequisites', task: preflightChecks },
                { title: 'Checkout branch (if requested)', task: checkoutBranch },
                { title: 'Pull updates (if requested)', task: pullUpdates }
              ],
              { concurrent: false }
            )
        },
        {
          title: 'Clean up previous runs',
          task: cleanUpStack,
          enabled: () => CLI_FLAGS.clean || CLI_FLAGS.reset
        },
        {
          title: 'Configure environment',
          task: prepareEnvironment
        },
        {
          title: 'Validate configuration',
          task: runConfigValidation
        },
        {
          title: 'Validate API integrations',
          task: verifyApiKeys
        },
        {
          title: 'Build & launch Docker stack',
          task: buildAndLaunch
        },
        {
          title: 'Wait for services',
          task: () =>
            new Listr(
              [
                { title: 'Core containers', task: waitForFoundations },
                { title: 'WhatsApp pairing logs', task: tailWhatsappLogs },
                { title: 'WhatsApp ready check', task: waitForWhatsappReady },
                { title: 'Reverse proxy health', task: waitForReverseProxy }
              ],
              { sequential: true }
            )
        },
        {
          title: 'Smoke test',
          task: smokeTest
        }
      ],
      {
        renderer: CLI_FLAGS.noninteractive || !isTTY() ? 'verbose' : 'default',
        rendererOptions: {
          collapse: false,
          showTimer: true
        },
        exitOnError: true
      }
    );

    await tasks.run();

    printObservability();
    printPostrunGaps();
    printTroubleshooting();
    await offerPairingWatcher();
    logSuccess('Setup complete. Re-run ./setup.sh anytime; operations are idempotent.');
  } catch (error) {
    logError(error.message || 'Setup halted due to an unexpected error.');
    process.exit(1);
  }
}

main();
