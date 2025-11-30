import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import boxen from "boxen";
import chalk from "chalk";

import { SetupContext } from "./core/context.mjs";
import { parseFlags } from "./core/flags.mjs";
import { EnvFile } from "./core/env-file.mjs";
import { createOutput } from "./ui/output.mjs";
import { registerHotkeys } from "./ui/hotkeys.mjs";
import { describeHotkeys } from "./ui/hotkeys.mjs";
import { createPhaseRegistry, runPhases } from "./phases/registry.mjs";
import { registerBuiltinPhases } from "./phases/index.mjs";
import { clearPlugins, activatePlugins } from "./plugins/registry.mjs";
import { registerBuiltinPlugins } from "./plugins/builtin.mjs";
import { ROOT_DIR, ENV_PATH, ENV_TEMPLATE_PATH } from "./config.mjs";
import {
  generateHexSecret,
  generateBase64Secret,
  formatCliError,
} from "./utils/runtime.mjs";
import { Confirm, Toggle, MultiSelect, Input } from "./utils/prompts.mjs";

async function ensureNodeVersion() {
  const [major] = process.versions.node.split(".").map(Number);
  if (Number.isFinite(major) && major < 18) {
    throw new Error("Node.js 18 or newer is required to run the setup wizard.");
  }
  if (typeof globalThis.fetch !== "function") {
    throw new Error(
      "Global fetch API not detected. Upgrade to Node.js 18+ or enable experimental-fetch.",
    );
  }
}

async function showWelcome(context, output) {
  if (context.flags.noninteractive || !process.stdout.isTTY) {
    output.info("Running in non-interactive mode.");
    return;
  }
  const banner = boxen(
    [
      chalk.bold("WhatsApp Bot Scanner • Adaptive Setup"),
      "",
      "We will guide you through four phases:",
      "  1. Host readiness & repository checks",
      "  2. Environment configuration & integrations",
      "  3. Container build, launch, and checkpoints",
      "  4. Validation, pairing, and support artifacts",
      "",
      `Hotkeys: ${describeHotkeys()}`,
      "",
    ].join(os.EOL),
    {
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      borderStyle: "round",
      borderColor: "cyan",
    },
  );
  console.log(banner);
  const confirm = await new Confirm({
    name: "ready",
    message: "Ready to begin the guided setup?",
    initial: true,
  }).run();
  if (!confirm) {
    output.warn("Setup cancelled by user.");
    await context.finalize("cancelled");
    process.exit(0);
  }
  output.info('Guided mode active. Toggle verbosity anytime with hotkey "v".');
}

async function runPlanningFlow(context, output) {
  if (context.flags.noninteractive || !process.stdout.isTTY) return;
  const selections = await new MultiSelect({
    name: "actions",
    message: "Choose any prep steps to run before provisioning",
    hint: "Space to toggle, Enter to confirm",
    limit: 5,
    choices: [
      {
        name: "pull",
        message: "Pull latest git commits and container images",
        value: "pull",
        initial: true,
      },
      {
        name: "clean",
        message: "Stop running containers from previous setup",
        value: "clean",
        initial: true,
      },
      {
        name: "reset",
        message: "Full reset (delete database + WhatsApp session)",
        value: "reset",
        initial: false,
      },
    ],
  }).run();
  context.flags.pull = selections.includes("pull");
  context.flags.clean = selections.includes("clean");
  context.flags.reset = selections.includes("reset");
  if (context.flags.reset) {
    context.flags.clean = true;
  }
  const branchToggle = await new Toggle({
    name: "branchToggle",
    message: "Checkout a specific git branch before continuing?",
    enabled: "Yes",
    disabled: "No",
    initial: Boolean(context.flags.branch),
  }).run();
  if (branchToggle) {
    const branchName = await new Input({
      name: "branch",
      message: "Enter branch name",
      initial: context.flags.branch,
      validate: (value) =>
        value.trim().length === 0 ? "Branch name cannot be empty." : true,
    }).run();
    context.flags.branch = branchName.trim();
  }
  output.heading("Plan Summary");
  output.info(`Pull latest code/images: ${context.flags.pull ? "Yes" : "No"}`);
  output.info(
    `Stop existing containers: ${context.flags.clean ? "Yes" : "No"}`,
  );
  output.info(
    `Full reset (volumes): ${context.flags.reset ? "Yes – destructive" : "No"}`,
  );
  output.info(`Target branch: ${context.flags.branch || "Stay on current"}`);
  const proceed = await new Confirm({
    name: "proceed",
    message: "Proceed with this plan?",
    initial: true,
  }).run();
  if (!proceed) {
    output.warn("Setup cancelled before making changes.");
    await context.finalize("cancelled");
    process.exit(0);
  }
  context.recordDecision("plan", {
    pull: context.flags.pull,
    clean: context.flags.clean,
    reset: context.flags.reset,
    branch: context.flags.branch || "current",
  });
}

