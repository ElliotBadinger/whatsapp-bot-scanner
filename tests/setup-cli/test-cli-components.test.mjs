import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';

// Import the components to test
import { EnvironmentDetector } from '../../scripts/cli/core/environment.mjs';
import { DependencyManager } from '../../scripts/cli/core/dependencies.mjs';
import { ConfigurationManager } from '../../scripts/cli/core/configuration.mjs';
import { validateApiKey, validatePhoneNumber, validatePort, validateEmail, validateUrl } from '../../scripts/cli/utils/validation.mjs';
import { SetupError, DependencyError, ConfigurationError, DockerError, PairingError, handleError } from '../../scripts/cli/core/errors.mjs';

// Mock UI for testing
class MockUI {
  constructor() {
    this.messages = [];
  }

  success(message) {
    this.messages.push({ type: 'success', message });
  }

  error(message) {
    this.messages.push({ type: 'error', message });
  }

  progress(message) {
    this.messages.push({ type: 'progress', message });
  }

  getMessages() {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
  }

  prompt(options) {
    return options.default || '';
  }
}

describe('EnvironmentDetector Tests', () => {
  let detector;

  beforeEach(() => {
    detector = new EnvironmentDetector();
  });

  describe('Codespaces Detection', () => {
    it('should detect Codespaces environment when CODESPACES is set', () => {
      process.env.CODESPACES = 'true';
      process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN = '';
      expect(detector.detectCodespaces()).toBe(true);
    });

    it('should detect Codespaces environment when GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN is set', () => {
      process.env.CODESPACES = '';
      process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN = 'githubpreview.dev';
      expect(detector.detectCodespaces()).toBe(true);
    });

    it('should not detect Codespaces when neither variable is set', () => {
      process.env.CODESPACES = '';
      process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN = '';
      expect(detector.detectCodespaces()).toBe(false);
    });
  });

  describe('Container Detection', () => {
    it('should detect Docker container when /.dockerenv exists', async () => {
      // Mock fs.access to simulate Docker environment
      const mockAccess = vi.spyOn(fs, 'access').mockResolvedValue(undefined);

      const result = await detector.detectContainer();
      expect(result).toBe(true);

      mockAccess.mockRestore();
    });

    it('should detect Docker container via cgroup check', async () => {
      // Mock fs.access to fail (no /.dockerenv)
      const mockAccess = vi.spyOn(fs, 'access').mockRejectedValue(new Error('File not found'));

      // Mock execa to simulate Docker cgroup
      const mockExeca = vi.fn().mockResolvedValue({ stdout: 'docker' });
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectContainer();
      expect(result).toBe(true);

      mockAccess.mockRestore();
      vi.restoreAllMocks();
    });

    it('should not detect container when neither indicator is present', async () => {
      // Mock fs.access to fail
      const mockAccess = vi.spyOn(fs, 'access').mockRejectedValue(new Error('File not found'));

      // Mock execa to fail
      const mockExeca = vi.fn().mockRejectedValue(new Error('Command failed'));
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectContainer();
      expect(result).toBe(false);

      mockAccess.mockRestore();
      vi.restoreAllMocks();
    });
  });

  describe('Package Manager Detection', () => {
    it('should detect yarn when available', async () => {
      const mockExeca = vi.fn();
      mockExeca.mockImplementation((cmd) => {
        if (cmd === 'yarn') return Promise.resolve({ stdout: '1.22.19' });
        return Promise.reject(new Error('Command not found'));
      });
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectPackageManager();
      expect(result).toBe('yarn');

      vi.restoreAllMocks();
    });

    it('should detect pnpm when yarn is not available', async () => {
      const mockExeca = vi.fn();
      mockExeca.mockImplementation((cmd) => {
        if (cmd === 'pnpm') return Promise.resolve({ stdout: '8.6.0' });
        return Promise.reject(new Error('Command not found'));
      });
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectPackageManager();
      expect(result).toBe('pnpm');

      vi.restoreAllMocks();
    });

    it('should detect npm when neither yarn nor pnpm are available', async () => {
      const mockExeca = vi.fn();
      mockExeca.mockImplementation((cmd) => {
        if (cmd === 'npm') return Promise.resolve({ stdout: '9.5.1' });
        return Promise.reject(new Error('Command not found'));
      });
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectPackageManager();
      expect(result).toBe('npm');

      vi.restoreAllMocks();
    });

    it('should return unknown when no package manager is found', async () => {
      const mockExeca = vi.fn().mockRejectedValue(new Error('Command not found'));
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectPackageManager();
      expect(result).toBe('unknown');

      vi.restoreAllMocks();
    });
  });

  describe('Init System Detection', () => {
    it('should detect systemd on Linux', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const mockExeca = vi.fn().mockResolvedValue({ stdout: 'systemd 249' });
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectInitSystem();
      expect(result).toBe('systemd');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
      vi.restoreAllMocks();
    });

    it('should detect sysvinit when systemd is not available', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const mockExeca = vi.fn();
      mockExeca.mockImplementation((cmd) => {
        if (cmd === 'service') return Promise.resolve({ stdout: 'service management' });
        return Promise.reject(new Error('Command not found'));
      });
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectInitSystem();
      expect(result).toBe('sysvinit');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
      vi.restoreAllMocks();
    });

    it('should detect windows on Windows platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const result = await detector.detectInitSystem();
      expect(result).toBe('windows');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return unknown when no init system is detected', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const mockExeca = vi.fn().mockRejectedValue(new Error('Command not found'));
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await detector.detectInitSystem();
      expect(result).toBe('unknown');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
      vi.restoreAllMocks();
    });
  });

  describe('Platform Information', () => {
    it('should return correct platform information', () => {
      const platformInfo = detector.getPlatformInfo();

      expect(platformInfo).toHaveProperty('platform');
      expect(platformInfo).toHaveProperty('arch');
      expect(platformInfo).toHaveProperty('release');
      expect(platformInfo).toHaveProperty('cpus');

      expect(platformInfo.platform).toBe(os.platform());
      expect(platformInfo.arch).toBe(os.arch());
      expect(platformInfo.cpus).toBeGreaterThan(0);
    });
  });

  describe('Full Environment Detection', () => {
    it('should return complete environment information', async () => {
      // Mock all the detection methods
      const mockDetectContainer = vi.spyOn(detector, 'detectContainer').mockResolvedValue(true);
      const mockDetectPackageManager = vi.spyOn(detector, 'detectPackageManager').mockResolvedValue('npm');
      const mockDetectInitSystem = vi.spyOn(detector, 'detectInitSystem').mockResolvedValue('systemd');

      const envInfo = await detector.detect();

      expect(envInfo).toHaveProperty('isCodespaces');
      expect(envInfo).toHaveProperty('isContainer', true);
      expect(envInfo).toHaveProperty('packageManager', 'npm');
      expect(envInfo).toHaveProperty('initSystem', 'systemd');
      expect(envInfo).toHaveProperty('platform');

      mockDetectContainer.mockRestore();
      mockDetectPackageManager.mockRestore();
      mockDetectInitSystem.mockRestore();
    });
  });
});

