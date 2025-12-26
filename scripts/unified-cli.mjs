#!/usr/bin/env node

/**
 * WhatsApp Bot Scanner - Unified CLI
 *
 * A beautifully designed terminal onboarding experience
 * with clear progress tracking and stunning visual feedback.
 */

import { program } from "commander";
import ora from "ora";
import chalk from "chalk";
import { execa } from "execa";
import fs from "fs/promises";
import path from "path";
import crypto from "node:crypto";
import { fileURLToPath } from "url";
import { PairingManager } from "./cli/core/pairing.mjs";
import { DockerOrchestrator } from "./cli/core/docker.mjs";
import { UserInterface } from "./cli/ui/prompts.mjs";
import { NotificationManager } from "./cli/ui/notifications.mjs";
import { ProgressManager } from "./cli/ui/progress.mjs";
import {
  BuildByteTracker,
  createByteProgressBar,
  formatBytes,
} from "./cli/core/build-progress.mjs";
import enquirer from "enquirer";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const MVP_COMPOSE_FILE = "docker-compose.mvp.yml";

const readEnvFile = async () =>
  fs.readFile(path.join(ROOT_DIR, ".env"), "utf-8").catch(() => "");

const resolveComposeArgsFromEnv = async () => [
  "compose",
  "-f",
  MVP_COMPOSE_FILE,
];

const resolveComposeFileFromEnv = async () => MVP_COMPOSE_FILE;

const createLineBuffer = (onLine) => {
  let buffer = "";
  const writer = (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      onLine(line);
    }
  };
  writer.flush = () => {
    if (buffer.trim().length > 0) {
      onLine(buffer);
    }
    buffer = "";
  };
  return writer;
};

// ─────────────────────────────────────────────────────────────────────────────
// Color Palette (Cohesive Design System)
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  primary: chalk.hex("#00D9FF"),
  primaryBold: chalk.hex("#00D9FF").bold,
  accent: chalk.hex("#FFB347"),
  accentBold: chalk.hex("#FFB347").bold,
  success: chalk.hex("#00E676"),
  successBold: chalk.hex("#00E676").bold,
  warning: chalk.hex("#FFD54F"),
  warningBold: chalk.hex("#FFD54F").bold,
  error: chalk.hex("#FF5252"),
  errorBold: chalk.hex("#FF5252").bold,
  muted: chalk.hex("#6B7280"),
  text: chalk.white,
  textBold: chalk.white.bold,
  code: chalk.hex("#A78BFA"),
  link: chalk.hex("#60A5FA").underline,
  highlight: chalk.bgHex("#1a2744").hex("#00ffcc").bold,
};

const ICON = {
  success: C.success("✓"),
  error: C.error("✗"),
  warning: C.warning("⚠"),
  info: C.primary("ℹ"),
  arrow: C.primary("→"),
  active: C.accent("◉"),
  pending: C.muted("○"),
  complete: C.success("●"),
  shield: "🛡️",
  docker: "🐳",
  phone: "📱",
  key: "🔑",
  gear: "⚙️",
  check: "✅",
  rocket: "🚀",
  sparkle: "✨",
};

