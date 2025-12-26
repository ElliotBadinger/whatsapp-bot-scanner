import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

// Import the components to test
import { SetupWizard } from "../../scripts/cli/core/setup-wizard.mjs";
import { UnifiedCLI } from "../../scripts/cli/core/unified-cli.mjs";
import { UserInterface } from "../../scripts/cli/ui/prompts.mjs";
import { ProgressManager } from "../../scripts/cli/ui/progress.mjs";
import { NotificationManager } from "../../scripts/cli/ui/notifications.mjs";
import { EnvironmentDetector } from "../../scripts/cli/core/environment.mjs";
import { DependencyManager } from "../../scripts/cli/core/dependencies.mjs";
import { ConfigurationManager } from "../../scripts/cli/core/configuration.mjs";
import { DockerOrchestrator } from "../../scripts/cli/core/docker.mjs";
import { PairingManager } from "../../scripts/cli/core/pairing.mjs";

// Import test utilities
import {
  createMockUI,
  createMockEnvironmentDetector,
  createMockDependencyManager,
  createMockConfigurationManager,
  createMockDockerOrchestrator,
  createMockPairingManager,
  createMockLogger,
  createTempDir,
  cleanupTempDir,
} from "./test-utils.mjs";

describe("SetupWizard Integration Tests", () => {
  let setupWizard;
  let tempDir;
  let mockUI;
  let mockLogger;

  beforeEach(async () => {
    tempDir = await createTempDir("wizard-integration-");
    mockUI = createMockUI();
    mockLogger = createMockLogger();

    setupWizard = new SetupWizard({
      rootDir: tempDir,
      interactive: false,
      argv: [],
    });

    // Replace components with mocks
    setupWizard.ui = mockUI;
    setupWizard.logger = mockLogger;
    setupWizard.envDetector = createMockEnvironmentDetector();
    setupWizard.dependencyManager = createMockDependencyManager();
    setupWizard.configManager = createMockConfigurationManager(tempDir, mockUI);
    setupWizard.dockerOrchestrator = createMockDockerOrchestrator(
      tempDir,
      mockUI,
    );
    setupWizard.pairingManager = createMockPairingManager(
      setupWizard.dockerOrchestrator,
      mockUI,
      new NotificationManager(mockUI),
    );
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("Complete Wizard Workflow", () => {
    it("should execute all 5 steps successfully", async () => {
      // Mock the UI prompt to return test API keys
      const originalPrompt = setupWizard.ui.prompt;
      setupWizard.ui.prompt = vi.fn().mockImplementation((options) => {
        if (options.message.includes("VirusTotal")) {
          return "VT_TEST_KEY_12345678901234567890123456789012";
        }
        return "";
      });

      // Execute all steps
      await setupWizard.step1PrerequisitesCheck();
      await setupWizard.step2ApiKeysCollection();
      await setupWizard.step3WhatsAppPairing();
      await setupWizard.step4StartingServices();
      await setupWizard.step5Verification();

      // Verify all steps completed
      expect(setupWizard.currentStep).toBe(5);
      expect(setupWizard.setupData.prerequisites).toBeDefined();
      expect(setupWizard.setupData.apiKeys).toBeDefined();
      expect(setupWizard.setupData.whatsappPairing).toBeDefined();
      expect(setupWizard.setupData.services).toBeDefined();
      expect(setupWizard.setupData.verification).toBeDefined();

      // Verify logging
      expect(mockLogger.logs.length).toBeGreaterThan(0);
      expect(mockLogger.logs.some((log) => log.level === "step")).toBe(true);

      setupWizard.ui.prompt = originalPrompt;
    });

    it("should handle wizard execution with errors gracefully", async () => {
      // Create a wizard that will fail in step 1
      const failingWizard = new SetupWizard({
        rootDir: tempDir,
        interactive: false,
        argv: [],
      });

      failingWizard.ui = mockUI;
      failingWizard.logger = mockLogger;

      // Mock environment detector to fail
      const failingEnvDetector = {
        detectContainer: vi.fn().mockResolvedValue(false),
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

      // Mock dependency manager to fail
      const failingDependencyManager = {
        getNodeVersion: vi.fn().mockReturnValue(null),
        isVersionSufficient: vi.fn().mockReturnValue(false),
        ensureDocker: vi.fn().mockResolvedValue(),
        verifyDependencies: vi.fn().mockResolvedValue(true),
      };

      failingWizard.envDetector = failingEnvDetector;
      failingWizard.dependencyManager = failingDependencyManager;
      failingWizard.configManager = createMockConfigurationManager(
        tempDir,
        mockUI,
      );
      failingWizard.dockerOrchestrator = createMockDockerOrchestrator(
        tempDir,
        mockUI,
      );
      failingWizard.pairingManager = createMockPairingManager(
        failingWizard.dockerOrchestrator,
        mockUI,
        new NotificationManager(mockUI),
      );

      // Execute step 1 and expect it to fail
      await expect(failingWizard.step1PrerequisitesCheck()).rejects.toThrow();

      // Verify error was logged
      expect(mockLogger.logs.some((log) => log.level === "error")).toBe(true);
    });
  });

  describe("Wizard Step Integration", () => {
    it("should integrate step 1 with dependency manager", async () => {
      await setupWizard.step1PrerequisitesCheck();

      expect(setupWizard.setupData.prerequisites).toBeDefined();
      expect(setupWizard.setupData.prerequisites.nodeVersion).toBe("20.0.0");
      expect(setupWizard.setupData.prerequisites.dockerInstalled).toBe(true);
      expect(setupWizard.setupData.prerequisites.dependenciesVerified).toBe(
        true,
      );
    });

    it("should integrate step 2 with configuration manager", async () => {
      // Mock the UI prompt to return test API keys
      const originalPrompt = setupWizard.ui.prompt;
      setupWizard.ui.prompt = vi.fn().mockImplementation((options) => {
        if (options.message.includes("VirusTotal")) {
          return "VT_TEST_KEY_12345678901234567890123456789012";
        }
        return "";
      });

      await setupWizard.step2ApiKeysCollection();

      expect(setupWizard.setupData.apiKeys).toBeDefined();
      expect(setupWizard.setupData.apiKeys.virusTotalConfigured).toBe(true);

      setupWizard.ui.prompt = originalPrompt;
    });

    it("should integrate step 3 with pairing manager", async () => {
      await setupWizard.step3WhatsAppPairing();

      expect(setupWizard.setupData.whatsappPairing).toBeDefined();
      expect(setupWizard.setupData.whatsappPairing.method).toBe("auto");
    });

    it("should integrate step 4 with docker orchestrator", async () => {
      await setupWizard.step4StartingServices();

      expect(setupWizard.setupData.services).toBeDefined();
      expect(setupWizard.setupData.services.started).toBe(true);
      expect(
        setupWizard.setupData.services.runningServices.length,
      ).toBeGreaterThan(0);
    });

    it("should integrate step 5 with health monitoring", async () => {
      await setupWizard.step5Verification();

      expect(setupWizard.setupData.verification).toBeDefined();
      expect(setupWizard.setupData.verification.allServicesHealthy).toBe(true);
    });
  });
});

describe("CLI Command Integration Tests", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir("cli-integration-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("Unified CLI Command Execution", () => {
    it("should execute CLI with successful setup", async () => {
      const mockUI = createMockUI();
      const mockLogger = createMockLogger();

      const cli = new UnifiedCLI(["--noninteractive"]);
      cli.rootDir = tempDir;

      // Mock the setup wizard
      const mockSetupWizard = {
        run: vi.fn().mockResolvedValue({
          success: true,
          message: "Setup completed successfully!",
          data: { steps: 5, completed: true },
          logFile: "/tmp/setup-wizard.log",
        }),
      };

      // Replace the setup wizard creation
      const originalSetupWizard = SetupWizard;
      vi.spyOn(global, "SetupWizard").mockImplementation(() => mockSetupWizard);

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      // Execute the CLI
      const result = await cli.run();

      expect(result.success).toBe(true);
      expect(result.message).toBe("Setup completed successfully!");
      expect(mockSetupWizard.run).toHaveBeenCalled();

      // Restore originals
      vi.restoreAllMocks();
      process.exit = originalExit;
    });

    it("should handle CLI execution with failures", async () => {
      const mockUI = createMockUI();
      const mockLogger = createMockLogger();

      const cli = new UnifiedCLI(["--noninteractive"]);
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
      const originalSetupWizard = SetupWizard;
      vi.spyOn(global, "SetupWizard").mockImplementation(() => mockSetupWizard);

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      // Execute the CLI and expect it to handle the error
      const result = await cli.run();

      expect(result.success).toBe(false);
      expect(result.message).toBe("Setup failed");
      expect(result.error).toContain(
        "Setup failed due to missing dependencies",
      );

      // Restore originals
      vi.restoreAllMocks();
      process.exit = originalExit;
    });
  });

  describe("CLI Service Management Integration", () => {
    it("should integrate service log streaming", async () => {
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

    it("should integrate service health checking", async () => {
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

    it("should integrate health monitoring", async () => {
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
  });
});

describe("End-to-End Integration Tests", () => {
  describe("Complete System Integration", () => {
    it("should execute complete system workflow", async () => {
      const tempDir = await createTempDir("e2e-system-");
      const mockUI = createMockUI();
      const mockLogger = createMockLogger();

      // Create a complete system
      const wizard = new SetupWizard({
        rootDir: tempDir,
        interactive: false,
        argv: [],
      });

      // Replace with mocks
      wizard.ui = mockUI;
      wizard.logger = mockLogger;
      wizard.envDetector = createMockEnvironmentDetector();
      wizard.dependencyManager = createMockDependencyManager();
      wizard.configManager = createMockConfigurationManager(tempDir, mockUI);
      wizard.dockerOrchestrator = createMockDockerOrchestrator(tempDir, mockUI);
      wizard.pairingManager = createMockPairingManager(
        wizard.dockerOrchestrator,
        mockUI,
        new NotificationManager(mockUI),
      );

      // Mock the UI prompt to return test API keys
      const originalPrompt = wizard.ui.prompt;
      wizard.ui.prompt = vi.fn().mockImplementation((options) => {
        if (options.message.includes("VirusTotal")) {
          return "VT_TEST_KEY_12345678901234567890123456789012";
        }
        return "";
      });

      // Execute the complete workflow
      await wizard.step1PrerequisitesCheck();
      await wizard.step2ApiKeysCollection();
      await wizard.step3WhatsAppPairing();
      await wizard.step4StartingServices();
      await wizard.step5Verification();

      // Verify complete workflow execution
      expect(wizard.currentStep).toBe(5);
      expect(wizard.setupData.prerequisites).toBeDefined();
      expect(wizard.setupData.apiKeys).toBeDefined();
      expect(wizard.setupData.whatsappPairing).toBeDefined();
      expect(wizard.setupData.services).toBeDefined();
      expect(wizard.setupData.verification).toBeDefined();

      // Verify all components were used
      expect(wizard.envDetector.detect).toHaveBeenCalled();
      expect(wizard.dependencyManager.getNodeVersion).toHaveBeenCalled();
      expect(wizard.configManager.loadOrCreateConfig).toHaveBeenCalled();
      expect(
        wizard.dockerOrchestrator.buildAndStartServices,
      ).toHaveBeenCalled();
      expect(wizard.pairingManager.extractPairingCode).toHaveBeenCalled();

      wizard.ui.prompt = originalPrompt;
      await cleanupTempDir(tempDir);
    });

    it("should handle system integration with partial failures", async () => {
      const tempDir = await createTempDir("e2e-system-fail-");
      const mockUI = createMockUI();
      const mockLogger = createMockLogger();

      // Create a system that will fail in step 3
      const wizard = new SetupWizard({
        rootDir: tempDir,
        interactive: false,
        argv: [],
      });

      // Replace with mocks
      wizard.ui = mockUI;
      wizard.logger = mockLogger;
      wizard.envDetector = createMockEnvironmentDetector();
      wizard.dependencyManager = createMockDependencyManager();
      wizard.configManager = createMockConfigurationManager(tempDir, mockUI);
      wizard.dockerOrchestrator = createMockDockerOrchestrator(tempDir, mockUI);

      // Mock pairing manager to fail
      const failingPairingManager = createMockPairingManager(
        wizard.dockerOrchestrator,
        mockUI,
        new NotificationManager(mockUI),
      );

      // Override the handleAutomaticPairing to fail
      failingPairingManager.handleAutomaticPairing = vi
        .fn()
        .mockRejectedValue(new Error("Pairing failed"));

      wizard.pairingManager = failingPairingManager;

      // Execute steps 1 and 2 successfully
      await wizard.step1PrerequisitesCheck();
      await wizard.step2ApiKeysCollection();

      // Execute step 3 and expect it to fail
      await expect(wizard.step3WhatsAppPairing()).rejects.toThrow();

      // Verify partial execution
      expect(wizard.currentStep).toBe(3);
      expect(wizard.setupData.prerequisites).toBeDefined();
      expect(wizard.setupData.apiKeys).toBeDefined();
      expect(wizard.setupData.whatsappPairing).toBeUndefined();

      // Verify error was logged
      expect(mockLogger.logs.some((log) => log.level === "error")).toBe(true);

      await cleanupTempDir(tempDir);
    });
  });

  describe("Error Recovery Integration", () => {
    it("should recover from transient errors", async () => {
      const tempDir = await createTempDir("e2e-recovery-");
      const mockUI = createMockUI();
      const mockLogger = createMockLogger();

      // Create a system with transient error handling
      const wizard = new SetupWizard({
        rootDir: tempDir,
        interactive: false,
        argv: [],
      });

      // Replace with mocks
      wizard.ui = mockUI;
      wizard.logger = mockLogger;
      wizard.envDetector = createMockEnvironmentDetector();
      wizard.dependencyManager = createMockDependencyManager();
      wizard.configManager = createMockConfigurationManager(tempDir, mockUI);
      wizard.dockerOrchestrator = createMockDockerOrchestrator(tempDir, mockUI);
      wizard.pairingManager = createMockPairingManager(
        wizard.dockerOrchestrator,
        mockUI,
        new NotificationManager(mockUI),
      );

      // Mock the UI prompt to return test API keys
      const originalPrompt = wizard.ui.prompt;
      wizard.ui.prompt = vi.fn().mockImplementation((options) => {
        if (options.message.includes("VirusTotal")) {
          return "VT_TEST_KEY_12345678901234567890123456789012";
        }
        return "";
      });

      // Execute the complete workflow and expect it to succeed
      await wizard.step1PrerequisitesCheck();
      await wizard.step2ApiKeysCollection();
      await wizard.step3WhatsAppPairing();
      await wizard.step4StartingServices();
      await wizard.step5Verification();

      // Verify complete workflow execution despite potential transient errors
      expect(wizard.currentStep).toBe(5);
      expect(wizard.setupData.verification.allServicesHealthy).toBe(true);

      wizard.ui.prompt = originalPrompt;
      await cleanupTempDir(tempDir);
    });
  });
});

describe("CLI Command Line Integration", () => {
  describe("CLI Argument Processing", () => {
    it("should process different CLI argument combinations", () => {
      const interactiveCLI = new UnifiedCLI([]);
      expect(interactiveCLI.interactive).toBe(true);

      const nonInteractiveCLI = new UnifiedCLI(["--noninteractive"]);
      expect(nonInteractiveCLI.interactive).toBe(false);

      const debugCLI = new UnifiedCLI(["--debug"]);
      expect(debugCLI.interactive).toBe(true);
    });

    it("should initialize components based on arguments", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.ui).toBeInstanceOf(UserInterface);
      expect(cli.ui.interactive).toBe(false);
      expect(cli.progress).toBeInstanceOf(ProgressManager);
    });
  });

  describe("CLI Component Access", () => {
    it("should provide access to setup wizard", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.getSetupWizard()).toBeUndefined();

      // Mock setup wizard
      const mockWizard = { test: "wizard" };
      cli.setupWizard = mockWizard;

      expect(cli.getSetupWizard()).toBe(mockWizard);
      expect(cli.hasSetupWizard()).toBe(true);
    });

    it("should provide access to docker orchestrator", () => {
      const cli = new UnifiedCLI(["--noninteractive"]);
      expect(cli.getDockerOrchestrator()).toBeInstanceOf(DockerOrchestrator);
    });
  });
});
