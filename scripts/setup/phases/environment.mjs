import net from "node:net";
import { execa } from "execa";

import { API_INTEGRATIONS, DEFAULT_REMOTE_AUTH_PHONE } from "../config.mjs";
import { PORT_CHECKS } from "../utils/constants.mjs";
import {
  generateHexSecret,
  generateBase64Secret,
  cleanDigits,
} from "../utils/runtime.mjs";
import { SKIP_PORT_CHECKS } from "../runtime-flags.mjs";
import { Confirm, Input } from "../utils/prompts.mjs";

async function configureSecrets({ context, runtime, output }) {
  const env = runtime.envFile;
  const ensure = (key, generator) => {
    if (!env.get(key)) {
      env.set(key, generator());
      context.recordDecision(`secret:${key}`, "generated");
    }
  };
  ensure("JWT_SECRET", generateHexSecret);
  ensure("SESSION_SECRET", () => generateBase64Secret(48));
  ensure("CONTROL_PLANE_API_TOKEN", generateHexSecret);
  ensure("WA_REMOTE_AUTH_SHARED_SECRET", generateHexSecret);
  output.success("Core secrets present.");
}

async function promptForApiKeys({ context, runtime, output }) {
  if (context.flags.noninteractive) {
    output.warn("Skipping interactive API key prompts (--noninteractive).");
    return;
  }
  const env = runtime.envFile;
  const vtInfo = API_INTEGRATIONS.find((item) => item.key === "VT_API_KEY");
  if (vtInfo) {
    output.note(`VirusTotal: ${vtInfo.docs}`);
  }
  const vt = await new Input({
    name: "vt",
    message: "VirusTotal API key (leave blank to skip)",
    initial: env.get("VT_API_KEY"),
  }).run();
  if (vt) {
    env.set("VT_API_KEY", vt);
    output.info("VirusTotal API key stored (redacted).");
    context.recordDecision("vt.apiKeyProvided", true);
  }
  const gsbInfo = API_INTEGRATIONS.find((item) => item.key === "GSB_API_KEY");
  if (gsbInfo) {
    output.note(`Google Safe Browsing: ${gsbInfo.docs}`);
  }
  const gsb = await new Input({
    name: "gsb",
    message: "Google Safe Browsing API key (leave blank to skip)",
    initial: env.get("GSB_API_KEY"),
  }).run();
  if (gsb) {
    env.set("GSB_API_KEY", gsb);
    context.recordDecision("gsb.apiKeyProvided", true);
  }
}

async function configureRemoteAuth({ context, runtime, output }) {
  const env = runtime.envFile;
  const strategy = (env.get("WA_AUTH_STRATEGY") || "remote").toLowerCase();
  if (strategy !== "remote" || context.flags.noninteractive) {
    output.info(`WhatsApp auth strategy: ${strategy}`);
    return;
  }
  output.heading("WhatsApp Remote Auth");
  const phoneInitial =
    env.get("WA_REMOTE_AUTH_PHONE_NUMBER") || DEFAULT_REMOTE_AUTH_PHONE;
  const phoneDigits = await new Input({
    name: "phone",
    message: "Phone number for pairing SMS (international format)",
    initial: phoneInitial,
    validate: (value) => {
      const digits = cleanDigits(value);
      if (digits.length < 10) return "Enter a valid international number.";
      return true;
    },
  }).run();
  env.set("WA_REMOTE_AUTH_PHONE_NUMBER", phoneDigits);
  const autopair = await new Confirm({
    name: "autopair",
    message: "Automatically request phone-number code on stack start?",
    initial:
      (env.get("WA_REMOTE_AUTH_AUTO_PAIR") || "true").toLowerCase() === "true",
  }).run();
  env.set("WA_REMOTE_AUTH_AUTO_PAIR", autopair ? "true" : "false");
  output.info(`Remote auth auto pairing: ${autopair ? "enabled" : "disabled"}`);
  context.recordDecision("remoteAuth.autoPair", autopair);
}

async function validateQueueNames({ context, runtime }) {
  const env = runtime.envFile;
  const queues = [
    "SCAN_REQUEST_QUEUE",
    "SCAN_VERDICT_QUEUE",
    "SCAN_URLSCAN_QUEUE",
  ];
  for (const key of queues) {
    const value = env.get(key);
    if (!value) throw new Error(`${key} cannot be empty.`);
    if (value.includes(":"))
      throw new Error(
        `${key} contains ':' (${value}). Use hyphen-separated names instead.`,
      );
  }
  context.log("queueValidation", { status: "ok" });
}

async function isPortInUse(port) {
  try {
    await execa("lsof", [`-iTCP:${port}`, "-sTCP:LISTEN"], { stdio: "ignore" });
    return true;
  } catch {
    try {
      const { stdout } = await execa("ss", ["-tulpn"], { stdio: "pipe" });
      if (stdout.includes(`:${port} `)) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function checkPorts({ context, output }) {
  if (SKIP_PORT_CHECKS) {
    output.warn("Skipping port collision scan (SETUP_SKIP_PORT_CHECKS=1).");
    return;
  }
  const collisions = [];
  for (const { port, label, envHint } of PORT_CHECKS) {
    if (await isPortInUse(port)) {
      collisions.push({ port, label, envHint });
    }
  }
  if (collisions.length > 0) {
    output.warn("Port conflicts detected:");
    for (const collision of collisions) {
      output.warn(
        `Port ${collision.port} (${collision.label}) already in use.`,
      );
      if (collision.envHint) {
        output.info(`Update ${collision.envHint} in .env and rerun setup.`);
      }
    }
    if (!context.flags.noninteractive) {
      await new Confirm({
        name: "continue",
        message: "Continue despite port conflicts?",
        initial: false,
      }).run();
    }
  } else {
    output.success("No blocking port collisions detected.");
  }
}

export default {
  id: "environment",
  title: "Configure environment",
  prerequisites: ["cleanup"],
  copy: {
    guided: {
      description:
        "Provision secrets, capture API keys, and configure WhatsApp Remote Auth.",
    },
    expert: {
      description: "Update .env defaults and verify queue/port configuration.",
    },
  },
  async run({ context, runtime, output }) {
    await runtime.envFile.ensure();
    await configureSecrets({ context, runtime, output });
    await promptForApiKeys({ context, runtime, output });
    await configureRemoteAuth({ context, runtime, output });
    await validateQueueNames({ context, runtime });
    await checkPorts({ context, output });
    await runtime.envFile.save();
  },
};
