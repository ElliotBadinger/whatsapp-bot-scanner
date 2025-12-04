#!/usr/bin/env node

import { program } from "commander";
import ora from "ora";
import boxen from "boxen";
import chalk from "chalk";
import { execa } from "execa";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { UnifiedCLI } from "./cli/core/unified-cli.mjs";
import { PairingManager } from "./cli/core/pairing.mjs";
import { UserInterface } from "./cli/ui/prompts.mjs";
import { NotificationManager } from "./cli/ui/notifications.mjs";
import { DockerOrchestrator } from "./cli/core/docker.mjs";
import figlet from "figlet";
import enquirer from "enquirer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

class SetupWizard {
  constructor(options = {}) {
    const { nonInteractive = false, debug = false } = options;
    this.nonInteractive = !!nonInteractive;
    this.debug = debug;
    this.state = {
      dockerVersion: null,
      nodeVersion: process.version,
      apiKey: null,
      pairingCode: null,
      rateLimited: false,
    };
  }

  async run() {
    this.displayHeader();
    await this.checkPrerequisites();
    await this.setupModeSelection();
    await this.collectApiKeys();
    await this.startServices();
    await this.startPairing();
    await this.verifyInstallation();
  }

  async verifyInstallation() {
    console.log(chalk.bold("\nStep 5 of 5: Verification"));

    // Give services a moment to stabilize after pairing
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const spinner = ora("Verifying services...").start();

    try {
      // Check if all services are running
      const { stdout } = await execa("docker", [
        "compose",
        "ps",
        "--format",
        "json",
      ]);

      // Handle both single JSON object and multiple line-delimited JSON
      let containers;
      try {
        containers = JSON.parse(stdout);
      } catch {
        // Try parsing as line-delimited JSON
        containers = stdout
          .trim()
          .split("\n")
          .filter((line) => line)
          .map((line) => JSON.parse(line));
      }

      if (!Array.isArray(containers)) {
        containers = [containers];
      }

      const running = containers.filter(
        (c) => c.State === "running" || c.State === "healthy",
      );

      if (running.length > 0) {
        spinner.succeed("All services are running");

        // Read actual port mappings from environment
        const envContent = await fs
          .readFile(path.join(ROOT_DIR, ".env"), "utf-8")
          .catch(() => "");
        const getEnv = (key, def) => {
          const match = envContent.match(new RegExp(`${key}=(.*)`));
          return match ? match[1] : def;
        };

        const uptimeKumaPort = getEnv("UPTIME_KUMA_PORT", "3001");
        const reverseProxyPort = getEnv("REVERSE_PROXY_PORT", "8088");
        const scanOrchestratorPort = getEnv("SCAN_ORCHESTRATOR_PORT", "3003");
        const grafanaPort = getEnv("GRAFANA_PORT", "3002");

        console.log(
          boxen(
            chalk.green(
              "🎉 Setup complete! Your bot is now protecting your groups.",
            ) +
              "\n\n" +
              chalk.white("Dashboard:          ") +
              chalk.cyan(`http://localhost:${reverseProxyPort}`) +
              "\n" +
              chalk.white("Uptime Monitor:     ") +
              chalk.cyan(`http://localhost:${uptimeKumaPort}`) +
              "\n" +
              chalk.white("Scan Orchestrator:  ") +
              chalk.cyan(`http://localhost:${scanOrchestratorPort}/healthz`) +
              "\n" +
              chalk.white("Grafana:            ") +
              chalk.cyan(`http://localhost:${grafanaPort} (admin/admin)`) +
              "\n\n" +
              chalk.white("Logs:               ") +
              chalk.cyan("npx whatsapp-bot-scanner logs") +
              "\n" +
              chalk.white("Health Check:       ") +
              chalk.cyan("npx whatsapp-bot-scanner health"),
            { padding: 1, borderStyle: "round", borderColor: "green" },
          ),
        );
      } else {
        spinner.warn(
          "Some services might not be running correctly. Check logs.",
        );
      }
    } catch (error) {
      spinner.fail(`Verification failed: ${error.message}`);
    }
  }

  displayHeader() {
    console.log(
      chalk.cyan(
        figlet.textSync("WA Bot Scanner", { horizontalLayout: "full" }),
      ),
    );
    console.log(
      boxen(chalk.bold("Unified Setup Wizard"), {
        padding: 1,
        borderStyle: "round",
        borderColor: "cyan",
      }),
    );
  }

