import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { execa } from "execa";

import { ROOT_DIR, HTTP_HEALTH_TARGETS } from "../config.mjs";
import { WAIT_FOR_SERVICES } from "../utils/constants.mjs";
import { fetchWithTimeout } from "../utils/network.mjs";
import { cleanDigits, redact } from "../utils/runtime.mjs";
import {
  handleRemoteAuthLog,
  handleRemoteAuthLine,
} from "../utils/remote-auth.mjs";

async function waitForContainerHealth(context, runtime, service, label) {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { stdout } = await execa(
      runtime.dockerComposeCommand[0],
      [...runtime.dockerComposeCommand.slice(1), "ps", "-q", service],
      { cwd: ROOT_DIR },
    );
    const containerId = stdout.trim();
    if (!containerId) {
      await sleep(2000);
      continue;
    }
    try {
      const { stdout: inspect } = await execa("docker", [
        "inspect",
        "-f",
        "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
        containerId,
      ]);
      const status = inspect.trim();
      if (status === "healthy" || status === "running") {
        context.log("serviceReady", { service, status, attempt });
        return;
      }
      if (status === "unhealthy") {
        throw new Error(
          `${label} container reported unhealthy. See: docker compose logs ${service}`,
        );
      }
    } catch {
      // ignore and retry
    }
    await sleep(5000);
  }
  throw new Error(
    `${label} container did not reach healthy state. Investigate with docker compose ps ${service}.`,
  );
}

async function waitForFoundations({ context, runtime, output }) {
  if (context.flags.dryRun) return;
  output.heading("Waiting for core services");
  for (const { service, label } of WAIT_FOR_SERVICES) {
    await waitForContainerHealth(context, runtime, service, label);
    if (context.mode === "guided") {
      output.success(`${label} container ready.`);
    }
  }
}

async function tailWhatsappLogs({ context, runtime, output }) {
  if (context.flags.noninteractive || context.flags.dryRun) {
    output.warn("Skipping WhatsApp log tail (--noninteractive or --dry-run).");
    return;
  }
  output.heading("WhatsApp Pairing");
  const strategy = (
    runtime.envFile.get("WA_AUTH_STRATEGY") || "remote"
  ).toLowerCase();
  const phone = cleanDigits(runtime.envFile.get("WA_REMOTE_AUTH_PHONE_NUMBER"));
  const autoPair =
    (runtime.envFile.get("WA_REMOTE_AUTH_AUTO_PAIR") || "").toLowerCase() ===
    "true";
  if (strategy === "remote" && phone && autoPair) {
    output.info(
      `Watching for phone-number pairing code targeting ${redact(phone)}.`,
    );
  } else {
    output.info("A QR code will appear below for manual pairing.");
  }
  await new Promise((resolve) => {
    const tail = spawn(
      runtime.dockerComposeCommand[0],
      [
        ...runtime.dockerComposeCommand.slice(1),
        "logs",
        "--no-color",
        "--follow",
        "wa-client",
      ],
      {
        cwd: ROOT_DIR,
        stdio: ["inherit", "pipe", "inherit"],
      },
    );
    tail.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      const lines = text.split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        let parsed = null;
        if (line.startsWith("{") && line.endsWith("}")) {
          try {
            parsed = JSON.parse(line);
          } catch {
            parsed = null;
          }
        }
        if (parsed && parsed.msg) {
          handleRemoteAuthLog(context, runtime, output, parsed);
          if (/WhatsApp client ready/i.test(parsed.msg)) {
            tail.kill("SIGINT");
            resolve();
            return;
          }
          continue;
        }
        if (handleRemoteAuthLine(context, runtime, output, line)) {
          continue;
        }
        output.note(line);
        if (line.includes("WhatsApp client ready")) {
          tail.kill("SIGINT");
          resolve();
          return;
        }
      }
    });
    tail.on("error", () => resolve());
    tail.on("close", () => resolve());
  });
}

async function waitForWhatsappReady({ context, runtime }) {
  if (context.flags.noninteractive || context.flags.dryRun) return;
  await waitForContainerHealth(
    context,
    runtime,
    "wa-client",
    "WhatsApp client",
  );
}

async function waitForReverseProxy({ context, runtime, output }) {
  if (context.flags.dryRun) return;
  const token = runtime.envFile.get("CONTROL_PLANE_API_TOKEN");
  if (!token) {
    output.warn(
      "Missing CONTROL_PLANE_API_TOKEN; skipping reverse proxy health checks.",
    );
    return;
  }
  for (const target of HTTP_HEALTH_TARGETS) {
    const port =
      runtime.envFile.get(target.envPort) || String(target.defaultPort);
    const url = `http://127.0.0.1:${port}${target.path}`;
    await waitForHttp(
      context,
      target.name,
      url,
      target.requiresToken ? { Authorization: `Bearer ${token}` } : undefined,
    );
  }
}

async function waitForHttp(context, name, url, headers = {}) {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, { headers });
      if (res.ok) {
        context.log("httpHealth", { name, url, attempt });
        return;
      }
    } catch {
      // ignore
    }
    await sleep(5000);
  }
  throw new Error(
    `${name} did not become healthy at ${url}. Inspect docker compose logs.`,
  );
}

export default {
  id: "stabilize",
  title: "Wait for services",
  prerequisites: ["docker"],
  copy: {
    guided: {
      description:
        "Monitor container health and display WhatsApp pairing cues while the stack stabilises.",
    },
    expert: {
      description:
        "Waits for core services, tails WhatsApp logs, and verifies reverse proxy health.",
    },
  },
  async run({ context, runtime, output }) {
    await waitForFoundations({ context, runtime, output });
    await tailWhatsappLogs({ context, runtime, output });
    await waitForWhatsappReady({ context, runtime });
    await waitForReverseProxy({ context, runtime, output });
  },
};
