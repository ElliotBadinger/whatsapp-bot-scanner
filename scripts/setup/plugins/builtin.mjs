import { registerPlugin } from "./registry.mjs";

export function registerBuiltinPlugins() {
  // WhatsApp Library Selection
  registerPlugin({
    id: "wa-library-selection",
    title: "WhatsApp Library Selection",
    description:
      "Choose between Baileys (recommended) or whatsapp-web.js (legacy).",
    stages: ["environment"],
    optional: false,
    isEnabled(context) {
      return !context.flags.noninteractive;
    },
    async run({ context, runtime, output, prompt }) {
      const env = runtime.envFile;
      const current = (env.get("WA_LIBRARY") || "baileys").toLowerCase();

      const choice = await prompt.select({
        name: "waLibrary",
        message: "Select WhatsApp library",
        choices: [
          {
            title: "Baileys (recommended)",
            value: "baileys",
            description: "Protocol-based, ~50MB RAM, no browser required",
          },
          {
            title: "whatsapp-web.js (legacy)",
            value: "wwebjs",
            description: "Browser-based, ~500MB RAM, requires Chromium",
          },
        ],
        initial: current === "wwebjs" ? 1 : 0,
      });

      env.set("WA_LIBRARY", choice);

      if (choice === "baileys") {
        output.info(
          "Using Baileys library. Why this matters: lower resource usage, faster startup, no browser dependency.",
        );
      } else {
        output.warn(
          "Using whatsapp-web.js (legacy). Consider migrating to Baileys for better performance.",
        );
      }

      context.recordDecision("wa.library", choice);
    },
  });

  registerPlugin({
    id: "urlscan-integration",
    title: "urlscan.io deep scans",
    description: "Optional SaaS integration for richer verdict context.",
    stages: ["environment"],
    optional: true,
    isEnabled(context) {
      return !context.flags.noninteractive;
    },
    async run({ context, runtime, output, prompt }) {
      const env = runtime.envFile;
      const enabled =
        (env.get("URLSCAN_ENABLED") || "false").toLowerCase() === "true";
      const choice = await prompt.confirm({
        name: "urlscanEnabled",
        message: "Enable urlscan.io submissions? (requires API key)",
        initial: enabled,
      });
      env.set("URLSCAN_ENABLED", choice ? "true" : "false");
      if (!choice) {
        output.info(
          "urlscan.io kept disabled. Enable later via ./setup.sh or .env.",
        );
        return;
      }
      const key = await prompt.input({
        name: "urlscanKey",
        message: "Enter urlscan.io API key",
        initial: env.get("URLSCAN_API_KEY") || "",
        validate: (value) =>
          value.trim().length < 32
            ? "Provide a valid token from https://urlscan.io/user/api."
            : true,
      });
      env.set("URLSCAN_API_KEY", key.trim());
      const secret = env.get("URLSCAN_CALLBACK_SECRET") || "";
      if (!secret) {
        env.set("URLSCAN_CALLBACK_SECRET", runtime.generateHexSecret());
      }
      output.info(
        "urlscan.io integration configured. Why this matters: adds screenshot + DOM artifacts.",
        {
          docs: "https://urlscan.io/docs/api/",
        },
      );
      context.recordDecision("urlscan.enabled", true);
    },
  });

  registerPlugin({
    id: "custom-docker-profile",
    title: "Custom Docker profile",
    description:
      "Advanced operators can select non-default docker compose profiles.",
    stages: ["environment"],
    optional: true,
    isEnabled(context) {
      return !context.flags.noninteractive;
    },
    async run({ context, runtime, output, prompt }) {
      const env = runtime.envFile;
      const current = env.get("DOCKER_COMPOSE_PROFILES") || "default";
      const choice = await prompt.confirm({
        name: "customProfiles",
        message: "Configure custom Docker Compose profiles?",
        initial: current !== "default",
      });
      if (!choice) {
        env.set("DOCKER_COMPOSE_PROFILES", "default");
        return;
      }
      const profiles = await prompt.input({
        name: "profiles",
        message: "Comma-separated profiles to enable",
        initial: current,
        validate: (value) =>
          value.trim().length === 0
            ? "Enter at least one profile or cancel."
            : true,
      });
      env.set(
        "DOCKER_COMPOSE_PROFILES",
        profiles
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .join(","),
      );
      output.info(
        "Docker profiles updated. Why this matters: adjust resource footprint per environment.",
        {
          docs: "docs/ARCHITECTURE.md",
        },
      );
      context.recordDecision(
        "docker.profiles",
        env.get("DOCKER_COMPOSE_PROFILES"),
      );
    },
  });
}
