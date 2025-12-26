import { vi } from "vitest";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

// Test utilities and mocking infrastructure
export class TestUtilities {
  /**
   * Create a temporary directory for testing
   * @returns {Promise<string>} Path to temporary directory
   */
  static async createTempDir(prefix = "test-") {
    return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  }

  /**
   * Clean up temporary directory
   * @param {string} dirPath - Path to directory to clean up
   */
  static async cleanupTempDir(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Create a mock UI for testing
   * @returns {Object} Mock UI instance
   */
  static createMockUI() {
    return {
      messages: [],
      success(message) {
        this.messages.push({ type: "success", message });
      },
      error(message) {
        this.messages.push({ type: "error", message });
      },
      progress(message) {
        this.messages.push({ type: "progress", message });
      },
      info(message) {
        this.messages.push({ type: "info", message });
      },
      warn(message) {
        this.messages.push({ type: "warn", message });
      },
      getMessages() {
        return this.messages;
      },
      clearMessages() {
        this.messages = [];
      },
      async prompt(options) {
        return options.default || "";
      },
      async confirm(options) {
        return options.initial || false;
      },
      async select(options) {
        return options.choices?.[0]?.value || "";
      },
    };
  }

  /**
   * Create a mock environment detector
   * @returns {Object} Mock environment detector
   */
  static createMockEnvironmentDetector() {
    return {
      detectContainer: vi.fn().mockResolvedValue(false),
      detectCodespaces: vi.fn().mockReturnValue(false),
      detectPackageManager: vi.fn().mockResolvedValue("npm"),
      detectInitSystem: vi.fn().mockResolvedValue("systemd"),
      getPlatformInfo: vi.fn().mockReturnValue({
        platform: "linux",
        arch: "x64",
        release: "5.15.0",
        cpus: 4,
      }),
      detect: vi.fn().mockResolvedValue({
        isCodespaces: false,
        isContainer: false,
        packageManager: "npm",
        initSystem: "systemd",
        platform: {
          platform: "linux",
          arch: "x64",
          release: "5.15.0",
          cpus: 4,
        },
      }),
    };
  }

  /**
   * Create a mock dependency manager
   * @returns {Object} Mock dependency manager
   */
  static createMockDependencyManager() {
    return {
      getNodeVersion: vi.fn().mockReturnValue("20.0.0"),
      isVersionSufficient: vi.fn().mockReturnValue(true),
      ensureDocker: vi.fn().mockResolvedValue(),
      verifyDependencies: vi.fn().mockResolvedValue(true),
      ensureNodeJS: vi.fn().mockResolvedValue(),
      installNodeViaFnm: vi.fn().mockResolvedValue(),
      installNodeViaNodeSource: vi.fn().mockResolvedValue(),
    };
  }

  /**
   * Create a mock configuration manager
   * @param {string} rootDir - Root directory
   * @param {Object} ui - UI instance
   * @returns {Object} Mock configuration manager
   */
  static createMockConfigurationManager(rootDir, ui) {
    return {
      rootDir,
      ui,
      currentConfig: {},
      async loadOrCreateConfig() {
        return this.currentConfig;
      },
      async updateConfig(apiKeys) {
        this.currentConfig = { ...this.currentConfig, ...apiKeys };
      },
      getConfig() {
        return this.currentConfig;
      },
      parseConfig(configContent) {
        const config = {};
        const lines = configContent.split("\n");

        for (const line of lines) {
          if (line.trim() && !line.startsWith("#")) {
            const [key, value] = line.split("=");
            if (key && value !== undefined) {
              config[key.trim()] = value.trim();
            }
          }
        }

        return config;
      },
    };
  }

  /**
   * Create a mock docker orchestrator
   * @param {string} rootDir - Root directory
   * @param {Object} ui - UI instance
   * @returns {Object} Mock docker orchestrator
   */
  static createMockDockerOrchestrator(rootDir, ui) {
    return {
      rootDir,
      ui,
      activeLogStreams: new Map(),
      healthCheckIntervals: new Map(),
      async detectDockerCompose() {
        return {
          command: ["docker", "compose"],
          version: "v2",
          supportsComposeV2: true,
        };
      },
      async buildAndStartServices() {
        return true;
      },
      async getServiceStatus() {
        return "wa-client Up, control-plane Up, scan-orchestrator Up";
      },
      async streamLogsWithFormatting(serviceName, options) {
        return {
          process: { on: vi.fn(), kill: vi.fn() },
          stop: vi.fn(),
        };
      },
      async checkAllServicesHealth() {
        return [
          {
            service: "wa-client",
            status: "running",
            healthy: true,
            state: "running",
            health: "healthy",
          },
          {
            service: "control-plane",
            status: "running",
            healthy: true,
            state: "running",
            health: "healthy",
          },
          {
            service: "scan-orchestrator",
            status: "running",
            healthy: true,
            state: "running",
            health: "healthy",
          },
        ];
      },
      displayHealthStatus(healthResults) {
        // Mock display method
      },
      stopAllLogStreams() {
        this.activeLogStreams.clear();
      },
      stopAllHealthMonitoring() {
        this.healthCheckIntervals.clear();
      },
    };
  }

  /**
   * Create a mock pairing manager
   * @param {Object} dockerOrchestrator - Docker orchestrator
   * @param {Object} ui - UI instance
   * @param {Object} notifications - Notifications instance
   * @returns {Object} Mock pairing manager
   */
  static createMockPairingManager(dockerOrchestrator, ui, notifications) {
    return {
      dockerOrchestrator,
      ui,
      notifications,
      pairingCodeData: null,
      countdownInterval: null,
      expirationTime: null,
      pairingSuccessPatterns: [
        "remote_session_saved",
        "authentication successful",
        "session established",
        "pairing complete",
        "connected to whatsapp",
      ],
      extractPairingCode(line) {
        const match = line.match(/code: (\d+)/);
        return match ? match[1] : null;
      },
      extractPhoneNumber(line) {
        const match = line.match(/phone: (\+\d+)/);
        return match ? match[1] : null;
      },
      generateSimulatedPairingCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
      },
      isPairingSuccessEvent(line) {
        return this.pairingSuccessPatterns.some((pattern) =>
          line.toLowerCase().includes(pattern.toLowerCase()),
        );
      },
      isRateLimitError(line) {
        const rateLimitPatterns = [
          "rate limit",
          "too many requests",
          "429",
          "quota exceeded",
          "request limit",
        ];

        return rateLimitPatterns.some((pattern) =>
          line.toLowerCase().includes(pattern.toLowerCase()),
        );
      },
      startCountdownTimer() {
        // Mock countdown timer
      },
      stopCountdownTimer() {
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
      },
      handlePairingCode(code, phone) {
        this.pairingCodeData = { code, phone };
        this.expirationTime = new Date(Date.now() + 120000);
      },
      async requestManualPairing() {
        const phone = await this.ui.prompt({
          message:
            "Enter phone number to pair (with country code, e.g., +1234567890):",
          validate: (value) => {
            if (!value) return "Phone number is required";
            if (!/^\+?[0-9\s-]+$/.test(value))
              return "Invalid phone number format";
            return true;
          },
          required: true,
        });

        const simulatedCode = this.generateSimulatedPairingCode();
        this.handlePairingCode(simulatedCode, phone);
      },
    };
  }