describe('DependencyManager Tests', () => {
  let dependencyManager;
  let mockUI;
  let mockEnvDetector;

  beforeEach(() => {
    mockUI = new MockUI();
    mockEnvDetector = {
      detectContainer: vi.fn().mockResolvedValue(false)
    };
    dependencyManager = new DependencyManager(mockEnvDetector, mockUI);
  });

  describe('Node.js Version Detection', () => {
    it('should return current Node.js version', () => {
      const version = dependencyManager.getNodeVersion();
      // Just check that we get some version string
      expect(typeof version).toBe('string');
      expect(version).not.toBeNull();
    });

    it('should return null when Node.js is not available', () => {
      const originalExeca = execa.sync;
      execa.sync = vi.fn().mockImplementation(() => {
        throw new Error('Command failed');
      });

      const version = dependencyManager.getNodeVersion();
      expect(version).toBeNull();

      execa.sync = originalExeca;
    });
  });

  describe('Node.js Version Validation', () => {
    it('should validate sufficient Node.js version', () => {
      expect(dependencyManager.isVersionSufficient('20.0.0')).toBe(true);
      expect(dependencyManager.isVersionSufficient('20.1.0')).toBe(true);
      expect(dependencyManager.isVersionSufficient('21.0.0')).toBe(true);
    });

    it('should invalidate insufficient Node.js version', () => {
      expect(dependencyManager.isVersionSufficient('18.0.0')).toBe(false);
      expect(dependencyManager.isVersionSufficient('19.9.0')).toBe(false);
      expect(dependencyManager.isVersionSufficient('19.0.0')).toBe(false);
    });
  });

  describe('Docker Detection', () => {
    it('should detect Docker when available', async () => {
      const mockExeca = vi.fn().mockResolvedValue({ stdout: 'Docker version 20.10.7' });
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      await expect(dependencyManager.ensureDocker()).resolves.not.toThrow();

      vi.restoreAllMocks();
    });

    it('should throw error when Docker is not available', async () => {
      const mockExeca = vi.fn().mockRejectedValue(new Error('Docker not found'));
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      await expect(dependencyManager.ensureDocker()).rejects.toThrow('Docker or Docker Compose not found');

      vi.restoreAllMocks();
    });
  });

  describe('Dependency Verification', () => {
    it('should pass when all dependencies are available', async () => {
      const mockExeca = vi.fn().mockResolvedValue({ stdout: 'version info' });
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      const result = await dependencyManager.verifyDependencies();
      expect(result).toBe(true);

      vi.restoreAllMocks();
    });

    it('should throw error when dependencies are missing', async () => {
      const mockExeca = vi.fn().mockRejectedValue(new Error('Command not found'));
      vi.spyOn(execa, 'execa').mockImplementation(mockExeca);

      await expect(dependencyManager.verifyDependencies()).rejects.toThrow('Missing dependencies');

      vi.restoreAllMocks();
    });
  });
});