// ─────────────────────────────────────────────────────────────────────────────
// Setup Steps Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SETUP_STEPS = [
  {
    id: "prereqs",
    name: "Prerequisites Check",
    estimate: "~10s",
    icon: ICON.gear,
  },
  { id: "config", name: "Environment Setup", estimate: "~5s", icon: ICON.gear },
  {
    id: "apikeys",
    name: "MVP Defaults",
    estimate: "~1s",
    icon: ICON.key,
  },
  {
    id: "services",
    name: "Starting Services",
    estimate: "~2-5min",
    icon: ICON.docker,
  },
  {
    id: "pairing",
    name: "WhatsApp Pairing",
    estimate: "~1min",
    icon: ICON.phone,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Graceful Exit Handler
// ─────────────────────────────────────────────────────────────────────────────

let setupCancelled = false;
process.on("SIGINT", () => {
  if (!setupCancelled) {
    setupCancelled = true;
    console.log(C.warning("\n\n⚠  Setup cancelled by user."));
    console.log(
      C.muted('Run "npx whatsapp-bot-scanner setup" to try again.\n'),
    );
    process.exit(0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Setup Wizard Class
// ─────────────────────────────────────────────────────────────────────────────

class SetupWizard {
  constructor(options = {}) {
    this.nonInteractive = !!options.nonInteractive;
    this.debug = options.debug;
    this.skipPairing = options.skipPairing;
    this.currentStep = 0;
    this.progress = new ProgressManager();
    this.state = {
      dockerVersion: null,
      nodeVersion: process.version,
      apiKey: null,
      pairingCode: null,
      rateLimited: false,
    };
  }

  async run() {
    try {
      this.displayBanner();
      this.displayStepOverview();

      await this.step1Prerequisites();
      await this.step2Configuration();
      await this.step3ApiKeys();
      await this.step4StartServices();

      if (!this.skipPairing) {
        await this.step5Pairing();
      } else {
        this.markStepSkipped(5, "Pairing skipped");
      }

      await this.displayCompletionSummary();
    } catch (error) {
      // Handle cancelled prompts gracefully
      if (error.message === "cancelled" || error.message === undefined) {
        console.log(C.warning("\n⚠  Setup cancelled."));
        process.exit(0);
      }
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Visual Components
  // ─────────────────────────────────────────────────────────────────────────────

  displayBanner() {
    const banner = `
${C.primary("  ╔═══════════════════════════════════════════════════════════════╗")}
${C.primary("  ║")}                                                               ${C.primary("║")}
${C.primary("  ║")}    ${C.primaryBold("██╗    ██╗██████╗ ███████╗  ")}${C.muted("WhatsApp Bot Scanner")}       ${C.primary("║")}
${C.primary("  ║")}    ${C.primaryBold("██║    ██║██╔══██╗██╔════╝  ")}${C.muted("─────────────────────")}       ${C.primary("║")}
${C.primary("  ║")}    ${C.primaryBold("██║ █╗ ██║██████╔╝███████╗  ")}${ICON.shield} ${C.text("Protect your groups")}       ${C.primary("║")}
${C.primary("  ║")}    ${C.primaryBold("██║███╗██║██╔══██╗╚════██║  ")}${C.text("from malicious links")}        ${C.primary("║")}
${C.primary("  ║")}    ${C.primaryBold("╚███╔███╔╝██████╔╝███████║")}                              ${C.primary("║")}
${C.primary("  ║")}    ${C.primaryBold(" ╚══╝╚══╝ ╚═════╝ ╚══════╝ ")}  ${C.accent("Setup Wizard v2.0")}         ${C.primary("║")}
${C.primary("  ║")}                                                               ${C.primary("║")}
${C.primary("  ╚═══════════════════════════════════════════════════════════════╝")}
`;
    console.log(banner);
  }

  displayStepOverview() {
    console.log(C.textBold("\n  Setup Overview:\n"));

    for (let i = 0; i < SETUP_STEPS.length; i++) {
      const step = SETUP_STEPS[i];
      const num = C.muted(`${i + 1}.`);
      const name = C.text(step.name);
      const est = C.muted(`(${step.estimate})`);
      console.log(`    ${num} ${name} ${est}`);
    }

    console.log("");
    console.log(C.muted("  ─".repeat(30)));
    console.log("");
  }

  displayStepHeader(stepNum, stepName, icon = "") {
    console.log("");
    console.log(C.muted("  ─".repeat(30)));
    console.log(
      `  ${C.accentBold(`Step ${stepNum}/5`)}  ${icon} ${C.textBold(stepName)}`,
    );
    console.log(C.muted("  ─".repeat(30)));
  }

  markStepComplete(stepNum, message) {
    console.log(`\n  ${ICON.success}  ${C.success(message)}`);
  }

  markStepSkipped(stepNum, message) {
    console.log(`\n  ${C.muted("○")}  ${C.muted(message)}`);
  }

  async isMvpMode() {
    return true;
  }

  async getComposeArgs() {
    return ["compose", "-f", MVP_COMPOSE_FILE];
  }

  async getComposeCommand() {
    const composeArgs = await this.getComposeArgs();
    return `docker ${composeArgs.join(" ")}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 1: Prerequisites
  // ─────────────────────────────────────────────────────────────────────────────

  async step1Prerequisites() {
    this.displayStepHeader(1, "Prerequisites Check", ICON.gear);

    // Check Node.js
    const spinner = ora({
      text: C.text("Checking Node.js version..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    const nodeMajor = parseInt(process.version.substring(1).split(".")[0], 10);
    if (nodeMajor < 20) {
      spinner.fail(C.error(`Node.js v20+ required. Found ${process.version}`));
      process.exit(1);
    }
    spinner.succeed(C.text(`Node.js ${process.version}`));

    // Check Docker
    const dockerSpinner = ora({
      text: C.text("Checking Docker..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    try {
      const { stdout } = await execa("docker", ["--version"]);
      this.state.dockerVersion = stdout.trim();
      dockerSpinner.succeed(C.text("Docker installed"));
    } catch {
      dockerSpinner.fail(C.error("Docker not found"));
      console.log(
        `\n  ${ICON.info}  ${C.text("Install Docker from:")} ${C.link("https://docs.docker.com/get-docker/")}`,
      );
      process.exit(1);
    }

    // Check Docker daemon
    const daemonSpinner = ora({
      text: C.text("Checking Docker daemon..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    try {
      await execa("docker", ["info"]);
      daemonSpinner.succeed(C.text("Docker daemon running"));
    } catch {
      daemonSpinner.fail(C.error("Docker daemon not running"));
      console.log(
        `\n  ${ICON.info}  ${C.text("Start Docker Desktop or run:")} ${C.code("sudo systemctl start docker")}`,
      );
      process.exit(1);
    }

    this.markStepComplete(1, "All prerequisites satisfied");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 2: Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  async step2Configuration() {
    this.displayStepHeader(2, "Configuration", ICON.gear);

    const selectedMode = "mvp";
    let selectedLibrary = "baileys";
    const envFile = path.join(ROOT_DIR, ".env");
    let existingEnvContent = "";
    let reuseExistingConfiguration = false;
    let shouldOverwrite = false;

    try {
      existingEnvContent = await fs.readFile(envFile, "utf-8");
      const existingLibrary =
        existingEnvContent.match(/WA_LIBRARY=(.*)/)?.[1]?.trim() || "";
      if (!this.nonInteractive && existingLibrary) {
        const isMvpExisting = /MVP_MODE=1/.test(existingEnvContent);
        if (!isMvpExisting) {
          const response = await enquirer.prompt({
            type: "confirm",
            name: "overwrite",
            message: C.text(
              "Existing .env is not MVP. Overwrite with MVP defaults?",
            ),
            initial: true,
          });
          shouldOverwrite = !!response.overwrite;
        }
        const response = await enquirer.prompt({
          type: "confirm",
          name: "reuse",
          message: C.text(
            "Existing .env configuration detected. Keep current configuration and skip this step?",
          ),
          initial: true,
        });
        reuseExistingConfiguration = !!response.reuse;
        if (reuseExistingConfiguration) {
          selectedLibrary = existingLibrary;
        }
      }
    } catch {
      // .env not present yet
    }

    if (
      this.nonInteractive &&
      existingEnvContent &&
      !/MVP_MODE=1/.test(existingEnvContent)
    ) {
      shouldOverwrite = true;
    }

    if (shouldOverwrite) {
      reuseExistingConfiguration = false;
    }

    const ensureMvpDefaults = async () => {
      let envContent = await fs.readFile(envFile, "utf-8").catch(() => "");
      const setValue = (key, value) => {
        if (envContent.includes(`${key}=`)) {
          envContent = envContent.replace(
            new RegExp(`${key}=.*`),
            `${key}=${value}`,
          );
        } else {
          envContent += `\n${key}=${value}`;
        }
      };
      setValue("MVP_MODE", "1");
      setValue("WA_REMOTE_AUTH_STORE", "memory");
      await fs.writeFile(envFile, envContent);
    };

    if (reuseExistingConfiguration) {
      this.state.mode = "mvp";
      this.state.library = selectedLibrary;
      await ensureMvpDefaults();
      this.markStepComplete(2, "Using existing MVP configuration");
      return;
    }

    if (this.nonInteractive) {
      console.log(
        `  ${ICON.info}  ${C.text("Non-interactive mode: using MVP configuration with Baileys")}`,
      );
    }

    if (!this.nonInteractive) {
      // WhatsApp library selection
      console.log("");
      const libResponse = await enquirer.prompt({
        type: "select",
        name: "library",
        message: C.text("Choose WhatsApp library:"),
        choices: [
          {
            name: "baileys",
            message: `${C.success("●")} Baileys ${C.muted("(Recommended: ~50MB RAM, no browser)")}`,
          },
          {
            name: "wwebjs",
            message: `${C.muted("○")} whatsapp-web.js ${C.muted("(Legacy: ~500MB RAM, needs Chromium)")}`,
          },
        ],
        pointer: C.accent("›"),
      });
      selectedLibrary = libResponse.library;

      if (selectedLibrary === "baileys") {
        console.log(
          `  ${ICON.info}  ${C.text("Using Baileys - protocol-based, lower resources, faster startup")}`,
        );
      } else {
        console.log(
          `  ${ICON.warning}  ${C.warning("Using whatsapp-web.js - consider Baileys for better performance")}`,
        );
      }
    }

    this.state.mode = selectedMode;
    this.state.library = selectedLibrary;

    const templateFile = path.join(ROOT_DIR, ".env.mvp.example");

    const envSpinner = ora({
      text: C.text("Setting up environment..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    const envExists = await fs
      .access(envFile)
      .then(() => true)
      .catch(() => false);

    if (envExists && !shouldOverwrite) {
      envSpinner.succeed(
        C.text(".env file found, using existing configuration"),
      );
    } else {
      try {
        await fs.copyFile(templateFile, envFile);
        envSpinner.succeed(
          C.text(`.env created from ${path.basename(templateFile)}`),
        );
      } catch {
        envSpinner.warn(
          C.warning("Could not find template, creating minimal .env"),
        );
        await fs.writeFile(envFile, "# WhatsApp Bot Scanner Configuration\n");
      }
    }

    // Update WA_LIBRARY and WA_BUILD_TARGET in .env
    const buildTarget =
      selectedLibrary === "baileys" ? "wa-client-baileys" : "wa-client";
    try {
      let envContent = await fs.readFile(envFile, "utf-8");

      // Update WA_LIBRARY
      if (envContent.includes("WA_LIBRARY=")) {
        envContent = envContent.replace(
          /WA_LIBRARY=.*/,
          `WA_LIBRARY=${selectedLibrary}`,
        );
      } else {
        envContent += `\nWA_LIBRARY=${selectedLibrary}`;
      }

      // Update WA_BUILD_TARGET (for Docker build)
      if (envContent.includes("WA_BUILD_TARGET=")) {
        envContent = envContent.replace(
          /WA_BUILD_TARGET=.*/,
          `WA_BUILD_TARGET=${buildTarget}`,
        );
      } else {
        envContent += `\nWA_BUILD_TARGET=${buildTarget}`;
      }

      await fs.writeFile(envFile, envContent);
      console.log(
        `  ${ICON.success}  ${C.success(`WA_LIBRARY set to ${selectedLibrary}`)}`,
      );
      console.log(
        `  ${ICON.success}  ${C.success(`Docker target set to ${buildTarget}`)}`,
      );
      await ensureMvpDefaults();
    } catch (err) {
      console.log(
        `  ${ICON.warning}  ${C.warning("Could not update WA_LIBRARY in .env")}`,
      );
    }

    this.markStepComplete(
      2,
      `Configuration set to ${selectedMode} mode with ${selectedLibrary}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 3: API Keys & Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  async step3ApiKeys() {
    this.displayStepHeader(3, "MVP Defaults", ICON.key);

    if (await this.isMvpMode()) {
      this.markStepSkipped(3, "MVP defaults applied");
      return;
    }

    const envFile = path.join(ROOT_DIR, ".env");
    let envContent = await fs.readFile(envFile, "utf-8");
    let configChanged = false;

    // Helper to get env value
    const getEnvValue = (key) => {
      const match = envContent.match(new RegExp(`${key}=(.*)`));
      return match ? match[1].trim() : "";
    };

    // Helper to set env value
    const setEnvValue = (key, value) => {
      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(
          new RegExp(`${key}=.*`),
          `${key}=${value}`,
        );
      } else {
        envContent += `\n${key}=${value}`;
      }
      configChanged = true;
    };

    // Helper to mask sensitive values
    const maskValue = (value, visibleChars = 4) => {
      if (!value || value.length <= visibleChars) return value || "(empty)";
      return (
        "*".repeat(Math.min(value.length - visibleChars, 20)) +
        value.slice(-visibleChars)
      );
    };

    // Helper to generate secrets (mirrors scripts/setup/orchestrator.mjs)
    const generateHexSecret = (bytes = 32) =>
      crypto.randomBytes(bytes).toString("hex");
    const generateBase64Secret = (bytes = 32) =>
      crypto.randomBytes(bytes).toString("base64");

    // Helper to auto-generate core secrets if missing
    const ensureSecret = (key, generator) => {
      const current = getEnvValue(key);
      if (!current) {
        const value = generator();
        setEnvValue(key, value);
        console.log(
          `  ${ICON.success}  ${C.success(`${key} generated and stored (redacted)`)}`,
        );
      }
    };

    // Helper to ensure non-secret config defaults
    const ensureConfigDefaults = () => {
      const sqlitePath = getEnvValue("SQLITE_DB_PATH");
      if (!sqlitePath) {
        // Default for Dockerised pipeline; can be overridden for local dev
        setEnvValue("SQLITE_DB_PATH", "/app/storage/wbscanner.db");
        console.log(
          `  ${ICON.info}  ${C.text("SQLITE_DB_PATH set to default: /app/storage/wbscanner.db")}`,
        );
      }
    };

    // Auto-generate required secrets and config before prompting
    ensureSecret("JWT_SECRET", () => generateHexSecret());
    ensureSecret("SESSION_SECRET", () => generateBase64Secret(48));
    ensureSecret("CONTROL_PLANE_API_TOKEN", () => generateHexSecret());
    ensureSecret("WA_REMOTE_AUTH_SHARED_SECRET", () => generateHexSecret());
    ensureSecret("WA_REMOTE_AUTH_DATA_KEY", () => generateBase64Secret(32));
    ensureConfigDefaults();

    const currentVt = getEnvValue("VT_API_KEY");
    const currentPhone = getEnvValue("WA_REMOTE_AUTH_PHONE_NUMBERS");
    const vtLooksValid = currentVt && currentVt.length >= 32;
    const normalizedPhone = (currentPhone || "").replace(/[^\d+]/g, "");
    const phoneLooksValid = /^\+?[1-9]\d{9,14}$/.test(normalizedPhone);

    if (!this.nonInteractive && vtLooksValid && phoneLooksValid) {
      const response = await enquirer.prompt({
        type: "confirm",
        name: "reuse",
        message: C.text(
          "Validated configuration detected. Keep existing values and skip re-confirmation?",
        ),
        initial: true,
      });

      if (response.reuse) {
        this.state.apiKey = currentVt;
        this.state.phone = normalizedPhone;
        if (configChanged) {
          await fs.writeFile(envFile, envContent);
        }
        this.markStepComplete(3, "Configuration complete");
        return;
      }
    }

    // Helper to prompt for value with keep/change option
    const promptConfigValue = async (options) => {
      const {
        key,
        label,
        currentValue,
        required,
        type = "input",
        hint = null,
        validate = null,
      } = options;

      if (this.nonInteractive) {
        if (required && !currentValue) {
          throw new Error(
            `${key} is required. Set it in .env before running with --noninteractive`,
          );
        }
        return currentValue;
      }

      const hasValue = !!currentValue;
      const maskedCurrent =
        type === "password" ? maskValue(currentValue) : currentValue;

      if (hasValue) {
        // Show current value and ask if user wants to change it
        console.log(
          `\n  ${ICON.info}  ${C.text(`${label}:`)} ${C.muted(maskedCurrent)}`,
        );

        const { action } = await enquirer.prompt({
          type: "select",
          name: "action",
          message: C.text(`What would you like to do with ${label}?`),
          choices: [
            {
              name: "keep",
              message: `${C.success("●")} Keep current value ${C.muted(`(${maskedCurrent})`)}`,
            },
            { name: "change", message: `${C.accent("○")} Enter new value` },
            ...(required
              ? []
              : [
                  {
                    name: "clear",
                    message: `${C.muted("○")} Clear/remove value`,
                  },
                ]),
          ],
          pointer: C.accent("›"),
        });

        if (action === "keep") {
          console.log(`  ${ICON.success}  ${C.text(`${label} unchanged`)}`);
          return currentValue;
        }

        if (action === "clear") {
          setEnvValue(key, "");
          console.log(`  ${ICON.success}  ${C.text(`${label} cleared`)}`);
          return "";
        }
      } else {
        // No existing value
        if (hint) {
          console.log(`\n  ${ICON.info}  ${C.text(hint)}`);
        }
      }

      // Prompt for new value
      const promptOptions = {
        type: type,
        name: "value",
        message: C.text(`Enter ${label}:`),
        validate:
          validate ||
          (required
            ? (v) => (v.trim() ? true : `${label} is required`)
            : undefined),
      };

      const response = await enquirer.prompt(promptOptions);
      const newValue = response.value.trim();

      if (newValue || !required) {
        setEnvValue(key, newValue);
        console.log(
          `  ${ICON.success}  ${C.success(`${label} ${hasValue ? "updated" : "saved"}`)}`,
        );
      }

      return newValue;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Configure VirusTotal API Key (Required)
    // ─────────────────────────────────────────────────────────────────────────

    const vtKey = await promptConfigValue({
      key: "VT_API_KEY",
      label: "VirusTotal API Key",
      currentValue: getEnvValue("VT_API_KEY"),
      required: true,
      type: "password",
      hint: `VirusTotal API key is required for URL scanning\n     ${C.muted("Get a free key at:")} ${C.link("https://www.virustotal.com/gui/join-us")}`,
      validate: (v) =>
        v.length >= 32 ? true : "API key should be at least 32 characters",
    });
    this.state.apiKey = vtKey;

    // ─────────────────────────────────────────────────────────────────────────
    // Configure WhatsApp Phone Number (Required)
    // ─────────────────────────────────────────────────────────────────────────

    const phone = await promptConfigValue({
      key: "WA_REMOTE_AUTH_PHONE_NUMBERS",
      label: "WhatsApp Phone Number",
      currentValue: getEnvValue("WA_REMOTE_AUTH_PHONE_NUMBERS"),
      required: true,
      type: "input",
      hint: `Phone number for WhatsApp pairing\n     ${C.muted("Format: country code + number (e.g., 27123456789)")}`,
      validate: (value) => {
        if (!value.trim()) return "Phone number is required";
        const normalized = value.replace(/[\s\-()]/g, "");
        if (!/^\+?[1-9]\d{9,14}$/.test(normalized)) {
          return "Invalid format. Use: country code + number (e.g., 27123456789)";
        }
        return true;
      },
    });
    this.state.phone = phone.replace(/[\s\-()]/g, "");

    // ─────────────────────────────────────────────────────────────────────────
    // Optional: Configure Additional API Keys
    // ─────────────────────────────────────────────────────────────────────────

    if (!this.nonInteractive) {
      const { configureOptional } = await enquirer.prompt({
        type: "confirm",
        name: "configureOptional",
        message: C.text(
          "Configure optional API keys? (Google Safe Browsing, urlscan.io)",
        ),
        initial: false,
      });

      if (configureOptional) {
        // Google Safe Browsing API Key
        await promptConfigValue({
          key: "GSB_API_KEY",
          label: "Google Safe Browsing API Key",
          currentValue: getEnvValue("GSB_API_KEY"),
          required: false,
          type: "password",
          hint: `Optional: Adds Google Safe Browsing verdicts\n     ${C.muted("Get a key at:")} ${C.link("https://developers.google.com/safe-browsing")}`,
        });

        // urlscan.io API Key
        await promptConfigValue({
          key: "URLSCAN_API_KEY",
          label: "urlscan.io API Key",
          currentValue: getEnvValue("URLSCAN_API_KEY"),
          required: false,
          type: "password",
          hint: `Optional: Enables rich urlscan.io submissions\n     ${C.muted("Get a free key at:")} ${C.link("https://urlscan.io/user/profile")}`,
        });

        // Enable urlscan if key was provided
        if (getEnvValue("URLSCAN_API_KEY")) {
          setEnvValue("URLSCAN_ENABLED", "true");
        }
      }
    }

    // Save changes if any were made
    if (configChanged) {
      await fs.writeFile(envFile, envContent);
    }

    this.markStepComplete(3, "Configuration complete");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 4: Start Services
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a port is available
   */
  async checkPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          resolve(false);
        } else {
          resolve(true);
        }
      });
      server.once("listening", () => {
        server.close();
        resolve(true);
      });
      server.listen(port, "0.0.0.0");
    });
  }

  /**
   * Check if existing Docker containers are running
   */
  async checkExistingContainers() {
    try {
      const composeArgs = await this.getComposeArgs();
      const { stdout } = await execa(
        "docker",
        [...composeArgs, "ps", "--format", "{{.Name}} {{.State}}"],
        { cwd: ROOT_DIR },
      );
      const running = stdout
        .trim()
        .split("\n")
        .filter((line) => line.includes("running"));
      return running.length > 0;
    } catch {
      return false;
    }
  }

  async getContainerStatus() {
    const composeArgs = await this.getComposeArgs();
    try {
      const { stdout } = await execa(
        "docker",
        [...composeArgs, "ps", "--format", "json"],
        { cwd: ROOT_DIR },
      );
      if (!stdout.trim()) return [];
      const parsed = JSON.parse(stdout.trim());
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      return entries.map((entry) => ({
        service: entry.Service || entry.Name || "unknown",
        state: String(entry.State || "").toLowerCase(),
        health: String(entry.Health || "").toLowerCase(),
      }));
    } catch {
      try {
        const { stdout } = await execa(
          "docker",
          [
            ...composeArgs,
            "ps",
            "--format",
            "{{.Service}}|{{.State}}|{{.Health}}",
          ],
          { cwd: ROOT_DIR },
        );
        if (!stdout.trim()) return [];
        return stdout
          .trim()
          .split("\n")
          .map((line) => {
            const [service, state, health] = line.split("|");
            return {
              service: service || "unknown",
              state: String(state || "").toLowerCase(),
              health: String(health || "").toLowerCase(),
            };
          });
      } catch {
        return [];
      }
    }
  }

  /**
   * Stop existing Docker containers
   */
  async stopExistingContainers() {
    try {
      const composeArgs = await this.getComposeArgs();
      await execa("docker", [...composeArgs, "down"], { cwd: ROOT_DIR });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check all required ports and report conflicts
   */
  async checkRequiredPorts() {
    // Read both .env and .env.local - Docker Compose loads both with .env.local taking precedence
    const envFile = path.join(ROOT_DIR, ".env");
    const envLocalFile = path.join(ROOT_DIR, ".env.local");
    let envContent = "";
    let envLocalContent = "";
    try {
      envContent = await fs.readFile(envFile, "utf-8");
    } catch {
      // File doesn't exist yet
    }
    try {
      envLocalContent = await fs.readFile(envLocalFile, "utf-8");
    } catch {
      // File doesn't exist
    }

    // Get port from env files (.env.local takes precedence, matching Docker Compose behavior)
    const getPort = (key, defaultPort) => {
      // Check .env.local first (takes precedence)
      const localMatch = envLocalContent.match(
        new RegExp(`${key}=["']?(\\d+)["']?`),
      );
      if (localMatch) {
        return Number.parseInt(localMatch[1], 10);
      }
      // Fall back to .env
      const match = envContent.match(new RegExp(`${key}=(\\d+)`));
      return Number.parseInt(match?.[1] ?? defaultPort, 10);
    };

    const ports = [
      {
        name: "WA Client",
        port: getPort("WA_CLIENT_PORT", "3005"),
        env: "WA_CLIENT_PORT",
      },
    ];

    // Store all configured ports to avoid conflicts during reassignment
    this._allConfiguredPorts = new Set(ports.map((p) => p.port));

    const conflicts = [];

    for (const { name, port, env } of ports) {
      const available = await this.checkPortAvailable(port);
      if (!available) {
        conflicts.push({ name, port, env });
      }
    }

    return conflicts;
  }

  /**
   * Auto-reassign ports for conflicting services
   */
  async resolvePortConflicts(conflicts) {
    // Update both .env and .env.local to ensure consistency
    const envFile = path.join(ROOT_DIR, ".env");
    const envLocalFile = path.join(ROOT_DIR, ".env.local");
    let envContent = await fs.readFile(envFile, "utf-8").catch(() => "");
    let envLocalContent = await fs
      .readFile(envLocalFile, "utf-8")
      .catch(() => "");
    let modified = false;
    let localModified = false;
    let allResolved = true;

    // Track ports already assigned in this resolution cycle to avoid duplicates
    const assignedPorts = new Set(this._allConfiguredPorts || []);

    for (const { name, port, env } of conflicts) {
      // Skip hardcoded ports (env is null) - these cannot be reassigned
      if (!env) {
        console.log(
          `  ${ICON.error}  ${C.error(`Port ${port} (${name}) is hardcoded and cannot be reassigned.`)}`,
        );
        console.log(
          `  ${ICON.info}  ${C.text(`Stop the process using port ${port} and try again.`)}`,
        );
        allResolved = false;
        continue;
      }

      // Find an available alternative port that:
      // 1. Is not in use on the system
      // 2. Has not been assigned to another service in this batch
      let altPort = port + 1;
      while (altPort < port + 100) {
        const systemAvailable = await this.checkPortAvailable(altPort);
        const notAlreadyAssigned = !assignedPorts.has(altPort);
        if (systemAvailable && notAlreadyAssigned) {
          break;
        }
        altPort++;
      }

      if (altPort >= port + 100) {
        console.log(
          `  ${ICON.error}  ${C.error(`Could not find available port for ${name}`)}`,
        );
        allResolved = false;
        continue;
      }

      // Mark this port as assigned
      assignedPorts.add(altPort);

      // Auto-reassign in .env
      if (envContent.includes(`${env}=`)) {
        envContent = envContent.replace(
          new RegExp(`${env}=.*`),
          `${env}=${altPort}`,
        );
      } else {
        envContent += `\n${env}=${altPort}`;
      }
      modified = true;

      // Also update .env.local if it contains this setting (to keep them in sync)
      if (envLocalContent.includes(`${env}=`)) {
        envLocalContent = envLocalContent.replace(
          new RegExp(`${env}=["']?\\d+["']?`),
          `${env}="${altPort}"`,
        );
        localModified = true;
      }

      console.log(
        `  ${ICON.success}  ${C.success(`${name} auto-reassigned from port ${port} to ${altPort}`)}`,
      );
    }

    if (modified) {
      await fs.writeFile(envFile, envContent);
    }
    if (localModified) {
      await fs.writeFile(envLocalFile, envLocalContent);
    }

    return allResolved;
  }

  async buildImagesWithByteProgress(composeArgs) {
    const showBar = process.stdout.isTTY && !this.nonInteractive;
    const tracker = new BuildByteTracker();
    const env = {
      ...process.env,
      DOCKER_BUILDKIT: "1",
      BUILDKIT_PROGRESS: "rawjson",
    };
    const barLabel = "Downloading layers";
    const barFormat = `${C.primary(barLabel)} |{bar}| {percentage}% | {transferred}/{total}`;
    let bar = null;
    let barTotal = 0;
    let lastUpdate = 0;
    const updateBar = (totals) => {
      const now = Date.now();
      if (now - lastUpdate < 80) return;
      lastUpdate = now;
      const totalBytes = Math.max(0, totals.totalBytes);
      const currentBytes = Math.max(0, totals.currentBytes);
      if (totalBytes <= 0) return;
      if (!bar) {
        bar = createByteProgressBar(barFormat);
        bar.start(totalBytes, currentBytes, {
          transferred: formatBytes(currentBytes),
          total: formatBytes(totalBytes),
        });
        barTotal = totalBytes;
      } else {
        if (totalBytes !== barTotal) {
          bar.setTotal(totalBytes);
          barTotal = totalBytes;
        }
        bar.update(currentBytes, {
          transferred: formatBytes(currentBytes),
          total: formatBytes(totalBytes),
        });
      }
    };

    const buildSpinner = ora({
      text: C.text("Building Docker image..."),
      color: "cyan",
      spinner: "dots12",
    }).start();
    let spinnerActive = true;
    let spinnerTimer = null;
    const spinnerStart = Date.now();
    const stopSpinnerForBar = () => {
      if (buildSpinner && spinnerActive) {
        buildSpinner.stop();
        spinnerActive = false;
      }
    };

    const onLine = (line) => {
      const totals = tracker.updateFromLine(line);
      if (totals && showBar) {
        stopSpinnerForBar();
        updateBar(totals);
      }
    };
    const onChunk = createLineBuffer(onLine);

    try {
      spinnerTimer = setInterval(() => {
        if (!spinnerActive) return;
        const elapsed = Math.round((Date.now() - spinnerStart) / 1000);
        buildSpinner.text = C.text(`Building Docker image... (${elapsed}s)`);
      }, 2000);

      const child = execa("docker", [...composeArgs, "build"], {
        cwd: ROOT_DIR,
        env,
      });
      child.stdout?.on("data", onChunk);
      child.stderr?.on("data", onChunk);
      await child;
      onChunk.flush();
      if (bar) {
        bar.update(barTotal, {
          transferred: formatBytes(barTotal),
          total: formatBytes(barTotal),
        });
        bar.stop();
        bar = null;
      }
      if (buildSpinner && spinnerActive) {
        buildSpinner.succeed(C.text("Image build complete"));
      } else if (buildSpinner) {
        buildSpinner.stop();
      }
    } catch (error) {
      onChunk.flush();
      if (bar) {
        bar.stop();
      }
      if (buildSpinner && spinnerActive) {
        buildSpinner.fail(C.error("Image build failed"));
      } else if (buildSpinner) {
        buildSpinner.stop();
      }
      throw error;
    } finally {
      if (spinnerTimer) {
        clearInterval(spinnerTimer);
      }
    }
  }

  async step4StartServices() {
    this.displayStepHeader(4, "Starting Services", ICON.docker);

    const isMvp = await this.isMvpMode();
    const composeArgs = await this.getComposeArgs();

    // First, check if existing containers are running and decide whether to restart
    const existingSpinner = ora({
      text: C.text("Checking for existing containers..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    const hasExisting = await this.checkExistingContainers();
    const existingStatus = hasExisting ? await this.getContainerStatus() : [];
    const hasIssues = existingStatus.some((entry) => {
      const state = entry.state || "";
      const health = entry.health || "";
      return (state && state !== "running") || health === "unhealthy";
    });
    let reusedRunning = false;

    if (hasExisting && !hasIssues) {
      existingSpinner.succeed(
        C.text("Existing containers healthy; reusing without restart"),
      );
      reusedRunning = true;
    } else if (hasExisting) {
      existingSpinner.text = C.text("Stopping existing containers...");
      await this.stopExistingContainers();
      existingSpinner.succeed(C.text("Stopped existing containers"));
      // Wait a moment for ports to be released
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      existingSpinner.succeed(C.text("No existing containers running"));
    }

    if (!reusedRunning) {
      // Check for port conflicts
      const portSpinner = ora({
        text: C.text("Checking for port conflicts..."),
        color: "cyan",
        spinner: "dots12",
      }).start();

      const conflicts = await this.checkRequiredPorts();

      if (conflicts.length > 0) {
        portSpinner.warn(C.warning(`Found ${conflicts.length} port conflict(s)`));
        const resolved = await this.resolvePortConflicts(conflicts);
        if (!resolved) {
          throw new Error(
            "Cannot start services due to unresolved port conflicts. " +
              "Stop conflicting processes or modify port settings.",
          );
        }
      } else {
        portSpinner.succeed(C.text("All ports available"));
      }

      await this.buildImagesWithByteProgress(composeArgs);

      console.log(
        `\n  ${C.muted(isMvp ? "This may take a minute on first run..." : "This may take 2-5 minutes on first run...")}\n`,
      );

      const spinner = ora({
        text: C.text("Starting Docker containers..."),
        color: "cyan",
        spinner: "dots12",
      }).start();

      try {
        // Ensure images are rebuilt so freshly pulled source changes are reflected
        // (Codespaces frequently has stale images even after `git pull`).
        await execa("docker", [...composeArgs, "up", "-d"], {
          cwd: ROOT_DIR,
        });
        spinner.succeed(C.text("Containers started"));
      } catch (error) {
        spinner.fail(C.error("Failed to start containers"));
        console.log(
          `\n  ${ICON.info}  ${C.text("Try running:")} ${C.code(`docker ${composeArgs.join(" ")} logs`)}`,
        );
        throw error;
      }
    }

    // Wait for core services (Redis) to be healthy, but not wa-client
    // wa-client needs WhatsApp pairing (Step 5) before it can be fully healthy
    const healthSpinner = ora({
      text: C.text("Waiting for wa-client HTTP server..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    // For wa-client, just wait for HTTP server to be accessible (not full health)
    const waClientReady = await this.waitForWaClientHttp(healthSpinner, 90000);
    if (!waClientReady.ready) {
      healthSpinner.warn(
        C.warning("WA Client starting slowly, proceeding to pairing..."),
      );
    } else {
      healthSpinner.succeed(C.text("Services ready for pairing"));
    }

    this.state.rateLimited = waClientReady.rateLimited;
    this.markStepComplete(4, "All services running");
  }

  /**
   * Wait for wa-client HTTP server to be accessible (not full health)
   * This allows proceeding to pairing step even if WhatsApp isn't connected yet
   */
  async waitForWaClientHttp(spinner, timeoutMs = 90000) {
    const startTime = Date.now();
    let rateLimited = false;
    let crashLoop = false;
    const composeArgs = await this.getComposeArgs();

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Run the check *inside the container*.
        // wa-client is not always port-mapped to the host, especially in Codespaces.
        await execa(
          "docker",
          [
            ...composeArgs,
            "exec",
            "-T",
            "wa-client",
            "node",
            "-e",
            "const p=process.env.WA_HTTP_PORT||'3001'; fetch('http://127.0.0.1:'+p+'/healthz',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));",
          ],
          { cwd: ROOT_DIR },
        );

        // If the exec succeeds, the HTTP server is up.
        // Check logs for crash-loop or rate limiting signals.
        try {
          const { stdout: logs } = await execa(
            "docker",
            [...composeArgs, "logs", "--tail=80", "wa-client"],
            { cwd: ROOT_DIR },
          );

          if (
            logs.includes("qrTerminal.generate is not a function") ||
            logs.includes("exited with code")
          ) {
            crashLoop = true;
          }

          if (logs.includes("rate-overlimit") || logs.includes("rate_limit")) {
            rateLimited = true;
          }
        } catch {}

        if (crashLoop) {
          return { ready: false, rateLimited, crashLoop: true };
        }

        return { ready: true, rateLimited };
      } catch {
        // Not ready yet (container not running, exec failed, or HTTP not up)
      }

      spinner.text = C.text(
        `Waiting for wa-client HTTP server... (${Math.round((Date.now() - startTime) / 1000)}s)`,
      );
      await new Promise((r) => setTimeout(r, 2000));
    }

    return { ready: false, rateLimited, crashLoop };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 5: WhatsApp Pairing
  // ─────────────────────────────────────────────────────────────────────────────

  async step5Pairing() {
    this.displayStepHeader(5, "WhatsApp Pairing", ICON.phone);

    if (this.state.rateLimited) {
      console.log(
        `\n  ${ICON.warning}  ${C.warning("WhatsApp is rate-limiting pairing requests")}`,
      );
      console.log(
        `     ${C.muted("Wait 15 minutes and run:")} ${C.code("npx whatsapp-bot-scanner pair")}`,
      );
      return;
    }

    // Read env to check if phone number is configured
    const envContent = await fs
      .readFile(path.join(ROOT_DIR, ".env"), "utf-8")
      .catch(() => "");
    const hasPhoneNumber =
      envContent.includes("WA_REMOTE_AUTH_PHONE_NUMBERS=") &&
      !envContent.match(/WA_REMOTE_AUTH_PHONE_NUMBERS=\s*$/m);

    // Let user choose pairing method
    // Default to pairing code for non-interactive (more reliable than QR in Docker)
    let pairingMethod = hasPhoneNumber ? "code" : "qr";

    if (!this.nonInteractive) {
      console.log("");
      const response = await enquirer.prompt({
        type: "select",
        name: "method",
        message: C.text("Choose WhatsApp pairing method:"),
        choices: [
          {
            name: "code",
            message: `${C.success("●")} Pairing Code ${C.muted("(Enter 8-digit code on phone)")}`,
            disabled: !hasPhoneNumber
              ? C.muted("(requires phone number in config)")
              : false,
          },
          {
            name: "qr",
            message: `${C.accent("●")} QR Code ${C.muted("(Scan with WhatsApp camera)")}`,
          },
          {
            name: "skip",
            message: `${C.muted("○")} Skip for now ${C.muted("(pair later)")}`,
          },
        ],
        pointer: C.accent("›"),
      });
      pairingMethod = response.method;
    }

    if (pairingMethod === "skip") {
      console.log(
        `\n  ${ICON.info}  ${C.text("Skipped. Pair later with:")} ${C.code("npx whatsapp-bot-scanner pair")}`,
      );
      this.markStepComplete(5, "Pairing skipped (you can pair later)");
      return;
    }

    const paired =
      pairingMethod === "code"
        ? await this.requestPairingCode()
        : await this.showQRPairing();

    if (paired) {
      this.markStepComplete(5, "WhatsApp pairing successful");
    } else {
      this.markStepSkipped(
        5,
        "WhatsApp pairing not completed (you can pair later)",
      );
    }
  }

  /**
   * Get the wa-client port from env files
   */
  async getWaClientPort() {
    const envContent = await fs
      .readFile(path.join(ROOT_DIR, ".env"), "utf-8")
      .catch(() => "");
    const envLocalContent = await fs
      .readFile(path.join(ROOT_DIR, ".env.local"), "utf-8")
      .catch(() => "");
    const localMatch = envLocalContent.match(/WA_CLIENT_PORT=["']?(\d+)["']?/);
    const match = envContent.match(/WA_CLIENT_PORT=(\d+)/);
    const httpMatch = envContent.match(/WA_HTTP_PORT=(\d+)/);
    return localMatch?.[1] || match?.[1] || httpMatch?.[1] || "3005";
  }

  async waClientHttpJson(endpoint, options = {}) {
    const method = options.method || "GET";
    const body = options.body ?? null;
    const timeoutMs = options.timeoutMs || 5000;
    const composeArgs = await this.getComposeArgs();

    const endpointSafe = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    const bodyLiteral = body ? JSON.stringify(body) : "null";
    const nodeScript = [
      "(async()=>{",
      "try{",
      "const p=process.env.WA_HTTP_PORT||'3001';",
      `const u='http://127.0.0.1:'+p+'${endpointSafe}';`,
      "const ctrl=AbortSignal.timeout(" + Number(timeoutMs) + ");",
      "const payload=" + bodyLiteral + ";",
      "const res=await fetch(u,{method:'" +
        method +
        "',headers:{'Content-Type':'application/json'},body:(payload?JSON.stringify(payload):undefined),signal:ctrl});",
      "const text=await res.text().catch(()=> '');",
      "console.log(JSON.stringify({ok:res.ok,status:res.status,body:text}));",
      "}catch(e){console.log(JSON.stringify({ok:false,error:String(e)}));}",
      "})();",
    ].join("");

    try {
      const { stdout } = await execa(
        "docker",
        [...composeArgs, "exec", "-T", "wa-client", "node", "-e", nodeScript],
        { cwd: ROOT_DIR },
      );
      return JSON.parse(stdout.trim());
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Wait for wa-client to be in connecting state (ready to accept pairing)
   */
  async waitForConnectingState(port, spinner, timeoutMs = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const res = await this.waClientHttpJson("/state", { timeoutMs: 5000 });
        if (res.ok && res.body) {
          const data = JSON.parse(res.body);
          if (data.state === "connecting")
            return { ready: true, state: data.state };
          if (data.state === "ready") {
            return { ready: true, state: data.state, alreadyConnected: true };
          }
        }
      } catch {
        // Service not ready yet
      }
      spinner.text = C.text(
        `Waiting for wa-client to be ready... (${Math.round((Date.now() - startTime) / 1000)}s)`,
      );
      await new Promise((r) => setTimeout(r, 1000));
    }
    return { ready: false };
  }

  /**
   * Request a pairing code from the wa-client service
   */
  async requestPairingCode() {
    const spinner = ora({
      text: C.text("Preparing pairing code request..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    try {
      const composeCmd = await this.getComposeCommand();
      const stateResult = await this.waitForConnectingState(null, spinner);

      if (stateResult.alreadyConnected) {
        spinner.succeed(C.success("WhatsApp is already connected!"));
        return true;
      }

      if (!stateResult.ready) {
        spinner.fail(C.error("wa-client not ready for pairing"));
        console.log(
          `  ${ICON.info}  ${C.text("Restart services and try again:")} ${C.code(`${composeCmd} restart wa-client`)}`,
        );
        return false;
      }

      spinner.text = C.text("Requesting pairing code...");

      // Retry logic for pairing code request (more retries since socket needs time to connect)
      let lastError = null;
      const maxAttempts = 20; // Socket may need time to stabilize after logout
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await this.waClientHttpJson("/pair", {
            method: "POST",
            body: {},
            timeoutMs: 8000,
          });

          const data = response.body ? JSON.parse(response.body) : {};

          // Success - got pairing code
          if (response.ok && data.success && data.code) {
            spinner.stop();
            this.displayPairingCode(data.code);

            // Start polling for connection success
            const paired = await this.pollForPairingSuccess(null, data.code);
            return paired;
          }

          // Already connected
          if (
            response.ok &&
            data.success &&
            data.error?.includes("Already connected")
          ) {
            spinner.succeed(C.success("WhatsApp is already connected!"));
            return true;
          }

          // Socket still connecting - retry after delay
          if (response.status === 202 && data.retryAfterMs) {
            spinner.text = C.text(
              `Socket connecting... (${attempt}/${maxAttempts})`,
            );
            await new Promise((r) => setTimeout(r, data.retryAfterMs));
            continue;
          }

          // Check for rate limiting
          if (response.status === 429 || data.error?.includes("rate")) {
            spinner.fail(C.error("Rate limited by WhatsApp"));
            console.log(
              `  ${ICON.warning}  ${C.warning("Wait 15 minutes before trying again.")}`,
            );
            console.log(
              `  ${ICON.info}  ${C.text("Try QR code instead:")} ${C.code(`${composeCmd} logs -f wa-client`)}`,
            );
            return false;
          }

          // Connection Closed is transient - socket is reconnecting, wait and retry
          if (
            data.error?.includes("Connection Closed") ||
            data.error?.includes("Socket not connected")
          ) {
            spinner.text = C.text(
              `Socket reconnecting... (${attempt}/${maxAttempts})`,
            );
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          lastError = new Error(data.error || `HTTP ${response.status}`);
        } catch (err) {
          lastError = err;
        }

        if (attempt < maxAttempts) {
          spinner.text = C.text(
            `Waiting for socket... (${attempt + 1}/${maxAttempts})`,
          );
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      throw (
        lastError ||
        new Error("Failed to get pairing code - socket did not become ready")
      );
    } catch (error) {
      spinner.fail(C.error(`Pairing code request failed: ${error.message}`));
      console.log(
        `  ${ICON.info}  ${C.text("Try QR code instead, or retry later with:")} ${C.code("npx whatsapp-bot-scanner pair")}`,
      );
      return false;
    }
  }

  /**
   * Poll for pairing success after displaying code
   */
  async pollForPairingSuccess(port, code) {
    console.log(
      `  ${ICON.info}  ${C.muted("Enter the code on your phone. Waiting for connection...")}`,
    );

    const spinner = ora({
      text: C.text("Waiting for WhatsApp connection..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    const startTime = Date.now();
    const timeoutMs = 180000; // 3 minutes

    while (Date.now() - startTime < timeoutMs) {
      try {
        const res = await this.waClientHttpJson("/state", { timeoutMs: 5000 });
        if (res.ok && res.body) {
          const data = JSON.parse(res.body);
          if (data.state === "ready") {
            spinner.succeed(C.success("WhatsApp connected successfully!"));
            return true;
          }
        }
      } catch {
        // Continue polling
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.max(
        0,
        Math.round((timeoutMs - (Date.now() - startTime)) / 1000),
      );
      spinner.text = C.text(
        `Waiting for connection... (${remaining}s remaining)`,
      );
      await new Promise((r) => setTimeout(r, 3000));
    }

    spinner.warn(C.warning("Pairing timeout - code may have expired"));
    console.log(
      `  ${ICON.info}  ${C.text("Request a new code:")} ${C.code("npx whatsapp-bot-scanner pair")}`,
    );
    return false;
  }

  /**
   * Show QR code pairing by fetching from HTTP endpoint
   */
  async showQRPairing() {
    console.log(`
  ${C.textBold("QR Code Pairing Instructions:")}

  ${ICON.arrow}  A QR code will appear below (may take a moment)
  ${ICON.arrow}  Open WhatsApp on your phone
  ${ICON.arrow}  Go to Settings → Linked Devices → Link a Device
  ${ICON.arrow}  Scan the QR code with your phone camera

  ${C.muted("The QR code refreshes every ~20 seconds. Press Ctrl+C when done.")}
`);

    const spinner = ora({
      text: C.text("Fetching QR code from wa-client..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    try {
      const composeArgs = await this.getComposeArgs();
      const startTime = Date.now();
      const timeoutMs = 120000; // 2 minutes
      let qrDisplayed = false;
      let lastQr = null;
      let pairingSuccess = false;

      const renderQrViaContainer = async (qrText) => {
        const qrBase64 = Buffer.from(qrText, "utf8").toString("base64");
        const nodeScript = [
          "import('qrcode-terminal').then((mod)=>{",
          "const qt=mod.default??mod;",
          "if(typeof qt.generate!=='function'){throw new TypeError('qrcode-terminal export did not provide generate()');}",
          `const qr=Buffer.from('${qrBase64}','base64').toString('utf8');`,
          "qt.generate(qr,{small:true});",
          "}).catch((e)=>{console.error(e);process.exit(1);});",
        ].join("");

        const { stdout } = await execa(
          "docker",
          [...composeArgs, "exec", "-T", "wa-client", "node", "-e", nodeScript],
          { cwd: ROOT_DIR },
        );
        if (stdout) {
          console.log(stdout);
        }
      };

      // Poll for QR code and connection status
      while (Date.now() - startTime < timeoutMs && !pairingSuccess) {
        try {
          // Check state first
          const stateRes = await this.waClientHttpJson("/state", {
            timeoutMs: 5000,
          });
          if (stateRes.ok && stateRes.body) {
            const stateData = JSON.parse(stateRes.body);
            if (stateData.state === "ready") {
              pairingSuccess = true;
              break;
            }
          }

          // Try to get QR code
          const qrRes = await this.waClientHttpJson("/qr", { timeoutMs: 5000 });
          if (qrRes.ok && qrRes.body) {
            const qrData = JSON.parse(qrRes.body);
            if (qrData.success && qrData.qr && qrData.qr !== lastQr) {
              lastQr = qrData.qr;
              spinner.stop();

              console.log("\n");
              await renderQrViaContainer(qrData.qr);
              qrDisplayed = true;

              spinner.start();
              spinner.text = C.text(
                "QR code displayed. Waiting for scan... (refreshes every ~20s)",
              );
            }
          }
        } catch {
          // Continue polling
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (!qrDisplayed) {
          spinner.text = C.text(`Waiting for QR code... (${elapsed}s)`);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      spinner.stop();

      if (pairingSuccess) {
        console.log(
          `\n  ${ICON.success}  ${C.success("WhatsApp pairing successful!")}\n`,
        );
        return true;
      } else if (!qrDisplayed) {
        console.log(`
  ${ICON.warning}  ${C.warning("QR code timeout.")}
  
  ${C.text("This may happen if:")}
  ${C.muted("  - wa-client is still initializing")}
  ${C.muted("  - wa-client is already paired")}

  ${C.text("Try these alternatives:")}
  ${C.code("  npx whatsapp-bot-scanner pair")}     ${C.muted("# Request pairing code")}
  ${C.code(`  ${composeCmd} restart wa-client`)}  ${C.muted("# Restart and try again")}
`);
        return false;
      } else {
        // QR displayed but not scanned - show timeout message
        console.log(`
  ${ICON.warning}  ${C.warning("Pairing timeout - QR code may have expired.")}
  
  ${C.text("Run to try again:")} ${C.code("npx whatsapp-bot-scanner pair")}
`);
        return false;
      }
    } catch (error) {
      spinner.fail(C.error("Failed to fetch QR code"));
      console.log(
        `  ${ICON.info}  ${C.text("Check manually:")} ${C.code(`${composeCmd} logs -f wa-client`)}`,
      );
      return false;
    }
  }

  displayPairingCode(code) {
    const formattedCode = code.split("").join(" ");

    console.log(`
${C.primary("  ╔════════════════════════════════════════════════════╗")}
${C.primary("  ║")}                                                    ${C.primary("║")}
${C.primary("  ║")}       ${ICON.key} ${C.accentBold("WHATSAPP PAIRING CODE")}                    ${C.primary("║")}
${C.primary("  ║")}                                                    ${C.primary("║")}
${C.primary("  ║")}       ${C.highlight(`    ${formattedCode}    `)}               ${C.primary("║")}
${C.primary("  ║")}                                                    ${C.primary("║")}
${C.primary("  ║")}       ${C.muted("Valid for approximately 2–3 minutes.")}        ${C.primary("║")}
${C.primary("  ║")}       ${C.muted("If it expires, request a new one.")}           ${C.primary("║")}
${C.primary("  ╠════════════════════════════════════════════════════╣")}
${C.primary("  ║")}                                                    ${C.primary("║")}
${C.primary("  ║")}   1. Open WhatsApp on your phone                   ${C.primary("║")}
${C.primary("  ║")}   2. Settings → Linked Devices → Link a Device     ${C.primary("║")}
${C.primary("  ║")}   3. Select "Link with phone number"               ${C.primary("║")}
${C.primary("  ║")}   4. Enter the code above                          ${C.primary("║")}
${C.primary("  ║")}                                                    ${C.primary("║")}
${C.primary("  ║")}   ${C.muted("For the pairing helper, run:")}                   ${C.primary("║")}
${C.primary("  ║")}   ${C.code("npx whatsapp-bot-scanner pair").padEnd(52)}${C.primary("║")}
${C.primary("  ╚════════════════════════════════════════════════════╝")}
`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Completion Summary
  // ─────────────────────────────────────────────────────────────────────────────

  async displayCompletionSummary() {
    // Read ports from .env
    const envContent = await fs
      .readFile(path.join(ROOT_DIR, ".env"), "utf-8")
      .catch(() => "");
    const getPort = (key, def) =>
      envContent.match(new RegExp(`${key}=(\\d+)`))?.[1] || def;

    const waPort = getPort("WA_CLIENT_PORT", getPort("WA_HTTP_PORT", "3005"));
    console.log(`
${C.success("  ╔════════════════════════════════════════════════════════════════╗")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}         ${ICON.sparkle} ${C.successBold("SETUP COMPLETE")} ${ICON.sparkle}                               ${C.success("║")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ╠════════════════════════════════════════════════════════════════╣")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}   ${C.textBold("Access Points:")}                                             ${C.success("║")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}   ${ICON.arrow}  WA Client:      ${C.link(`http://localhost:${waPort}/healthz`)}            ${C.success("║")}
${C.success("  ║")}   ${ICON.arrow}  Metrics:        ${C.link(`http://localhost:${waPort}/metrics`)}           ${C.success("║")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ╠════════════════════════════════════════════════════════════════╣")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}   ${C.textBold("Quick Commands:")}                                            ${C.success("║")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}   ${C.code("npx whatsapp-bot-scanner logs")}      ${C.muted("View service logs")}    ${C.success("║")}
${C.success("  ║")}   ${C.code("npx whatsapp-bot-scanner health")}    ${C.muted("Check status")}        ${C.success("║")}
${C.success("  ║")}   ${C.code("npx whatsapp-bot-scanner pair")}      ${C.muted("Re-pair WhatsApp")}    ${C.success("║")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ╚════════════════════════════════════════════════════════════════╝")}
`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Commands
// ─────────────────────────────────────────────────────────────────────────────

program
  .name("whatsapp-bot-scanner")
  .description("WhatsApp Bot Scanner - Unified CLI")
  .version("2.0.0")
  .option("--debug", "Enable debug mode")
  .option("--noninteractive", "Run in non-interactive mode");

program
  .command("setup")
  .description("Run the interactive setup wizard")
  .option("--skip-pairing", "Skip WhatsApp pairing step")
  .option("--noninteractive", "Run in non-interactive mode")
  .option("--mvp-mode", "Use MVP single-container setup (default)")
  .option("--debug", "Enable debug logging")
  .action(async (options) => {
    const globalOpts = program.opts();
    try {
      const wizard = new SetupWizard({
        nonInteractive: options.noninteractive || globalOpts.noninteractive,
        debug: options.debug || globalOpts.debug,
        skipPairing: options.skipPairing,
      });
      await wizard.run();
    } catch (error) {
      console.error(C.error(`\nSetup failed: ${error.message}`));
      if (globalOpts.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command("logs")
  .description("View service logs")
  .argument("[service]", "Specific service to view logs for")
  .action(async (service) => {
    const composeArgs = await resolveComposeArgsFromEnv();
    const args = [...composeArgs, "logs", "-f"];
    if (service) args.push(service);
    console.log(
      C.primary(
        `\nStreaming logs${service ? ` for ${service}` : ""}... (Ctrl+C to exit)\n`,
      ),
    );
    execa("docker", args, { stdio: "inherit", cwd: ROOT_DIR }).catch(() => {});
  });

program
  .command("health")
  .description("Check service health status")
  .action(async () => {
    console.log(C.textBold("\n  🏥 Pipeline Health Check\n"));

    const spinner = ora({
      text: C.text("Checking services..."),
      color: "cyan",
    }).start();

    try {
      const composeArgs = await resolveComposeArgsFromEnv();
      const { stdout } = await execa(
        "docker",
        [...composeArgs, "ps", "--format", "json"],
        { cwd: ROOT_DIR },
      );
      const containers = stdout
        .trim()
        .split("\n")
        .filter((l) => l)
        .map((l) => JSON.parse(l));
      spinner.stop();

      console.log(C.textBold("  Services:"));
      for (const c of containers) {
        const icon = c.State === "running" ? ICON.success : ICON.error;
        const health = c.Health ? C.muted(`[${c.Health}]`) : "";
        console.log(
          `    ${icon}  ${c.Service.padEnd(20)} ${c.State} ${health}`,
        );
      }

      console.log("");
    } catch (error) {
      spinner.fail(C.error("Health check failed"));
      console.error(C.error(error.message));
      process.exit(1);
    }
  });

program
  .command("pair")
  .description("Request WhatsApp pairing code or QR code")
  .option("--qr", "Show QR code instead of pairing code")
  .option("--code", "Show pairing code (default)")
  .action(async (options) => {
    const ui = new UserInterface(true);
    const notifications = new NotificationManager(ui);
    const composeFile = await resolveComposeFileFromEnv();
    const dockerOrchestrator = new DockerOrchestrator(ROOT_DIR, ui, {
      composeFile,
    });
    const composeArgs = await resolveComposeArgsFromEnv();
    const composeCmd = `docker ${composeArgs.join(" ")}`;
    const pairingManager = new PairingManager(
      dockerOrchestrator,
      ui,
      notifications,
    );

    // Check if user wants interactive choice
    const showQr = options.qr === true;

    console.log(C.textBold("\n📱 WhatsApp Pairing\n"));
    console.log(C.muted(`Mode: ${showQr ? "QR Code" : "Pairing Code"}`));
    console.log(C.muted("Use --qr for QR code, --code for pairing code\n"));

    try {
      await pairingManager.requestManualPairing({ showQr });

      // Only monitor if not using QR (QR has its own polling)
      if (!showQr) {
        await pairingManager.monitorForPairingSuccess(
          (success) => {
            console.log(C.success("\n✓ Pairing completed successfully!"));
            process.exit(0);
          },
          (error) => {
            console.error(
              C.error(
                `\n✗ Pairing failed: ${error.errorDetails || "Unknown error"}`,
              ),
            );
            process.exit(1);
          },
        );
      }
    } catch (error) {
      console.error(C.error(`\nPairing failed: ${error.message}`));
      console.log(
        C.muted(`Ensure wa-client is running: ${composeCmd} up -d wa-client`),
      );
      process.exit(1);
    }
  });

program
  .command("debug")
  .description("Run pipeline diagnostics")
  .action(async () => {
    console.log(C.warning("\nRunning debug diagnostics...\n"));
    await execa("node", [path.join(ROOT_DIR, "scripts/debug-pipeline.mjs")], {
      stdio: "inherit",
      cwd: ROOT_DIR,
    }).catch(() => process.exit(1));
  });

const argv = process.argv.slice(2);
const hasHelpFlag = argv.includes("-h") || argv.includes("--help");
const hasVersionFlag = argv.includes("-V") || argv.includes("--version");
const hasCommand = argv.some((arg) => !arg.startsWith("-"));
const parseArgs =
  !hasHelpFlag && !hasVersionFlag && !hasCommand
    ? [process.argv[0], process.argv[1], "setup", ...argv]
    : process.argv;

program.parse(parseArgs);
