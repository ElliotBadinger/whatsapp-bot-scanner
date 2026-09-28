import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import * as execa from "execa";

// Import the unified CLI system
import { UnifiedCLI } from "../../scripts/cli/core/unified-cli.mjs";
import { UserInterface } from "../../scripts/cli/ui/prompts.mjs";
import { ProgressManager } from "../../scripts/cli/ui/progress.mjs";
import { NotificationManager } from "../../scripts/cli/ui/notifications.mjs";
import { EnvironmentDetector } from "../../scripts/cli/core/environment.mjs";
import { DependencyManager } from "../../scripts/cli/core/dependencies.mjs";
import { ConfigurationManager } from "../../scripts/cli/core/configuration.mjs";
import { DockerOrchestrator } from "../../scripts/cli/core/docker.mjs";
import { PairingManager } from "../../scripts/cli/core/pairing.mjs";
import { SetupWizard } from "../../scripts/cli/core/setup-wizard.mjs";

// Mock classes for testing
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

describe("UnifiedCLI System Tests", () => {
  let unifiedCLI;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unified-cli-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("CLI Initialization", () => {
    it("should initialize with correct default values", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.interactive).toBe(false);
      expect(cli.rootDir).toBe(process.cwd());
      expect(cli.ui).toBeInstanceOf(UserInterface);
      expect(cli.progress).toBeInstanceOf(ProgressManager);
    });

    it("should initialize with interactive mode when no --noninteractive flag", () => {
      const cli = new UnifiedCLI([]);
      expect(cli.interactive).toBe(true);
    });
  });

  describe("CLI Component Integration", () => {
    it("should have all required components initialized", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.dockerOrchestrator).toBeInstanceOf(DockerOrchestrator);
    });

    it("should initialize setup wizard when run is called", async () => {
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Mock the setup wizard to prevent actual execution
      const mockSetupWizard = {
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      // Replace the setup wizard creation
      const createWizardSpy = vi
        .spyOn(cli, "createSetupWizard")
        .mockReturnValue(mockSetupWizard);

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      await cli.run();

      expect(mockSetupWizard.run).toHaveBeenCalled();
      expect(createWizardSpy).toHaveBeenCalled();

      // Restore originals
      createWizardSpy.mockRestore();
      vi.restoreAllMocks();
      process.exit = originalExit;
    });
  });

  describe("CLI Service Management", () => {
    it("should stream service logs with formatting", async () => {
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Mock the docker orchestrator
      const mockStreamLogs = vi.fn().mockResolvedValue({
        process: { on: vi.fn(), kill: vi.fn() },
        stop: vi.fn(),
      });

      cli.dockerOrchestrator.streamLogsWithFormatting = mockStreamLogs;

      const result = await cli.streamServiceLogs("wa-client");
      expect(result).toBeDefined();
      expect(mockStreamLogs).toHaveBeenCalledWith("wa-client", {});
    });

    it("should check service health status", async () => {
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Mock the docker orchestrator
      const mockHealthResults = [
        { service: "wa-client", status: "running", healthy: true },
        { service: "control-plane", status: "running", healthy: true },
      ];

      cli.dockerOrchestrator.checkAllServicesHealth = vi
        .fn()
        .mockResolvedValue(mockHealthResults);
      cli.dockerOrchestrator.displayHealthStatus = vi.fn();

      const result = await cli.checkServiceHealth();
      expect(result).toEqual(mockHealthResults);
      expect(cli.dockerOrchestrator.displayHealthStatus).toHaveBeenCalledWith(
        mockHealthResults,
      );
    });
  });

  describe("CLI Error Handling", () => {
    it("should handle errors in streamServiceLogs", async () => {
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Mock the docker orchestrator to throw error
      cli.dockerOrchestrator.streamLogsWithFormatting = vi
        .fn()
        .mockRejectedValue(new Error("Log streaming failed"));

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      await expect(cli.streamServiceLogs("wa-client")).rejects.toThrow();

      // Restore original
      process.exit = originalExit;
    });

    it("should handle errors in checkServiceHealth", async () => {
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Mock the docker orchestrator to throw error
      cli.dockerOrchestrator.checkAllServicesHealth = vi
        .fn()
        .mockRejectedValue(new Error("Health check failed"));

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      await expect(cli.checkServiceHealth()).rejects.toThrow();

      // Restore original
      process.exit = originalExit;
    });
  });
});

