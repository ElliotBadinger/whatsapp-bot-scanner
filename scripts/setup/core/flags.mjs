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

const CHECKPOINTS = new Set(["preflight", "environment", "containers"]);
const QUICK_ACTIONS = new Set(["preflight", "resume-docker", "purge-caches"]);

export function parseFlags(argv, env = process.env) {
  const flags = {
    clean: false,
    reset: false,
    noninteractive: false,
    pull: false,
    branch: "",
    fromTarball: "",
    dryRun: false,
    mode: null,
    resume: null,
    stopAfter: null,
    quick: null,
  };

  for (const arg of argv) {
    if (arg === "--clean") flags.clean = true;
    else if (arg === "--reset") {
      flags.reset = true;
      flags.clean = true;
    } else if (arg === "--noninteractive") flags.noninteractive = true;
    else if (arg === "--pull") flags.pull = true;
    else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg.startsWith("--branch=")) flags.branch = arg.split("=")[1];
    else if (arg.startsWith("--from=")) flags.fromTarball = arg.split("=")[1];
    else if (arg.startsWith("--mode=")) {
      const mode = arg.split("=")[1];
      if (!["guided", "expert"].includes(mode)) {
        throw new Error(`Unknown mode: ${mode}`);
      }
      flags.mode = mode;
    } else if (arg.startsWith("--resume=")) {
      const checkpoint = arg.split("=")[1];
      if (!CHECKPOINTS.has(checkpoint)) {
        throw new Error(`Unknown checkpoint: ${checkpoint}`);
      }
      flags.resume = checkpoint;
    } else if (arg.startsWith("--stop-after=")) {
      const checkpoint = arg.split("=")[1];
      if (!CHECKPOINTS.has(checkpoint)) {
        throw new Error(`Unknown checkpoint for --stop-after: ${checkpoint}`);
      }
      flags.stopAfter = checkpoint;
    } else if (arg.startsWith("--quick=")) {
      const quick = arg.split("=")[1];
      if (!QUICK_ACTIONS.has(quick)) {
        throw new Error(`Unknown quick action: ${quick}`);
      }
      flags.quick = quick;
    } else if (arg === "-h" || arg === "--help") {
      console.log(HELP_TEXT);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (env.SETUP_NONINTERACTIVE === "1" || env.CI === "true") {
    flags.noninteractive = true;
  }

  return flags;
}

export { HELP_TEXT };