describe('ConfigurationManager Tests', () => {
  let configManager;
  let mockUI;
  let tempDir;

  beforeEach(async () => {
    mockUI = new MockUI();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));

    // Create a template .env.hobby file for testing
    const templateContent = `
# Template configuration
VT_API_KEY=
GSB_API_KEY=
    `.trim();

    await fs.writeFile(path.join(tempDir, '.env.hobby'), templateContent);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Configuration Parsing', () => {
    it('should parse .env file correctly', () => {
      const configContent = `
# Test config
VT_API_KEY=test_key_1234567890
GSB_API_KEY=another_key
      `.trim();

      const configManager = new ConfigurationManager(tempDir, mockUI);
      const parsed = configManager.parseConfig(configContent);

      expect(parsed.VT_API_KEY).toBe('test_key_1234567890');
      expect(parsed.GSB_API_KEY).toBe('another_key');
    });

    it('should ignore comments and empty lines', () => {
      const configContent = `
# This is a comment
VT_API_KEY=test_key

# Another comment
      `.trim();

      const configManager = new ConfigurationManager(tempDir, mockUI);
      const parsed = configManager.parseConfig(configContent);

      expect(parsed.VT_API_KEY).toBe('test_key');
      expect(parsed).not.toHaveProperty('#');
    });
  });

  describe('Configuration File Management', () => {
    it('should create config from template when .env does not exist', async () => {
      const configManager = new ConfigurationManager(tempDir, mockUI);

      // Mock the prompt method to return test API keys
      const originalPrompt = mockUI.prompt;
      mockUI.prompt = vi.fn().mockImplementation((options) => {
        if (options.message.includes('VirusTotal')) return 'VT_TEST_KEY_12345678901234567890123456789012';
        if (options.message.includes('Google Safe Browsing')) return 'GSB_TEST_KEY';
        return '';
      });

      const config = await configManager.loadOrCreateConfig();

      expect(config).toHaveProperty('VT_API_KEY');
      expect(config).toHaveProperty('GSB_API_KEY');

      // Verify .env file was created
      const envPath = path.join(tempDir, '.env');
      const envExists = await fs.access(envPath).then(() => true).catch(() => false);
      expect(envExists).toBe(true);

      mockUI.prompt = originalPrompt;
    });

    it('should load existing config when .env exists', async () => {
      // Create a test .env file
      const envContent = `VT_API_KEY=existing_key
GSB_API_KEY=existing_gsb_key`;

      await fs.writeFile(path.join(tempDir, '.env'), envContent);

      const configManager = new ConfigurationManager(tempDir, mockUI);
      const config = await configManager.loadOrCreateConfig();

      expect(config.VT_API_KEY).toBe('existing_key');
      expect(config.GSB_API_KEY).toBe('existing_gsb_key');
    });
  });

  describe('Configuration Updates', () => {
    it('should update existing config values', async () => {
      // Create initial .env file
      const initialContent = `
VT_API_KEY=old_key
GSB_API_KEY=old_gsb_key
      `.trim();

      await fs.writeFile(path.join(tempDir, '.env'), initialContent);

      const configManager = new ConfigurationManager(tempDir, mockUI);
      await configManager.updateConfig({
        VT_API_KEY: 'new_key_12345678901234567890123456789012',
        GSB_API_KEY: 'new_gsb_key'
      });

      // Read the updated file
      const updatedContent = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
      expect(updatedContent).toContain('new_key_12345678901234567890123456789012');
      expect(updatedContent).toContain('new_gsb_key');
    });

    it('should add new config values when they do not exist', async () => {
      // Create initial .env file without GSB_API_KEY
      const initialContent = `
VT_API_KEY=existing_key
      `.trim();

      await fs.writeFile(path.join(tempDir, '.env'), initialContent);

      const configManager = new ConfigurationManager(tempDir, mockUI);
      await configManager.updateConfig({
        GSB_API_KEY: 'new_gsb_key_added'
      });

      // Read the updated file
      const updatedContent = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
      expect(updatedContent).toContain('existing_key');
      expect(updatedContent).toContain('new_gsb_key_added');
    });
  });
});

