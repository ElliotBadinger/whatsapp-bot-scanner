import { execa } from "execa";
import { UserInterface } from "../ui/prompts.mjs";
import chalk from "chalk";
import { Readable } from "node:stream";
import {
  DockerError,
  DockerComposeError,
  DockerContainerError,
  DockerLogStreamError,
  DockerHealthCheckError,
  GlobalErrorHandler,
  ERROR_SEVERITY,
  TimeoutError,
} from "./errors.mjs";

export class DockerOrchestrator {
  constructor(rootDir, ui) {
    this.rootDir = rootDir;
    this.ui = ui;
    this.activeLogStreams = new Map();
    this.healthCheckIntervals = new Map();
  }

  async detectDockerCompose() {
    try {
      await execa("docker", ["compose", "version"], { stdio: "ignore" });
      return {
        command: ["docker", "compose"],
        version: "v2",
        supportsComposeV2: true,
      };
    } catch {
      try {
        await execa("docker-compose", ["version"], { stdio: "ignore" });
        this.ui.warn(
          "Using legacy docker-compose. Consider upgrading to Docker Compose v2.",
        );
        return {
          command: ["docker-compose"],
          version: "v1",
          supportsComposeV2: false,
        };
      } catch (error) {
        throw new Error(
          "Docker Compose not detected. Please install Docker Compose v2.",
        );
      }
    }
  }

  async buildAndStartServices() {
    this.ui.progress("Building Docker containers...");
    const composeInfo = await this.detectDockerCompose();

    try {
      // Build containers
      await execa(
        composeInfo.command[0],
        [...composeInfo.command.slice(1), "build"],
        {
          cwd: this.rootDir,
          stdio: "inherit",
        },
      );

      // Start services
      this.ui.progress("Starting services...");
      await execa(
        composeInfo.command[0],
        [...composeInfo.command.slice(1), "up", "-d"],
        {
          cwd: this.rootDir,
          stdio: "inherit",
        },
      );

      this.ui.success("Services started");
      return true;
    } catch (error) {
      throw new Error(`Failed to build and start services: ${error.message}`);
    }
  }