  async checkPrerequisites() {
    console.log(chalk.bold("\nStep 1 of 5: Prerequisites Check"));
    const spinner = ora("Checking environment...").start();

    try {
      // Check Node.js version
      const nodeMajor = parseInt(
        process.version.substring(1).split(".")[0],
        10,
      );
      if (nodeMajor < 20) {
        spinner.fail(`Node.js v20+ is required. Detected ${process.version}`);
        process.exit(1);
      }
      spinner.succeed(`Node.js ${process.version} detected`);

      // Check Docker
      spinner.start("Checking Docker...");
      try {
        const { stdout } = await execa("docker", ["--version"]);
        this.state.dockerVersion = stdout;
        spinner.succeed(`Docker found: ${stdout}`);
      } catch (error) {
        spinner.fail("Docker not found. Please install Docker and try again.");
        process.exit(1);
      }

      // Check Docker Daemon
      spinner.start("Checking Docker Daemon...");
      try {
        await execa("docker", ["info"]);
        spinner.succeed("Docker daemon is running");
      } catch (error) {
        spinner.fail(
          "Docker daemon is not running. Please start Docker and try again.",
        );
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(`Prerequisites check failed: ${error.message}`);
      process.exit(1);
    }
  }

  async setupModeSelection() {
    console.log(chalk.bold("\nStep 2 of 5: Setup Configuration"));

    let selectedMode = "hobby";
    if (!this.nonInteractive) {
      const response = await enquirer.prompt({
        type: "select",
        name: "mode",
        message: "Choose setup mode:",
        choices: [
          {
            name: "hobby",
            message: "Hobby Mode (Recommended for personal use)",
          },
          { name: "production", message: "Production Mode (Full features)" },
        ],
      });
      selectedMode = response.mode;
    } else {
      console.log(
        chalk.blue(
          "ℹ Non-interactive mode detected. Defaulting to hobby configuration.",
        ),
      );
    }

    this.state.mode = selectedMode;

    const envFile = path.join(ROOT_DIR, ".env");
    const templateFile = path.join(
      ROOT_DIR,
      this.state.mode === "hobby" ? ".env.hobby" : ".env.example",
    );

    try {
      await fs.access(envFile);
      console.log(
        chalk.yellow(
          "ℹ .env file already exists. Using existing configuration.",
        ),
      );
    } catch {
      console.log(
        chalk.blue(`ℹ Creating .env from ${path.basename(templateFile)}...`),
      );
      await fs.copyFile(templateFile, envFile);
      console.log(chalk.green("✔ .env file created."));
    }
  }

  async collectApiKeys() {
    console.log(chalk.bold("\nStep 3 of 5: API Keys"));

    const envFile = path.join(ROOT_DIR, ".env");
    let envContent = await fs.readFile(envFile, "utf-8");

    // Check for VirusTotal API Key
    const vtKeyMatch = envContent.match(/VT_API_KEY=(.*)/);
    let vtKey = vtKeyMatch ? vtKeyMatch[1] : "";

    if (!vtKey) {
      if (this.nonInteractive) {
        throw new Error(
          "VT_API_KEY is required in non-interactive mode. Please set it in your .env before running with --noninteractive.",
        );
      }

      const response = await enquirer.prompt({
        type: "password",
        name: "vtKey",
        message: "Enter your VirusTotal API Key (Required):",
        validate: (value) => (value.length > 0 ? true : "API Key is required"),
      });

      vtKey = response.vtKey;
      envContent = envContent.replace(/VT_API_KEY=.*/, `VT_API_KEY=${vtKey}`);
      await fs.writeFile(envFile, envContent);
      console.log(chalk.green("✔ VirusTotal API Key saved."));
    } else {
      console.log(chalk.green("✔ VirusTotal API Key found in .env."));
    }

    this.state.apiKey = vtKey;

    // Check for WhatsApp Phone Number
    const phoneMatch = envContent.match(/WA_REMOTE_AUTH_PHONE_NUMBERS=(.*)/);
    let phone = phoneMatch ? phoneMatch[1] : "";

    if (!phone) {
      if (this.nonInteractive) {
        throw new Error(
          "WA_REMOTE_AUTH_PHONE_NUMBERS must be set in non-interactive mode. Update your .env file and rerun.",
        );
      }

      const response = await enquirer.prompt({
        type: "input",
        name: "phone",
        message:
          "Enter your WhatsApp Phone Number (International format, e.g., 27123456789):",
        validate: (value) => {
          if (!value || value.trim().length === 0)
            return "Phone number is required";
          try {
            const { PairingRequestSchema } = require("@wbscanner/shared");
            const normalized = value.replace(/[\s\-()]/g, "");
            const withPlus = normalized.startsWith("+")
              ? normalized
              : `+${normalized}`;
            const result = PairingRequestSchema.safeParse({
              phoneNumber: withPlus,
            });
            if (!result.success)
              return "Invalid format. Use: country code + number (e.g., 27123456789)";
            if (normalized.length < 10 || normalized.length > 13)
              return "Must be 10-15 digits";
            return true;
          } catch (err) {
            return (
              /^\+?[1-9]\d{9,14}$/.test(value.replace(/[\s\-()]/g, "")) ||
              "Invalid phone format"
            );
          }
        },
      });

      phone = response.phone;
      envContent = envContent.replace(
        /WA_REMOTE_AUTH_PHONE_NUMBERS=.*/,
        `WA_REMOTE_AUTH_PHONE_NUMBERS=${phone}`,
      );
      await fs.writeFile(envFile, envContent);
      console.log(chalk.green("✔ Phone number saved."));
    } else {
      console.log(chalk.green(`✔ Phone number found: ${phone}`));
    }
    this.state.phone = phone;
  }

  async startServices() {
    console.log(chalk.bold("\nStep 3 of 5: Starting Services"));
    const spinner = ora("Starting Docker containers...").start();

    try {
      // Start all services (including observability and reverse proxy)
      await execa("docker", ["compose", "up", "-d"]);
      spinner.succeed("Containers started");

      // Wait for wa-client to be ready
      const waitSpinner = ora("Waiting for services to be healthy...").start();
      const isRateLimited = await this.waitForService("wa-client");
      waitSpinner.succeed("Services are ready");

      // Store rate-limit status for pairing step
      this.state.rateLimited = isRateLimited;
    } catch (error) {
      spinner.fail(`Failed to start services: ${error.message}`);
      process.exit(1);
    }
  }

  async waitForService(serviceName, timeoutMs = 120000) {
    const startTime = Date.now();
    const logIntervalMs = 10000;
    let rateLimitDetected = false;
    let lastLogTime = 0;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const { stdout } = await execa("docker", [
          "inspect",
          `--format={{.State.Health.Status}}`,
          `whatsapp-bot-scanner-${serviceName}-1`,
        ]);
        const health = stdout.trim();

        if (health === "healthy") {
          console.log(chalk.green(`✓ ${serviceName} is ready`));

          // Special handling for wa-client - check for rate limiting
          if (serviceName === "wa-client") {
            try {
              const { stdout: logs } = await execa("docker", [
                "compose",
                "logs",
                "--tail=50",
                "wa-client",
              ]);
              if (
                logs.includes("rate-overlimit") ||
                logs.includes("rate_limit")
              ) {
                rateLimitDetected = true;
                console.log(
                  chalk.yellow(
                    `⚠️  ${serviceName} is healthy but WhatsApp rate-limited`,
                  ),
                );

                // Try to parse nextRetryAt from logs
                const match = logs.match(/"nextRetryAt":"([^"]+)"/);
                let waitMsg = "Wait 15 minutes";
                if (match && match[1]) {
                  const nextRetry = new Date(match[1]);
                  const now = new Date();
                  const diffMs = nextRetry - now;
                  if (diffMs > 0) {
                    const minutes = Math.ceil(diffMs / 60000);
                    waitMsg = `Wait approx. ${minutes} minute(s) (until ${nextRetry.toLocaleTimeString()})`;
                  }
                }

                console.log(chalk.yellow("\n⚠️  WhatsApp Rate Limit Detected"));
                console.log(
                  chalk.yellow(
                    "The service is running but cannot pair with WhatsApp right now.",
                  ),
                );
                console.log(
                  chalk.yellow(
                    `${waitMsg} and run: docker compose restart wa-client\n`,
                  ),
                );
              }
            } catch (logErr) {
              // Ignore log check errors
            }
          }
          return rateLimitDetected;
        }
      } catch (error) {
        // Container might not exist yet, keep waiting
      }