  /**
   * Create a mock logger
   * @param {Object} options - Logger options
   * @returns {Object} Mock logger
   */
  static createMockLogger(options = {}) {
    return {
      options,
      logs: [],
      info(message, data) {
        this.logs.push({ level: "info", message, data });
      },
      error(message, data) {
        this.logs.push({ level: "error", message, data });
      },
      warn(message, data) {
        this.logs.push({ level: "warn", message, data });
      },
      async logStepCompletion(step, name, data) {
        this.logs.push({ level: "step", step, name, data });
      },
      getLogFilePath() {
        return "/tmp/setup-wizard.log";
      },
    };
  }

  /**
   * Mock execa command execution
   * @param {Object} commands - Commands to mock
   * @returns {Function} Mock execa function
   */
  static mockExeca(commands = {}) {
    return vi.fn().mockImplementation((cmd) => {
      if (typeof cmd === "string") {
        if (commands[cmd]) {
          return commands[cmd];
        }
      } else if (Array.isArray(cmd)) {
        const cmdStr = cmd.join(" ");
        if (commands[cmdStr]) {
          return commands[cmdStr];
        }
      }

      // Default mock responses
      if (cmd === "docker" || (Array.isArray(cmd) && cmd.includes("docker"))) {
        return Promise.resolve({ stdout: "Docker version 20.10.7" });
      }

      if (cmd === "node" || (Array.isArray(cmd) && cmd.includes("node"))) {
        return Promise.resolve({ stdout: "v20.0.0" });
      }

      return Promise.reject(new Error("Command not found"));
    });
  }

  /**
   * Create a test configuration file
   * @param {string} dirPath - Directory path
   * @param {Object} config - Configuration data
   * @returns {Promise<string>} Path to created config file
   */
  static async createTestConfigFile(dirPath, config = {}) {
    const configContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const configPath = path.join(dirPath, ".env");
    await fs.writeFile(configPath, configContent);
    return configPath;
  }

  /**
   * Create a test template file
   * @param {string} dirPath - Directory path
   * @param {Object} template - Template data
   * @returns {Promise<string>} Path to created template file
   */
  static async createTestTemplateFile(dirPath, template = {}) {
    const templateContent = Object.entries(template)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const templatePath = path.join(dirPath, ".env.hobby");
    await fs.writeFile(templatePath, templateContent);
    return templatePath;
  }
}

// Export utilities for use in tests
export const {
  createTempDir,
  cleanupTempDir,
  createMockUI,
  createMockEnvironmentDetector,
  createMockDependencyManager,
  createMockConfigurationManager,
  createMockDockerOrchestrator,
  createMockPairingManager,
  createMockLogger,
  mockExeca,
  createTestConfigFile,
  createTestTemplateFile,
} = TestUtilities;