async function purgeSetupCaches(context, output) {
  const cacheDir = path.join(ROOT_DIR, ".setup");
  const logsDir = path.join(ROOT_DIR, "logs");
  await fs.rm(cacheDir, { recursive: true, force: true });
  const removedLogs = [];
  try {
    const files = await fs.readdir(logsDir);
    for (const file of files) {
      if (
        file.startsWith("setup-") &&
        (file.endsWith(".md") || file.endsWith(".json"))
      ) {
        await fs.rm(path.join(logsDir, file), { force: true });
        removedLogs.push(file);
      }
    }
  } catch {
    // ignore missing logs directory
  }
  output.success(
    `Cleared setup cache directory${removedLogs.length ? ` and removed ${removedLogs.length} transcript(s)` : ""}.`,
  );
  context.log("purge", { cacheDir, removedLogs });
}

function createRecoveryManager(context, output) {
  return {
    displayQuickActions() {
      output.heading("Recovery Toolkit");
      output.info("Re-run preflight only → ./setup.sh --quick=preflight");
      output.info(
        "Resume from Docker phase → ./setup.sh --quick=resume-docker",
      );
      output.info("Purge setup caches → ./setup.sh --quick=purge-caches");
      context.log("recoveryHint", { action: "displayed" });
    },
  };
}

export async function runSetup(argv = process.argv.slice(2)) {
  await ensureNodeVersion();
  const context = new SetupContext(ROOT_DIR);
  await context.initialize();
  const flags = parseFlags(argv);
  context.flags = flags;
  if (flags.mode) {
    context.setMode(flags.mode, { reason: "flag" });
  }
  const output = createOutput(context);
  context.output = output;
  context.on("preferenceWriteFailed", ({ error }) => {
    output.warn(
      `Unable to update cached setup preferences (.setup/preferences.json): ${formatCliError(error)}. Run ./setup.sh --quick=purge-caches if ownership needs resetting.`,
    );
  });
  context.on("transcriptWriteFailed", ({ error }) => {
    output.error(
      `Failed to write setup transcript under ./logs: ${formatCliError(error)}.`,
    );
  });

  const runtime = {
    envFile: new EnvFile(ENV_PATH, ENV_TEMPLATE_PATH),
    dockerComposeCommand: ["docker", "compose"],
    missingKeys: [],
    disabledFeatures: [],
    generateHexSecret,
    generateBase64Secret,
  };
  context.runtime = runtime;

  if (flags.quick === "purge-caches") {
    await purgeSetupCaches(context, output);
    const result = await context.finalize("success");
    if (result?.warnings?.some((w) => w.type === "preferences")) {
      output.warn(
        "Cache purge completed, but ./.setup/preferences.json remains unwritable. Adjust permissions if you want mode persistence.",
      );
    }
    return;
  }
  if (flags.quick === "preflight") {
    flags.stopAfter = "preflight";
    output.info("Quick action: running preflight checks only.");
    context.recordDecision("quickAction", "preflight");
  } else if (flags.quick === "resume-docker") {
    if (!flags.resume) {
      flags.resume = "docker";
    }
    output.info("Quick action: resuming from Docker launch checkpoint.");
    context.recordDecision("quickAction", "resume-docker");
  }

  if (!flags.quick) {
    await showWelcome(context, output);
    await runPlanningFlow(context, output);
  } else {
    output.note("Quick action bypassed welcome and planning flows.");
  }

  const registry = createPhaseRegistry();
  await registerBuiltinPhases(registry);
  clearPlugins();
  registerBuiltinPlugins();
  const activePlugins = activatePlugins({ context, registry });

  const recovery = createRecoveryManager(context, output);
  const cleanupHotkeys = registerHotkeys(context, output, recovery);
  try {
    await runPhases({
      registry,
      context,
      runtime,
      output,
      startAt: flags.resume ?? undefined,
      stopAfter: flags.stopAfter ?? undefined,
      plugins: activePlugins,
    });
    output.success(
      "Setup complete. Re-run ./setup.sh anytime; operations are idempotent.",
    );
    const result = await context.finalize("success");
    if (result?.warnings?.length) {
      for (const warning of result.warnings) {
        if (warning.type === "preferences") {
          output.warn(
            "Setup completed, but we could not persist your preferred mode. Fix permissions on ./.setup/ or purge caches before the next run.",
          );
        }
      }
    }
  } catch (error) {
    context.appendError(error);
    output.error(error.message || "Setup halted due to an unexpected error.");
    context.setResumeHint(context.currentPhase?.id);
    try {
      const result = await context.finalize("failed");
      if (result?.warnings?.length) {
        for (const warning of result.warnings) {
          if (warning.type === "preferences") {
            output.warn(
              "Unable to update ./.setup/preferences.json while exiting. You may need to fix file permissions or run ./setup.sh --quick=purge-caches.",
            );
          }
        }
      }
    } catch (finalizeError) {
      output.error(
        `Additionally failed to write setup artifacts: ${formatCliError(finalizeError)}.`,
      );
    }
    process.exitCode = 1;
  } finally {
    cleanupHotkeys();
  }
}