      if (Date.now() - startTime > lastLogTime + logIntervalMs) {
        lastLogTime = Date.now();
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Check for rate limiting before throwing error
    if (serviceName === "wa-client") {
      try {
        const { stdout: logs } = await execa("docker", [
          "compose",
          "logs",
          "--tail=100",
          "wa-client",
        ]);
        if (logs.includes("rate-overlimit") || logs.includes("rate_limit")) {
          console.log(
            chalk.yellow(
              `⚠️  ${serviceName} timed out (WhatsApp rate-limited)`,
            ),
          );
          console.log(chalk.yellow("\n⚠️  Setup continuing with warning:"));
          console.log(
            chalk.yellow("WhatsApp is rate-limiting pairing attempts."),
          );
          console.log(
            chalk.yellow(
              "The service will retry automatically. Check status with:",
            ),
          );
          console.log(
            chalk.cyan("  npx whatsapp-bot-scanner logs wa-client\n"),
          );
          return true; // Continue setup
        }
      } catch (logErr) {
        // Ignore log check errors
      }
    }

    throw new Error(
      `Service ${serviceName} timed out after ${Math.round(timeoutMs / 1000)}s. Run 'npx whatsapp-bot-scanner logs ${serviceName}' to investigate.`,
    );
  }

  async startPairing() {
    console.log(chalk.bold("\nStep 4 of 5: WhatsApp Pairing"));

    // Skip pairing if WhatsApp is rate-limited
    if (this.state.rateLimited) {
      console.log(
        chalk.yellow("⚠️  Skipping pairing due to WhatsApp rate limit"),
      );
      console.log(
        chalk.yellow("Wait 15 minutes and run: ") +
          chalk.cyan("npx whatsapp-bot-scanner pair"),
      );
      return;
    }

    // Check if already paired (optional, maybe check logs or status endpoint)

    const spinner = ora("Requesting pairing code...").start();

    try {
      // Wait a bit for the service to fully initialize internal state
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const response = await fetch("http://127.0.0.1:3005/pair", {
        method: "POST",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server responded with ${response.status}: ${text}`);
      }

      const data = await response.json();
      spinner.stop();

      if (data.code) {
        console.log(
          boxen(
            chalk.bold(
              `Your Pairing Code:\n\n${chalk.green(data.code.split("").join(" "))}`,
            ),
            {
              padding: 1,
              margin: 1,
              borderStyle: "double",
              borderColor: "green",
              title: "Action Required",
              titleAlignment: "center",
            },
          ),
        );
        console.log(chalk.yellow("1. Open WhatsApp on your phone"));
        console.log(
          chalk.yellow("2. Go to Settings > Linked Devices > Link a Device"),
        );
        console.log(chalk.yellow('3. Select "Link with phone number"'));
        console.log(chalk.yellow("4. Enter the code above"));

        if (!this.nonInteractive) {
          // Wait for user confirmation or success detection
          await enquirer.prompt({
            type: "confirm",
            name: "continue",
            message: "Press Enter once you have entered the code on your phone",
          });
        } else {
          console.log(
            chalk.blue(
              "ℹ Non-interactive mode: Skipping pairing confirmation prompt.",
            ),
          );
        }
      } else {
        console.log(chalk.red("No code received. Check logs."));
      }
    } catch (error) {
      spinner.fail(`Pairing request failed: ${error.message}`);
      console.log(
        chalk.yellow(
          "Ensure wa-client is running and phone number is correct.",
        ),
      );
    }
  }
}

program
  .name("whatsapp-bot-scanner")
  .description("Unified setup and management CLI for WhatsApp Bot Scanner")
  .version("1.0.0")
  .option("--debug", "Enable debug mode with verbose logging")
  .option("--noninteractive", "Run CLI in non-interactive mode");

program
  .command("setup")
  .description(
    'Run interactive setup wizard (deprecated: use "unified-cli setup" instead)',
  )
  .option("--skip-pairing", "Skip WhatsApp pairing step")
  .action(async (options) => {
    // Emit deprecation warning
    console.log(chalk.yellow("\n⚠️  DEPRECATION WARNING:"));
    console.log(chalk.yellow("This command is deprecated. Please use:"));
    console.log(chalk.cyan("  npx whatsapp-bot-scanner unified-cli setup\n"));

    // Instantiate UnifiedCLI with proper configuration
    const argv = process.argv.slice(2);
    const unifiedCli = new UnifiedCLI(argv);

    try {
      // Create and run setup wizard with unified infrastructure
      const wizard = unifiedCli.createSetupWizard({
        skipPairing: options.skipPairing,
      });
      await wizard.run();
    } catch (error) {
      console.error(chalk.red(`Setup failed: ${error.message}`));
      process.exit(1);
    }
  });

class SetupWizardEntry {
  constructor(globalOptions) {
    this.globalOptions = globalOptions;
    this.cli = new SetupWizard({
      nonInteractive: globalOptions.noninteractive,
      debug: globalOptions.debug,
    });
  }

  async runSetup(options) {
    this.cli.skipPairing = options.skipPairing;
    await this.cli.run();
  }
}

program
  .command("logs")
  .description("View service logs")
  .argument("[service]", "Specific service to view logs for")
  .action((service) => {
    const args = ["compose", "logs", "-f"];
    if (service) args.push(service);

    console.log(
      chalk.blue(
        `Starting log stream${service ? ` for ${service}` : ""}... (Press Ctrl+C to exit)`,
      ),
    );
    const logs = execa("docker", args, { stdio: "inherit", cwd: ROOT_DIR });
    logs.catch(() => {}); // Ignore exit errors
  });

program
  .command("health")
  .description("Check pipeline health status")
  .action(async () => {
    console.log(chalk.bold.cyan("\n🏥 Pipeline Health Check\n"));

    const spinner = ora("Checking services...").start();

    try {
      const { stdout } = await execa(
        "docker",
        ["compose", "ps", "--format", "json"],
        { cwd: ROOT_DIR },
      );
      const containers = stdout
        .trim()
        .split("\n")
        .filter((line) => line)
        .map((line) => JSON.parse(line));

      spinner.stop();

      console.log(chalk.bold("Services:"));
      for (const container of containers) {
        const status =
          container.State === "running" ? chalk.green("✓") : chalk.red("✗");
        const health = container.Health ? `[${container.Health}]` : "";
        console.log(
          `  ${status} ${container.Service.padEnd(20)} ${container.State} ${health}`,
        );
      }

      // Check health endpoints
      console.log(chalk.bold("\nHealth Endpoints:"));

      // Read ports from environment
      const envContent = await fs
        .readFile(path.join(ROOT_DIR, ".env"), "utf-8")
        .catch(() => "");
      const getEnv = (key, def) => {
        const match = envContent.match(new RegExp(`${key}=(.*)`));
        return match ? match[1] : def;
      };

      const scanOrchestratorPort = getEnv("SCAN_ORCHESTRATOR_PORT", "3003");
      const uptimeKumaPort = getEnv("UPTIME_KUMA_PORT", "3001");
      const grafanaPort = getEnv("GRAFANA_PORT", "3002");
      const reverseProxyPort = getEnv("REVERSE_PROXY_PORT", "8088");

      const healthChecks = [
        { name: "wa-client", url: "http://localhost:3005/healthz" },
        {
          name: "scan-orchestrator",
          url: `http://localhost:${scanOrchestratorPort}/healthz`,
        },
        { name: "uptime-kuma", url: `http://localhost:${uptimeKumaPort}` },
        { name: "grafana", url: `http://localhost:${grafanaPort}/api/health` },
        { name: "reverse-proxy", url: `http://localhost:${reverseProxyPort}` },
      ];

      for (const check of healthChecks) {
        try {
          await execa("curl", ["-sf", check.url, "-m", "3"]);
          console.log(
            `  ${chalk.green("✓")} ${check.name.padEnd(20)} responding`,
          );
        } catch {
          console.log(
            `  ${chalk.red("✗")} ${check.name.padEnd(20)} not responding`,
          );
        }
      }

      console.log();
    } catch (error) {
      spinner.fail("Health check failed");
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command("metrics")
  .description("Display pipeline metrics")
  .action(async () => {
    console.log(chalk.bold.cyan("\n📊 Pipeline Metrics\n"));

    const spinner = ora("Fetching metrics...").start();

    try {
      // Try to connect to Redis to get queue depths
      const { execa: execaSync } = await import("execa");

      const queues = ["scan-request", "scan-verdict", "deep-scan"];
      spinner.stop();

      console.log(chalk.bold("Queue Depths:"));
      for (const queue of queues) {
        try {
          const { stdout } = await execaSync(
            "docker",
            ["compose", "exec", "-T", "redis", "redis-cli", "LLEN", queue],
            { cwd: ROOT_DIR },
          );
          const depth = parseInt(stdout.trim());
          const status =
            depth === 0
              ? chalk.green(depth)
              : depth < 10
                ? chalk.yellow(depth)
                : chalk.red(depth);
          console.log(`  ${queue.padEnd(20)} ${status}`);
        } catch {
          console.log(`  ${queue.padEnd(20)} ${chalk.gray("N/A")}`);
        }
      }

      console.log();
    } catch (error) {
      spinner.fail("Metrics fetch failed");
      console.error(chalk.red(error.message));
    }
  });

program
  .command("debug")
  .description("Run comprehensive pipeline diagnostics")
  .action(async () => {
    console.log(chalk.yellow("Running debug diagnostics...\n"));
    const debug = execa(
      "node",
      [path.join(ROOT_DIR, "scripts/debug-pipeline.mjs")],
      {
        stdio: "inherit",
        cwd: ROOT_DIR,
      },
    );
    try {
      await debug;
    } catch (error) {
      console.error(chalk.red("\nDebug diagnostics failed"));
      process.exit(1);
    }
  });

program
  .command("test")
  .description("Run pipeline validation tests")
  .option("--stress", "Run stress tests instead of standard tests")
  .option("--verbose", "Show detailed test output")
  .option("--benchmark", "Show performance benchmarks")
  .action(async (options) => {
    const testFile = options.stress
      ? "stress_test_pipeline.mjs"
      : "test_unified_pipeline.mjs";
    const args = ["node", path.join(ROOT_DIR, "tests", testFile)];

    if (options.verbose) args.push("--verbose");
    if (options.benchmark) args.push("--benchmark");

    console.log(
      chalk.yellow(
        `Running ${options.stress ? "stress" : "validation"} tests...\n`,
      ),
    );

    const test = execa(args[0], args.slice(1), {
      stdio: "inherit",
      cwd: ROOT_DIR,
    });

    try {
      await test;
    } catch (error) {
      process.exit(1);
    }
  });

program
  .command("pair")
  .description(
    'Request WhatsApp pairing code (deprecated: use "unified-cli pair" instead)',
  )
  .option("-f, --force", "Force pairing request (clears rate limit state)")
  .action(async (options) => {
    // Emit deprecation warning
    console.log(chalk.yellow("\n⚠️  DEPRECATION WARNING:"));
    console.log(chalk.yellow("This command is deprecated. Please use:"));
    console.log(chalk.cyan("  npx whatsapp-bot-scanner unified-cli pair\n"));

    // Instantiate UnifiedCLI and PairingManager with proper configuration
    const argv = process.argv.slice(2);
    const unifiedCli = new UnifiedCLI(argv);
    const pairingManager = unifiedCli.getPairingManager();

    try {
      // Use PairingManager for enhanced pairing with countdown and auto-detection
      await pairingManager.requestManualPairing();

      // Set up monitoring for pairing success with countdown hooks
      await pairingManager.monitorForPairingSuccess(
        (successData) => {
          console.log(chalk.green("✅ Pairing completed successfully!"));
          console.log(chalk.dim(`Timestamp: ${successData.timestamp}`));
          if (successData.sessionInfo) {
            console.log(chalk.dim(`Session: ${successData.sessionInfo}`));
          }
        },
        (errorData) => {
          console.error(
            chalk.red(
              `❌ Pairing failed: ${errorData.errorDetails || "Unknown error"}`,
            ),
          );
          console.error(chalk.dim(`Timestamp: ${errorData.timestamp}`));
        },
      );
    } catch (error) {
      console.error(chalk.red(`Pairing failed: ${error.message}`));
      console.log(
        chalk.yellow(
          "Ensure wa-client is running: docker compose up -d wa-client",
        ),
      );
      process.exit(1);
    }
  });

program.parse(process.argv);
