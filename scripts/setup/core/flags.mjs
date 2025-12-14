const HELP_TEXT = `Usage: ./setup.sh [options]

Options:
  --clean               Stop existing stack before setup.
  --reset               Stop stack and remove volumes (destructive).
  --noninteractive      Run without interactive prompts.
  --pull                Pull latest git commits and container images.
  --branch=<name>       Checkout the specified git branch.
  --from=<tarball>      Use a local project tarball (air-gapped installs).
  --dry-run             Run planning only; skip Docker build/run.
  --mode=<guided|expert>  Start in the chosen verbosity mode.
  --resume=<checkpoint> Resume from checkpoint (preflight|environment|containers).
  --stop-after=<checkpoint> Stop after checkpoint (for quick actions).
  --quick=<action>      Run a quick action (preflight|resume-docker|purge-caches).
  --help                Show this help.
`;

const CHECKPOINTS = new Set(['preflight', 'environment', 'containers']);
const QUICK_ACTIONS = new Set(['preflight', 'resume-docker', 'purge-caches']);

function parseEqualsArg(arg) {
  const idx = arg.indexOf('=');
  if (!arg.startsWith('--') || idx === -1) return null;
  return {
    key: arg.slice(2, idx),
    value: arg.slice(idx + 1)
  };
}

function assertMode(mode) {
  if (!['guided', 'expert'].includes(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }
}

function assertCheckpoint(checkpoint) {
  if (!CHECKPOINTS.has(checkpoint)) {
    throw new Error(`Unknown checkpoint: ${checkpoint}`);
  }
}

function assertStopAfterCheckpoint(checkpoint) {
  if (!CHECKPOINTS.has(checkpoint)) {
    throw new Error(`Unknown checkpoint for --stop-after: ${checkpoint}`);
  }
}

function assertQuickAction(quick) {
  if (!QUICK_ACTIONS.has(quick)) {
    throw new Error(`Unknown quick action: ${quick}`);
  }
}

const BARE_FLAG_HANDLERS = {
  '--clean': (flags) => {
    flags.clean = true;
  },
  '--reset': (flags) => {
    flags.reset = true;
    flags.clean = true;
  },
  '--noninteractive': (flags) => {
    flags.noninteractive = true;
  },
  '--pull': (flags) => {
    flags.pull = true;
  },
  '--dry-run': (flags) => {
    flags.dryRun = true;
  }
};

const KEY_VALUE_HANDLERS = {
  branch: (flags, value) => {
    flags.branch = value;
  },
  from: (flags, value) => {
    flags.fromTarball = value;
  },
  mode: (flags, value) => {
    assertMode(value);
    flags.mode = value;
  },
  resume: (flags, value) => {
    assertCheckpoint(value);
    flags.resume = value;
  },
  'stop-after': (flags, value) => {
    assertStopAfterCheckpoint(value);
    flags.stopAfter = value;
  },
  quick: (flags, value) => {
    assertQuickAction(value);
    flags.quick = value;
  }
};

export function parseFlags(argv, env = process.env) {
  const flags = {
    clean: false,
    reset: false,
    noninteractive: false,
    pull: false,
    branch: '',
    fromTarball: '',
    dryRun: false,
    mode: null,
    resume: null,
    stopAfter: null,
    quick: null
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      console.log(HELP_TEXT);
      process.exit(0);
    }

    const bareHandler = BARE_FLAG_HANDLERS[arg];
    if (bareHandler) {
      bareHandler(flags);
      continue;
    }

    const parsed = parseEqualsArg(arg);
    if (!parsed) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const handler = KEY_VALUE_HANDLERS[parsed.key];
    if (!handler) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    handler(flags, parsed.value);
  }

  if (env.SETUP_NONINTERACTIVE === '1' || env.CI === 'true') {
    flags.noninteractive = true;
  }

  return flags;
}

export { HELP_TEXT };