describe('Validation Utilities Tests', () => {
  describe('API Key Validation', () => {
    it('should validate correct API keys', () => {
      const validKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
      expect(validateApiKey(validKey)).toBe(true);
    });

    it('should reject empty API keys', () => {
      expect(validateApiKey('')).toBe('API key is required');
    });

    it('should reject short API keys', () => {
      const shortKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123';
      expect(validateApiKey(shortKey)).toBe('API key must be at least 32 characters');
    });

    it('should reject API keys with invalid characters', () => {
      const invalidKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456!@#$%';
      expect(validateApiKey(invalidKey)).toBe('API key contains invalid characters');
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate correct phone numbers', () => {
      expect(validatePhoneNumber('+1234567890')).toBe(true);
      expect(validatePhoneNumber('1234567890')).toBe(true);
      expect(validatePhoneNumber('123-456-7890')).toBe(true);
    });

    it('should reject short phone numbers', () => {
      expect(validatePhoneNumber('123456789')).toBe('Phone number must have at least 10 digits');
    });

    it('should reject invalid phone number formats', () => {
      // The phone number 'abc1234567' has only 9 digits after removing non-digits
      expect(validatePhoneNumber('abc1234567')).toBe('Phone number must have at least 10 digits');
    });
  });

  describe('Port Validation', () => {
    it('should validate correct ports', () => {
      expect(validatePort('80')).toBe(true);
      expect(validatePort('8080')).toBe(true);
      expect(validatePort('65535')).toBe(true);
    });

    it('should reject non-numeric ports', () => {
      expect(validatePort('abc')).toBe('Port must be a number');
    });

    it('should reject out-of-range ports', () => {
      expect(validatePort('0')).toBe('Port must be between 1 and 65535');
      expect(validatePort('65536')).toBe('Port must be between 1 and 65535');
      expect(validatePort('70000')).toBe('Port must be between 1 and 65535');
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@sub.domain.co.uk')).toBe(true);
    });

    it('should reject empty emails', () => {
      expect(validateEmail('')).toBe('Email is required');
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('not-an-email')).toBe('Invalid email format');
      expect(validateEmail('user@')).toBe('Invalid email format');
      expect(validateEmail('@domain.com')).toBe('Invalid email format');
    });
  });

  describe('URL Validation', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://sub.domain.co.uk/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe('Invalid URL format');
      expect(validateUrl('http://')).toBe('Invalid URL format');
    });
  });
});

