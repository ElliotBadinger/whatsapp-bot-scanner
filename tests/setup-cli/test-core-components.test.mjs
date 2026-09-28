import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import * as execa from "execa";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

// Import the components to test
import { DockerOrchestrator } from "../../scripts/cli/core/docker.mjs";
import { PairingManager } from "../../scripts/cli/core/pairing.mjs";
import { SetupWizard } from "../../scripts/cli/core/setup-wizard.mjs";
import { UserInterface } from "../../scripts/cli/ui/prompts.mjs";
import { ProgressManager } from "../../scripts/cli/ui/progress.mjs";
import { NotificationManager } from "../../scripts/cli/ui/notifications.mjs";
import { Logger } from "../../scripts/cli/utils/logging.mjs";

// Mock UI for testing
class MockUI {
  constructor() {
    this.messages = [];
  }

  success(message) {
    this.messages.push({ type: "success", message });
  }

  error(message) {
    this.messages.push({ type: "error", message });
  }

  progress(message) {
    this.messages.push({ type: "progress", message });
  }

  info(message) {
    this.messages.push({ type: "info", message });
  }

  warn(message) {
    this.messages.push({ type: "warn", message });
  }

  getMessages() {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
  }

  async prompt(options) {
    return options.default || "";
  }

  async confirm(options) {
    return options.initial || false;
  }

  async select(options) {
    return options.choices?.[0]?.value || "";
  }
}

class MockEnvironmentDetector {
  detectContainer() {
    return Promise.resolve(false);
  }
}

class MockDependencyManager {
  getNodeVersion() {
    return "20.0.0";
  }

  isVersionSufficient(version) {
    return version >= "20.0.0";
  }

  ensureDocker() {
    return Promise.resolve();
  }

  verifyDependencies() {
    return Promise.resolve(true);
  }
}

class MockConfigurationManager {
  constructor(rootDir, ui) {
    this.rootDir = rootDir;
    this.ui = ui;
    this.currentConfig = {};
  }

  async loadOrCreateConfig() {
    return this.currentConfig;
  }

  async updateConfig(apiKeys) {
    this.currentConfig = { ...this.currentConfig, ...apiKeys };
  }

  getConfig() {
    return this.currentConfig;
  }
}

class MockDockerOrchestrator {
  constructor(rootDir, ui) {
    this.rootDir = rootDir;
    this.ui = ui;
  }

  async getComposeInfo() {
    return {
      command: ["docker", "compose"],
      version: "v2",
      supportsComposeV2: true,
    };
  }

  async buildAndStartServices() {
    return Promise.resolve();
  }

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
  }

  async getServiceStatus() {
    return "wa-client Up, control-plane Up, scan-orchestrator Up";
  }

  async streamLogsWithFormatting(serviceName, options) {
    return {
      process: { on: () => {}, kill: () => {} },
      stop: () => {},
    };
  }
}

class MockLogger {
  constructor(options) {
    this.options = options;
    this.logs = [];
  }

  info(message, data) {
    this.logs.push({ level: "info", message, data });
  }

  error(message, data) {
    this.logs.push({ level: "error", message, data });
  }

  warn(message, data) {
    this.logs.push({ level: "warn", message, data });
  }

  async logStepCompletion(step, name, data) {
    this.logs.push({ level: "step", step, name, data });
  }

  getLogFilePath() {
    return "/tmp/setup-wizard.log";
  }
}

