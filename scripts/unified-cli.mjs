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
import { fileURLToPath } from "url";
import { PairingManager } from "./cli/core/pairing.mjs";
import { DockerOrchestrator } from "./cli/core/docker.mjs";
import { UserInterface } from "./cli/ui/prompts.mjs";
import { NotificationManager } from "./cli/ui/notifications.mjs";
import { ProgressManager } from "./cli/ui/progress.mjs";
import enquirer from "enquirer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

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
    name: "API Keys & Configuration",
    estimate: "~1min",
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

    let selectedMode = "hobby";

    if (!this.nonInteractive) {
      const response = await enquirer.prompt({
        type: "select",
        name: "mode",
        message: C.text("Choose setup mode:"),
        choices: [
          {
            name: "hobby",
            message: `${C.success("●")} Hobby Mode ${C.muted("(Recommended for personal use)")}`,
          },
          {
            name: "production",
            message: `${C.muted("○")} Production Mode ${C.muted("(Full features, more setup)")}`,
          },
        ],
        pointer: C.accent("›"),
      });
      selectedMode = response.mode;
    } else {
      console.log(
        `  ${ICON.info}  ${C.text("Non-interactive mode: using hobby configuration")}`,
      );
    }

    this.state.mode = selectedMode;

    const envFile = path.join(ROOT_DIR, ".env");
    const templateFile = path.join(
      ROOT_DIR,
      selectedMode === "hobby" ? ".env.hobby" : ".env.example",
    );

    const envSpinner = ora({
      text: C.text("Setting up environment..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    try {
      await fs.access(envFile);
      envSpinner.succeed(
        C.text(".env file found, using existing configuration"),
      );
    } catch {
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

    this.markStepComplete(2, `Configuration set to ${selectedMode} mode`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 3: API Keys & Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  async step3ApiKeys() {
    this.displayStepHeader(3, "API Keys & Configuration", ICON.key);

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

  async step4StartServices() {
    this.displayStepHeader(4, "Starting Services", ICON.docker);
    console.log(`  ${C.muted("This may take 2-5 minutes on first run...")}\n`);

    const spinner = ora({
      text: C.text("Starting Docker containers..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    try {
      await execa("docker", ["compose", "up", "-d"], { cwd: ROOT_DIR });
      spinner.succeed(C.text("Containers started"));
    } catch (error) {
      spinner.fail(C.error("Failed to start containers"));
      console.log(
        `\n  ${ICON.info}  ${C.text("Try running:")} ${C.code("docker compose logs")}`,
      );
      throw error;
    }

    // Wait for services
    const healthSpinner = ora({
      text: C.text("Waiting for services to be healthy..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    const isRateLimited = await this.waitForService("wa-client", healthSpinner);
    healthSpinner.succeed(C.text("Services are healthy"));

    this.state.rateLimited = isRateLimited;
    this.markStepComplete(4, "All services running");
  }

  async waitForService(serviceName, spinner, timeoutMs = 120000) {
    const startTime = Date.now();
    let rateLimitDetected = false;

    // Get container name
    let containerName = null;
    try {
      const { stdout } = await execa(
        "docker",
        ["compose", "ps", "--format", "{{.Name}}"],
        { cwd: ROOT_DIR },
      );
      const containers = stdout.trim().split("\n");
      containerName = containers.find((c) => c.includes(serviceName));
    } catch {
      containerName = `whatsapp-bot-scanner-${serviceName}-1`;
    }

    while (Date.now() - startTime < timeoutMs) {
      try {
        const { stdout } = await execa("docker", [
          "inspect",
          `--format={{.State.Health.Status}}`,
          containerName,
        ]);
        const health = stdout.trim();

        if (health === "healthy") {
          // Check for rate limiting in logs
          if (serviceName === "wa-client") {
            try {
              const { stdout: logs } = await execa(
                "docker",
                ["compose", "logs", "--tail=50", "wa-client"],
                { cwd: ROOT_DIR },
              );
              if (
                logs.includes("rate-overlimit") ||
                logs.includes("rate_limit")
              ) {
                rateLimitDetected = true;
                spinner.text = C.warning(
                  "WhatsApp rate-limited, will retry automatically",
                );
              }
            } catch {}
          }
          return rateLimitDetected;
        }
      } catch {}

      await new Promise((r) => setTimeout(r, 2000));
    }

    throw new Error(`Service ${serviceName} did not become healthy in time`);
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

    const spinner = ora({
      text: C.text("Requesting pairing code..."),
      color: "cyan",
      spinner: "dots12",
    }).start();

    try {
      await new Promise((r) => setTimeout(r, 5000));

      const envContent = await fs
        .readFile(path.join(ROOT_DIR, ".env"), "utf-8")
        .catch(() => "");
      const waClientPort =
        envContent.match(/WA_CLIENT_PORT=(\d+)/)?.[1] || "3005";

      const response = await fetch(`http://127.0.0.1:${waClientPort}/pair`, {
        method: "POST",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server: ${response.status} - ${text}`);
      }

      const data = await response.json();
      spinner.stop();

      if (data.code) {
        this.displayPairingCode(data.code);

        if (!this.nonInteractive) {
          await enquirer.prompt({
            type: "confirm",
            name: "done",
            message: C.text("Press Enter when you have entered the code"),
          });
        }
      } else {
        console.log(
          `  ${ICON.warning}  ${C.warning("No pairing code received, check logs")}`,
        );
      }
    } catch (error) {
      spinner.fail(C.error(`Pairing request failed: ${error.message}`));
      console.log(
        `  ${ICON.info}  ${C.text("Run manually:")} ${C.code("npx whatsapp-bot-scanner pair")}`,
      );
    }

    this.markStepComplete(5, "Pairing process initiated");
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
${C.primary("  ╠════════════════════════════════════════════════════╣")}
${C.primary("  ║")}                                                    ${C.primary("║")}
${C.primary("  ║")}   1. Open WhatsApp on your phone                   ${C.primary("║")}
${C.primary("  ║")}   2. Settings → Linked Devices → Link a Device     ${C.primary("║")}
${C.primary("  ║")}   3. Select "Link with phone number"               ${C.primary("║")}
${C.primary("  ║")}   4. Enter the code above                          ${C.primary("║")}
${C.primary("  ║")}                                                    ${C.primary("║")}
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

    const ports = {
      dashboard: getPort("REVERSE_PROXY_PORT", "8088"),
      grafana: getPort("GRAFANA_PORT", "3002"),
      uptime: getPort("UPTIME_KUMA_PORT", "3001"),
      orchestrator: getPort("SCAN_ORCHESTRATOR_PORT", "3003"),
    };

    console.log(`
${C.success("  ╔════════════════════════════════════════════════════════════════╗")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}         ${ICON.sparkle} ${C.successBold("SETUP COMPLETE!")} ${ICON.sparkle}                              ${C.success("║")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}   Your WhatsApp Bot Scanner is now protecting your groups.    ${C.success("║")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ╠════════════════════════════════════════════════════════════════╣")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}   ${C.textBold("Access Points:")}                                             ${C.success("║")}
${C.success("  ║")}                                                                ${C.success("║")}
${C.success("  ║")}   ${ICON.arrow}  Dashboard:       ${C.link(`http://localhost:${ports.dashboard}`)}                 ${C.success("║")}
${C.success("  ║")}   ${ICON.arrow}  Uptime Monitor:  ${C.link(`http://localhost:${ports.uptime}`)}                 ${C.success("║")}
${C.success("  ║")}   ${ICON.arrow}  Grafana:         ${C.link(`http://localhost:${ports.grafana}`)} ${C.muted("(admin/admin)")}    ${C.success("║")}
${C.success("  ║")}   ${ICON.arrow}  Orchestrator:    ${C.link(`http://localhost:${ports.orchestrator}/healthz`)}          ${C.success("║")}
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
  .action((service) => {
    const args = ["compose", "logs", "-f"];
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
      const { stdout } = await execa(
        "docker",
        ["compose", "ps", "--format", "json"],
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
  .description("Request WhatsApp pairing code")
  .action(async () => {
    const ui = new UserInterface(true);
    const notifications = new NotificationManager(ui);
    const dockerOrchestrator = new DockerOrchestrator(ROOT_DIR, ui);
    const pairingManager = new PairingManager(
      dockerOrchestrator,
      ui,
      notifications,
    );

    try {
      await pairingManager.requestManualPairing();

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
    } catch (error) {
      console.error(C.error(`\nPairing failed: ${error.message}`));
      console.log(
        C.muted("Ensure wa-client is running: docker compose up -d wa-client"),
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

program.parse(process.argv);