describe('Error Handling Tests', () => {
  let mockUI;

  beforeEach(() => {
    mockUI = new MockUI();
  });

  describe('Custom Error Classes', () => {
    it('should create SetupError with correct properties', () => {
      const error = new SetupError('Test error message', new Error('cause'));
      expect(error.name).toBe('SetupError');
      expect(error.message).toBe('Test error message');
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('should create DependencyError with correct properties', () => {
      const error = new DependencyError('node', 'Node.js not found', new Error('cause'));
      expect(error.name).toBe('DependencyError');
      expect(error.message).toBe('Dependency error (node): Node.js not found');
      expect(error.dependency).toBe('node');
    });

    it('should create ConfigurationError with correct properties', () => {
      const error = new ConfigurationError('Invalid configuration', new Error('cause'));
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Configuration error: Invalid configuration');
    });

    it('should create DockerError with correct properties', () => {
      const error = new DockerError('Docker daemon not running', new Error('cause'));
      expect(error.name).toBe('DockerError');
      expect(error.message).toBe('Docker error: Docker daemon not running');
    });

    it('should create PairingError with correct properties', () => {
      const error = new PairingError('QR code expired', new Error('cause'));
      expect(error.name).toBe('PairingError');
      expect(error.message).toBe('Pairing error: QR code expired');
    });
  });

  describe('Error Handling Function', () => {
    it('should handle DependencyError correctly', () => {
      const error = new DependencyError('docker', 'Docker not installed');
      const context = { ui: mockUI };

      handleError(error, context);

      const messages = mockUI.getMessages();
      expect(messages.some(m => m.type === 'error' && m.message.includes('Dependency issue'))).toBe(true);
    });

    it('should handle ConfigurationError correctly', () => {
      const error = new ConfigurationError('Invalid API key format');
      const context = { ui: mockUI };

      handleError(error, context);

      const messages = mockUI.getMessages();
      expect(messages.some(m => m.type === 'error' && m.message.includes('Configuration problem'))).toBe(true);
    });

    it('should handle DockerError correctly', () => {
      const error = new DockerError('Docker daemon not responding');
      const context = { ui: mockUI };

      handleError(error, context);

      const messages = mockUI.getMessages();
      expect(messages.some(m => m.type === 'error' && m.message.includes('Docker problem'))).toBe(true);
    });

    it('should handle PairingError correctly', () => {
      const error = new PairingError('Authentication failed');
      const context = { ui: mockUI };

      handleError(error, context);

      const messages = mockUI.getMessages();
      expect(messages.some(m => m.type === 'error' && m.message.includes('Pairing problem'))).toBe(true);
    });

    it('should handle unknown errors gracefully', () => {
      const error = new Error('Unexpected error occurred');
      const context = { ui: mockUI };

      handleError(error, context);

      const messages = mockUI.getMessages();
      expect(messages.some(m => m.type === 'error' && m.message.includes('Unexpected error'))).toBe(true);
    });
  });
});

// Integration test for complete environment detection flow
describe('Integration Test: Complete Environment Detection Flow', () => {
  it('should perform complete environment detection and validation', async () => {
    const detector = new EnvironmentDetector();
    const mockUI = new MockUI();
    const mockEnvDetector = {
      detectContainer: vi.fn().mockResolvedValue(false)
    };
    const dependencyManager = new DependencyManager(mockEnvDetector, mockUI);

    // Test environment detection
    const envInfo = await detector.detect();
    expect(envInfo).toHaveProperty('isCodespaces');
    expect(envInfo).toHaveProperty('isContainer');
    expect(envInfo).toHaveProperty('packageManager');
    expect(envInfo).toHaveProperty('initSystem');
    expect(envInfo).toHaveProperty('platform');

    // Test Node.js version detection
    const nodeVersion = dependencyManager.getNodeVersion();
    if (nodeVersion) {
      const isSufficient = dependencyManager.isVersionSufficient(nodeVersion);
      expect(typeof isSufficient).toBe('boolean');
    }

    // Test validation utilities
    expect(validateApiKey('ABCDEFGHIJKLMNOPQRSTUVWXYZ123456')).toBe(true);
    expect(validatePhoneNumber('+1234567890')).toBe(true);
    expect(validatePort('8080')).toBe(true);
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateUrl('https://example.com')).toBe(true);
  });
});