describe("CLI Integration Tests", () => {
  describe("End-to-End Workflow Tests", () => {
    it("should execute complete CLI workflow successfully", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "e2e-test-"));
      const mockUI = new MockUI();

      // Create a unified CLI instance
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Replace components with mocks
      cli.ui = mockUI;
      cli.rootDir = tempDir;

      // Mock the setup wizard
      const mockSetupWizard = {
        run: vi.fn().mockResolvedValue({
          success: true,
          message: "Setup completed successfully!",
          data: { steps: 5, completed: true },
        }),
      };

      // Replace the setup wizard creation
      const createWizardSpy = vi
        .spyOn(cli, "createSetupWizard")
        .mockReturnValue(mockSetupWizard);

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      // Execute the CLI
      const result = await cli.run();

      expect(result.success).toBe(true);
      expect(result.message).toBe("Setup completed successfully!");
      expect(mockSetupWizard.run).toHaveBeenCalled();
      expect(createWizardSpy).toHaveBeenCalled();

      // Restore originals
      createWizardSpy.mockRestore();
      vi.restoreAllMocks();
      process.exit = originalExit;

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should handle CLI workflow failures gracefully", async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "e2e-fail-test-"),
      );
      const mockUI = new MockUI();

      // Create a unified CLI instance
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Replace components with mocks
      cli.ui = mockUI;
      cli.rootDir = tempDir;

      // Mock the setup wizard to fail
      const mockSetupWizard = {
        run: vi
          .fn()
          .mockRejectedValue(
            new Error("Setup failed due to missing dependencies"),
          ),
      };

      // Replace the setup wizard creation
      const createWizardSpy = vi
        .spyOn(cli, "createSetupWizard")
        .mockReturnValue(mockSetupWizard);

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      // Execute the CLI and expect it to handle the error path
      const result = await cli.run();

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          message: "Setup failed",
        }),
      );
      expect(mockSetupWizard.run).toHaveBeenCalled();
      expect(createWizardSpy).toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();

      // Restore originals
      createWizardSpy.mockRestore();
      vi.restoreAllMocks();
      process.exit = originalExit;

      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe("CLI Command Integration", () => {
    it("should handle different CLI arguments correctly", () => {
      const interactiveCLI = new UnifiedCLI([]);
      expect(interactiveCLI.interactive).toBe(true);

      const nonInteractiveCLI = new UnifiedCLI(["--noninteractive"]);
      expect(nonInteractiveCLI.interactive).toBe(false);

      const mixedArgsCLI = new UnifiedCLI(["--noninteractive", "--debug"]);
      expect(mixedArgsCLI.interactive).toBe(false);
    });

    it("should initialize components based on CLI arguments", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.ui).toBeInstanceOf(UserInterface);
      expect(cli.ui.interactive).toBe(false);
    });
  });
});

describe("CLI Utility Tests", () => {
  describe("CLI Helper Methods", () => {
    it("should get setup wizard instance", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.getSetupWizard()).toBeUndefined(); // Not initialized yet

      // Mock setup wizard
      const mockWizard = { test: "wizard" };
      cli.setupWizard = mockWizard;

      expect(cli.getSetupWizard()).toBe(mockWizard);
    });

    it("should check if setup wizard is initialized", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.hasSetupWizard()).toBe(false);

      cli.setupWizard = { test: "wizard" };
      expect(cli.hasSetupWizard()).toBe(true);
    });

    it("should get docker orchestrator instance", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.getDockerOrchestrator()).toBeInstanceOf(DockerOrchestrator);
    });
  });

  describe("CLI Health Monitoring", () => {
    it("should start health monitoring for services", async () => {
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Mock the docker orchestrator
      cli.dockerOrchestrator.startHealthMonitoring = vi.fn().mockResolvedValue({
        stop: vi.fn(),
      });

      const result = await cli.startHealthMonitoring([
        "wa-client",
        "control-plane",
      ]);
      expect(result).toBeDefined();
      expect(cli.dockerOrchestrator.startHealthMonitoring).toHaveBeenCalledWith(
        ["wa-client", "control-plane"],
        5000,
      );
    });

    it("should handle health monitoring errors", async () => {
      const cli = new UnifiedCLI(["--noninteractive"]);

      // Mock the docker orchestrator to throw error
      cli.dockerOrchestrator.startHealthMonitoring = vi
        .fn()
        .mockRejectedValue(new Error("Monitoring failed"));

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      await expect(cli.startHealthMonitoring(["wa-client"])).rejects.toThrow();

      // Restore original
      process.exit = originalExit;
    });
  });
});