  async getServiceStatus() {
    const composeInfo = await this.detectDockerCompose();
    try {
      const { stdout } = await execa(
        composeInfo.command[0],
        [...composeInfo.command.slice(1), "ps"],
        {
          cwd: this.rootDir,
        },
      );
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get service status: ${error.message}`);
    }
  }

  async streamLogs(serviceName, options = {}) {
    const composeInfo = await this.detectDockerCompose();
    const {
      follow = true,
      tail = "all",
      since = null,
      until = null,
      timestamps = false,
    } = options;

    const args = [...composeInfo.command.slice(1), "logs"];
    if (follow) args.push("-f");
    if (tail !== "all") args.push("--tail", String(tail));
    if (timestamps) args.push("--timestamps");
    if (since) args.push("--since", since);
    if (until) args.push("--until", until);
    if (serviceName) args.push(serviceName);

    const logProcess = execa(composeInfo.command[0], args, {
      cwd: this.rootDir,
      stdio: "pipe",
    });

    // Store the active log stream
    const streamId = serviceName || "all-services";
    this.activeLogStreams.set(streamId, logProcess);

    // Handle process cleanup
    logProcess.on("exit", () => {
      this.activeLogStreams.delete(streamId);
    });

    return {
      process: logProcess,
      stream: logProcess.stdout,
      stop: () => {
        logProcess.kill();
        this.activeLogStreams.delete(streamId);
      },
    };
  }

  async streamLogsWithFormatting(serviceName, options = {}) {
    const { process, stream, stop } = await this.streamLogs(
      serviceName,
      options,
    );

    // Format and colorize logs in real-time
    stream.on("data", (chunk) => {
      const lines = chunk.toString().split("\n");
      lines.forEach((line) => {
        if (line.trim()) {
          this.formatAndDisplayLogLine(line, serviceName);
        }
      });
    });

    return { process, stop };
  }

  formatAndDisplayLogLine(line, serviceName) {
    // Extract timestamp if present
    let timestamp = null;
    let message = line;

    // Check for Docker timestamp format: YYYY-MM-DDTHH:MM:SS.mmmmmmZ
    const timestampMatch = line.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/,
    );
    if (timestampMatch) {
      timestamp = timestampMatch[1];
      message = line.substring(timestampMatch[0].length).trim();
    }

    // Service-specific coloring
    let serviceColor = "gray";
    if (serviceName) {
      if (serviceName.includes("wa-client")) serviceColor = "blue";
      else if (serviceName.includes("control-plane")) serviceColor = "green";
      else if (serviceName.includes("scan-orchestrator"))
        serviceColor = "magenta";
      else if (serviceName.includes("redis")) serviceColor = "red";
      else if (serviceName.includes("postgres")) serviceColor = "cyan";
    }

    // Log level detection and coloring
    let levelColor = "white";
    let levelIcon = "ℹ";
    let level = "INFO";

    if (message.includes("ERROR") || message.includes("error")) {
      levelColor = "red";
      levelIcon = "✗";
      level = "ERROR";
    } else if (message.includes("WARN") || message.includes("warn")) {
      levelColor = "yellow";
      levelIcon = "⚠";
      level = "WARN";
    } else if (message.includes("SUCCESS") || message.includes("success")) {
      levelColor = "green";
      levelIcon = "✓";
      level = "SUCCESS";
    } else if (message.includes("DEBUG") || message.includes("debug")) {
      levelColor = "gray";
      levelIcon = "🐛";
      level = "DEBUG";
    }

    // Format the output
    const formattedLine = this.formatLogOutput({
      timestamp,
      service: serviceName,
      level,
      message,
      serviceColor,
      levelColor,
      levelIcon,
    });

    console.log(formattedLine);
  }

  formatLogOutput({
    timestamp,
    service,
    level,
    message,
    serviceColor,
    levelColor,
    levelIcon,
  }) {
    const parts = [];

    // Add timestamp if available
    if (timestamp) {
      parts.push(chalk.gray(`[${timestamp}]`));
    }

    // Add service name if available
    if (service) {
      parts.push(chalk[serviceColor].bold(`[${service}]`));
    }

    // Add level icon and text
    parts.push(chalk[levelColor](`${levelIcon} ${level}`));

    // Add the actual message
    parts.push(message);

    return parts.join(" ");
  }

  async checkServiceHealth(serviceName) {
    const composeInfo = await this.detectDockerCompose();

    try {
      // Get detailed container info
      const { stdout } = await execa(
        composeInfo.command[0],
        [...composeInfo.command.slice(1), "ps", "--format", "json"],
        {
          cwd: this.rootDir,
        },
      );

      const containers = JSON.parse(`[${stdout.trim().replace(/\n/g, ",")}]`);
      const serviceContainer = containers.find(
        (c) => c.Service === serviceName,
      );

      if (!serviceContainer) {
        return {
          service: serviceName,
          status: "not-found",
          healthy: false,
          state: "Not found",
          health: "N/A",
        };
      }

      return {
        service: serviceName,
        status: serviceContainer.State,
        healthy:
          serviceContainer.State === "running" &&
          serviceContainer.Health === "healthy",
        state: serviceContainer.State,
        health: serviceContainer.Health || "N/A",
        ports: serviceContainer.Ports || "N/A",
      };
    } catch (error) {
      throw new Error(
        `Failed to check health for ${serviceName}: ${error.message}`,
      );
    }
  }

  async checkAllServicesHealth() {
    const services = [
      "wa-client",
      "control-plane",
      "scan-orchestrator",
      "redis",
      "postgres",
    ];
    const results = [];

    for (const service of services) {
      try {
        const health = await this.checkServiceHealth(service);
        results.push(health);
      } catch (error) {
        results.push({
          service,
          status: "error",
          healthy: false,
          state: "Error",
          health: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Display health status for services
   * @param {Array} healthResults - Array of health result objects
   */
  displayHealthStatus(healthResults) {
    console.log(chalk.bold("\n🏥 Service Health Status:"));
    console.log("─".repeat(50));

    healthResults.forEach((result) => {
      let statusIcon = "⚠";
      let statusColor = "yellow";
      let statusText = "Unknown";

      if (result.healthy) {
        statusIcon = "✓";
        statusColor = "green";
        statusText = "Healthy";
      } else if (result.status === "not-found") {
        statusIcon = "✗";
        statusColor = "red";
        statusText = "Not Found";
      } else if (result.status === "error") {
        statusIcon = "✗";
        statusColor = "red";
        statusText = "Error";
      } else if (result.status === "running") {
        statusIcon = "⚠";
        statusColor = "yellow";
        statusText = "Running (Unhealthy)";
      }

      const serviceName = chalk.bold(result.service);
      const statusDisplay = chalk[statusColor](`${statusIcon} ${statusText}`);
      const stateDisplay = chalk.gray(`State: ${result.state}`);
      const healthDisplay = chalk.gray(`Health: ${result.health}`);

      console.log(`  ${serviceName} ${statusDisplay}`);
      console.log(`    ${stateDisplay} | ${healthDisplay}`);
    });

    console.log("─".repeat(50));
  }

  async startHealthMonitoring(services, interval = 5000) {
    const monitoringId = `health-monitor-${Date.now()}`;

    // Initial health check
    const initialHealth = await this.checkAllServicesHealth();
    this.displayHealthStatus(initialHealth);

    // Set up interval for continuous monitoring
    const intervalId = setInterval(async () => {
      try {
        const health = await this.checkAllServicesHealth();
        this.displayHealthStatus(health);
      } catch (error) {
        this.ui.error(`Health monitoring error: ${error.message}`);
      }
    }, interval);

    this.healthCheckIntervals.set(monitoringId, intervalId);

    return {
      stop: () => {
        clearInterval(intervalId);
        this.healthCheckIntervals.delete(monitoringId);
      },
    };
  }

  displayHealthStatus(healthResults) {
    console.log(chalk.bold("\n🏥 Service Health Status:"));
    console.log("─".repeat(50));

    healthResults.forEach((result) => {
      let statusIcon = "⚠";
      let statusColor = "yellow";
      let statusText = "Unknown";

      if (result.healthy) {
        statusIcon = "✓";
        statusColor = "green";
        statusText = "Healthy";
      } else if (result.status === "not-found") {
        statusIcon = "✗";
        statusColor = "red";
        statusText = "Not Found";
      } else if (result.status === "error") {
        statusIcon = "✗";
        statusColor = "red";
        statusText = "Error";
      } else if (result.status === "running") {
        statusIcon = "⚠";
        statusColor = "yellow";
        statusText = "Running (Unhealthy)";
      }

      const serviceName = chalk.bold(result.service);
      const statusDisplay = chalk[statusColor](`${statusIcon} ${statusText}`);
      const stateDisplay = chalk.gray(`State: ${result.state}`);
      const healthDisplay = chalk.gray(`Health: ${result.health}`);

      console.log(`  ${serviceName} ${statusDisplay}`);
      console.log(`    ${stateDisplay} | ${healthDisplay}`);
    });

    console.log("─".repeat(50));
  }

  async getContainerStatus() {
    const composeInfo = await this.detectDockerCompose();

    try {
      const { stdout } = await execa(
        composeInfo.command[0],
        [...composeInfo.command.slice(1), "ps", "--format", "json"],
        {
          cwd: this.rootDir,
        },
      );

      if (!stdout.trim()) {
        return [];
      }

      // Parse JSON output
      const containers = JSON.parse(`[${stdout.trim().replace(/\n/g, ",")}]`);
      return containers;
    } catch (error) {
      throw new Error(`Failed to get container status: ${error.message}`);
    }
  }

  stopAllLogStreams() {
    for (const [streamId, process] of this.activeLogStreams) {
      try {
        process.kill();
      } catch (error) {
        // Ignore errors when killing processes
      }
    }
    this.activeLogStreams.clear();
  }

  stopAllHealthMonitoring() {
    for (const [monitorId, intervalId] of this.healthCheckIntervals) {
      clearInterval(intervalId);
    }
    this.healthCheckIntervals.clear();
  }

  async getComposeInfo() {
    return await this.detectDockerCompose();
  }
}