describe("DockerOrchestrator Tests", () => {
  let dockerOrchestrator;
  let mockUI;
  let tempDir;

  beforeEach(async () => {
    mockUI = new MockUI();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "docker-test-"));
    dockerOrchestrator = new DockerOrchestrator(tempDir, mockUI);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Docker Compose Detection", () => {
    it("should detect Docker Compose v2", async () => {
      const mockExeca = vi
        .fn()
        .mockResolvedValue({ stdout: "Docker Compose version v2.23.0" });
      execa.execa.mockImplementation(mockExeca);

      const result = await dockerOrchestrator.detectDockerCompose();
      expect(result.supportsComposeV2).toBe(true);
      expect(result.command).toEqual(["docker", "compose"]);

      vi.restoreAllMocks();
    });

    it("should detect legacy docker-compose", async () => {
      const mockExeca = vi.fn();
      mockExeca.mockImplementation((cmd, args) => {
        if (cmd === "docker" && Array.isArray(args) && args[0] === "compose") {
          return Promise.reject(new Error("Command failed"));
        }
        if (cmd === "docker-compose") {
          return Promise.resolve({ stdout: "docker-compose version 1.29.2" });
        }
        return Promise.reject(new Error("Command not found"));
      });
      execa.execa.mockImplementation(mockExeca);

      const result = await dockerOrchestrator.detectDockerCompose();
      expect(result.supportsComposeV2).toBe(false);
      expect(result.command).toEqual(["docker-compose"]);

      vi.restoreAllMocks();
    });
  });

  describe("Service Management", () => {
    it("should build and start services successfully", async () => {
      const mockExeca = vi.fn().mockResolvedValue({ stdout: "Building..." });
      execa.execa.mockImplementation(mockExeca);

      const result = await dockerOrchestrator.buildAndStartServices();
      expect(result).toBe(true);

      vi.restoreAllMocks();
    });

    it("should handle service build failures", async () => {
      const mockExeca = vi.fn().mockImplementation((cmd, args) => {
        if (
          cmd === "docker" &&
          Array.isArray(args) &&
          args[0] === "compose" &&
          args[1] === "version"
        ) {
          return Promise.resolve({ stdout: "Docker Compose version v2.23.0" });
        }
        if (
          cmd === "docker" &&
          Array.isArray(args) &&
          args[0] === "compose" &&
          args[1] === "build"
        ) {
          return Promise.reject(new Error("Build failed"));
        }
        return Promise.resolve({ stdout: "" });
      });
      execa.execa.mockImplementation(mockExeca);

      await expect(dockerOrchestrator.buildAndStartServices()).rejects.toThrow(
        "Failed to build and start services",
      );

      vi.restoreAllMocks();
    });
  });

  describe("Service Health Monitoring", () => {
    it("should check service health and return results", async () => {
      const mockExeca = vi.fn().mockImplementation((cmd, args) => {
        if (
          cmd === "docker" &&
          Array.isArray(args) &&
          args[0] === "compose" &&
          args[1] === "version"
        ) {
          return Promise.resolve({ stdout: "Docker Compose version v2.23.0" });
        }
        if (
          cmd === "docker" &&
          Array.isArray(args) &&
          args[0] === "compose" &&
          args[1] === "ps"
        ) {
          return Promise.resolve({
            stdout: JSON.stringify([
              { Service: "wa-client", State: "running", Health: "healthy" },
              { Service: "control-plane", State: "running", Health: "healthy" },
            ]),
          });
        }
        return Promise.resolve({ stdout: "" });
      });
      execa.execa.mockImplementation(mockExeca);

      const results = await dockerOrchestrator.checkAllServicesHealth();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("service");
      expect(results[0]).toHaveProperty("healthy");

      vi.restoreAllMocks();
    });

    it("should handle service health check failures", async () => {
      const mockExeca = vi.fn().mockImplementation((cmd, args) => {
        if (
          cmd === "docker" &&
          Array.isArray(args) &&
          args[0] === "compose" &&
          args[1] === "version"
        ) {
          return Promise.resolve({ stdout: "Docker Compose version v2.23.0" });
        }
        if (
          cmd === "docker" &&
          Array.isArray(args) &&
          args[0] === "compose" &&
          args[1] === "ps"
        ) {
          return Promise.reject(new Error("Health check failed"));
        }
        return Promise.resolve({ stdout: "" });
      });
      execa.execa.mockImplementation(mockExeca);

      await expect(
        dockerOrchestrator.checkServiceHealth("wa-client"),
      ).rejects.toThrow("Failed to check health for wa-client");

      vi.restoreAllMocks();
    });
  });

  describe("PairingManager Tests", () => {
    let pairingManager;
    let mockDockerOrchestrator;
    let mockUI;
    let mockNotifications;

    beforeEach(() => {
      mockUI = new MockUI();
      mockNotifications = {
        triggerPairingAlert: vi.fn(),
        updateCountdownDisplay: vi.fn(),
        showCodeExpiredMessage: vi.fn(),
      };
      mockDockerOrchestrator = new MockDockerOrchestrator("/tmp", mockUI);
      pairingManager = new PairingManager(
        mockDockerOrchestrator,
        mockUI,
        mockNotifications,
      );
    });

    describe("Pairing Code Handling", () => {
      it("should extract pairing code from log line", () => {
        const line = "Requested phone-number pairing code: 123456";
        const code = pairingManager.extractPairingCode(line);
        expect(code).toBe("123456");
      });

      it("should extract phone number from log line", () => {
        const line = "phone: +1234567890";
        const phone = pairingManager.extractPhoneNumber(line);
        expect(phone).toBe("+1234567890");
      });

      it("should generate simulated pairing code", () => {
        const code = pairingManager.generateSimulatedPairingCode();
        expect(code).toMatch(/^\d{6}$/);
      });
    });

    describe("Pairing Success Detection", () => {
      it("should detect pairing success events", () => {
        pairingManager.setupPairingSuccessDetection(vi.fn(), vi.fn());

        const successLine = "Successfully paired with WhatsApp";
        const isSuccess = pairingManager.isPairingSuccessEvent(successLine);
        expect(isSuccess).toBe(true);
      });

      it("should detect rate limit errors", () => {
        const rateLimitLine = "Rate limit exceeded for pairing requests";
        const isRateLimit = pairingManager.isRateLimitError(rateLimitLine);
        expect(isRateLimit).toBe(true);
      });
    });

    describe("Countdown Timer", () => {
      it("should start and stop countdown timer", () => {
        // Mock setInterval and clearInterval
        const originalSetInterval = global.setInterval;
        const originalClearInterval = global.clearInterval;
        const mockSetInterval = vi.fn().mockReturnValue(1);
        const mockClearInterval = vi.fn();
        global.setInterval = mockSetInterval;
        global.clearInterval = mockClearInterval;

        pairingManager.expirationTime = new Date(Date.now() + 120000);
        pairingManager.startCountdownTimer();

        expect(mockSetInterval).toHaveBeenCalled();

        pairingManager.stopCountdownTimer();
        expect(mockClearInterval).toHaveBeenCalled();

        // Restore original functions
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
      });
    });
  });

  describe("SetupWizard Tests", () => {
    let setupWizard;
    let tempDir;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wizard-test-"));
      const mockUI = new MockUI();
      const mockLogger = new MockLogger({ debug: false });

      setupWizard = new SetupWizard({
        rootDir: tempDir,
        interactive: false,
        argv: [],
      });

      // Replace components with mocks
      setupWizard.ui = mockUI;
      setupWizard.logger = mockLogger;
      setupWizard.envDetector = new MockEnvironmentDetector();
      setupWizard.dependencyManager = new MockDependencyManager();
      setupWizard.configManager = new MockConfigurationManager(tempDir, mockUI);
      setupWizard.dockerOrchestrator = new MockDockerOrchestrator(
        tempDir,
        mockUI,
      );
      setupWizard.pairingManager = new PairingManager(
        setupWizard.dockerOrchestrator,
        mockUI,
        new NotificationManager(mockUI),
      );
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe("Wizard Initialization", () => {
      it("should initialize with correct default values", () => {
        expect(setupWizard.currentStep).toBe(0);
        expect(setupWizard.totalSteps).toBe(5);
        expect(setupWizard.interactive).toBe(false);
      });

      it("should have all required components", () => {
        expect(setupWizard.ui).toBeDefined();
        expect(setupWizard.logger).toBeDefined();
        expect(setupWizard.envDetector).toBeDefined();
        expect(setupWizard.dependencyManager).toBeDefined();
        expect(setupWizard.configManager).toBeDefined();
        expect(setupWizard.dockerOrchestrator).toBeDefined();
        expect(setupWizard.pairingManager).toBeDefined();
      });
    });

    describe("Step Execution", () => {
      it("should execute step 1 - prerequisites check", async () => {
        await setupWizard.step1PrerequisitesCheck();

        expect(setupWizard.currentStep).toBe(1);
        expect(setupWizard.setupData.prerequisites).toBeDefined();
        expect(setupWizard.setupData.prerequisites.nodeVersion).toBe("20.0.0");
      });

      it("should execute step 2 - API keys collection", async () => {
        // Mock the prompt to return test API keys
        const originalPrompt = setupWizard.ui.prompt;
        setupWizard.ui.prompt = vi.fn().mockImplementation((options) => {
          if (options.message.includes("VirusTotal")) {
            return "VT_TEST_KEY_12345678901234567890123456789012";
          }
          return "";
        });

        await setupWizard.step2ApiKeysCollection();

        expect(setupWizard.currentStep).toBe(2);
        expect(setupWizard.setupData.apiKeys).toBeDefined();
        expect(setupWizard.setupData.apiKeys.virusTotalConfigured).toBe(true);

        setupWizard.ui.prompt = originalPrompt;
      });
    });

    describe("Error Handling", () => {
      it("should handle wizard errors gracefully", () => {
        const error = new Error("Test error");
        const result = setupWizard.handleWizardError(error);

        // Should not throw, just handle the error
        expect(result).toBeUndefined();
      });
    });
  });

  describe("UI Components Tests", () => {
    describe("UserInterface Tests", () => {
      let ui;

      beforeEach(() => {
        ui = new UserInterface(false); // Non-interactive mode
      });

      it("should handle non-interactive mode correctly", async () => {
        const result = await ui.prompt({
          message: "Test",
          default: "default-value",
        });
        expect(result).toBe("default-value");
      });

      it("should handle confirm in non-interactive mode", async () => {
        const result = await ui.confirm({ message: "Test", initial: true });
        expect(result).toBe(true);
      });

      it("should handle select in non-interactive mode", async () => {
        const result = await ui.select({
          message: "Test",
          choices: [{ name: "Option 1", value: "opt1" }],
        });
        expect(result).toBe("opt1");
      });
    });

    describe("ProgressManager Tests", () => {
      let progressManager;

      beforeEach(() => {
        progressManager = new ProgressManager();
      });

      it("should start and stop progress spinners", () => {
        progressManager.start("test-task", "Test message");
        expect(progressManager.spinners.size).toBe(1);

        progressManager.stop("test-task");
        expect(progressManager.spinners.size).toBe(0);
      });

      it("should stop all spinners", () => {
        progressManager.start("task1", "Message 1");
        progressManager.start("task2", "Message 2");
        expect(progressManager.spinners.size).toBe(2);

        progressManager.stopAll();
        expect(progressManager.spinners.size).toBe(0);
      });
    });

    describe("NotificationManager Tests", () => {
      let notificationManager;
      let mockUI;

      beforeEach(() => {
        mockUI = new MockUI();
        notificationManager = new NotificationManager(mockUI);
      });

      it("should trigger pairing alert", () => {
        notificationManager.triggerPairingAlert("123456", "+1234567890");
        expect(mockUI.messages.some((m) => m.type === "success")).toBe(true);
      });

      it("should handle countdown updates", () => {
        notificationManager.currentDisplay = {
          code: "123456",
          phone: "+1234567890",
        };
        notificationManager.updateCountdownDisplay("01:30");
        // Should not throw errors
      });
    });
  });

  describe("Integration Tests", () => {
    describe("Component Interaction Tests", () => {
      it("should integrate DockerOrchestrator with SetupWizard", async () => {
        const tempDir = await fs.mkdtemp(
          path.join(os.tmpdir(), "integration-test-"),
        );
        const mockUI = new MockUI();

        const wizard = new SetupWizard({
          rootDir: tempDir,
          interactive: false,
          argv: [],
        });

        // Replace with mocks
        wizard.ui = mockUI;
        wizard.logger = new MockLogger({ debug: false });
        wizard.envDetector = new MockEnvironmentDetector();
        wizard.dependencyManager = new MockDependencyManager();
        wizard.configManager = new MockConfigurationManager(tempDir, mockUI);
        wizard.dockerOrchestrator = new MockDockerOrchestrator(tempDir, mockUI);
        wizard.pairingManager = new PairingManager(
          wizard.dockerOrchestrator,
          mockUI,
          new NotificationManager(mockUI),
        );

        // Test the integration
        await wizard.step1PrerequisitesCheck();
        expect(wizard.setupData.prerequisites).toBeDefined();

        await fs.rm(tempDir, { recursive: true, force: true });
      });
    });

    describe("Error Handling Integration", () => {
      it("should handle errors across components", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "error-test-"));
        const mockUI = new MockUI();

        const wizard = new SetupWizard({
          rootDir: tempDir,
          interactive: false,
          argv: [],
        });

        // Replace with mocks that will fail
        wizard.ui = mockUI;
        wizard.logger = new MockLogger({ debug: false });
        wizard.envDetector = new MockEnvironmentDetector();

        // Mock dependency manager to fail
        const failingDependencyManager = {
          getNodeVersion: () => null,
          isVersionSufficient: () => false,
          ensureDocker: () => Promise.resolve(),
          verifyDependencies: () => Promise.resolve(true),
        };

        wizard.dependencyManager = failingDependencyManager;
        wizard.configManager = new MockConfigurationManager(tempDir, mockUI);
        wizard.dockerOrchestrator = new MockDockerOrchestrator(tempDir, mockUI);
        wizard.pairingManager = new PairingManager(
          wizard.dockerOrchestrator,
          mockUI,
          new NotificationManager(mockUI),
        );

        // Test error handling
        await expect(wizard.step1PrerequisitesCheck()).rejects.toThrow();

        await fs.rm(tempDir, { recursive: true, force: true });
      });
    });
  });
});
