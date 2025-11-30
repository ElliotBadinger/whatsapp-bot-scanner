import { execa } from "execa";

import { ROOT_DIR } from "../config.mjs";
import { runWithSpinner } from "../utils/runtime.mjs";

async function buildAndLaunch({ context, runtime, output }) {
  if (context.flags.dryRun) {
    output.info("Dry run requested: skipping Docker build and launch.");
    return;
  }
  output.heading("Building containers");
  await runWithSpinner(context, "make build", () =>
    execa("make", ["build"], { cwd: ROOT_DIR, stdio: "inherit" }),
  );
  output.heading("Resetting Docker stack");
  await runWithSpinner(context, "Stopping existing stack", () =>
    execa(
      runtime.dockerComposeCommand[0],
      [...runtime.dockerComposeCommand.slice(1), "down", "--remove-orphans"],
      { cwd: ROOT_DIR },
    ),
  );
  await runWithSpinner(context, "Pruning stopped containers", () =>
    execa(
      runtime.dockerComposeCommand[0],
      [...runtime.dockerComposeCommand.slice(1), "rm", "-f"],
      { cwd: ROOT_DIR },
    ),
  );
  output.heading("Preparing WhatsApp session storage");
  await runWithSpinner(context, "Aligning wa-client session volume", () =>
    execa(
      runtime.dockerComposeCommand[0],
      [
        ...runtime.dockerComposeCommand.slice(1),
        "run",
        "--rm",
        "--no-deps",
        "--user",
        "root",
        "--entrypoint",
        "/bin/sh",
        "wa-client",
        "-c",
        "mkdir -p /app/services/wa-client/data/session && chown -R pptruser:pptruser /app/services/wa-client/data",
      ],
      { cwd: ROOT_DIR, stdio: "inherit" },
    ),
  );
  output.heading("Starting stack");
  try {
    await runWithSpinner(context, "make up", () =>
      execa("make", ["up"], { cwd: ROOT_DIR, stdio: "inherit" }),
    );
  } catch (error) {
    output.warn("make up failed; falling back to docker compose up -d.");
    await runWithSpinner(context, "docker compose up -d", () =>
      execa(
        runtime.dockerComposeCommand[0],
        [...runtime.dockerComposeCommand.slice(1), "up", "-d"],
        { cwd: ROOT_DIR, stdio: "inherit" },
      ),
    );
  }
}

export default {
  id: "docker",
  title: "Build & launch Docker stack",
  prerequisites: ["api-validation"],
  copy: {
    guided: {
      description:
        "Builds workspace containers and boots the docker-compose stack.",
    },
    expert: {
      description:
        "Rebuilds images, resets stopped containers, and launches services via make up.",
    },
  },
  steps: [async (api) => buildAndLaunch(api)],
};
