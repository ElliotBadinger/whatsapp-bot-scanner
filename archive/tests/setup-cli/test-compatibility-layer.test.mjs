#!/usr/bin/env node

/**
 * Test suite for the backward compatibility layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompatibilityManager } from '../../scripts/cli/core/compatibility.mjs';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');

describe('Backward Compatibility Layer', () => {
  let compatibilityManager;

  beforeEach(() => {
    compatibilityManager = new CompatibilityManager();
  });

  describe('Script Detection', () => {
    it('should detect old scripts correctly', () => {
      expect(compatibilityManager.isOldScript('setup-wizard.mjs')).toBe(true);
      expect(compatibilityManager.isOldScript('pair.sh')).toBe(true);
      expect(compatibilityManager.isOldScript('validate-setup.sh')).toBe(true);
      expect(compatibilityManager.isOldScript('nonexistent-script.js')).toBe(false);
    });

    it('should get correct new command mappings', () => {
      expect(compatibilityManager.getNewCommand('setup-wizard.mjs')).toBe('setup');
      expect(compatibilityManager.getNewCommand('pair.sh')).toBe('pair');
      expect(compatibilityManager.getNewCommand('validate-setup.sh')).toBe('status');
      expect(compatibilityManager.getNewCommand('nonexistent-script.js')).toBe(null);
    });
  });

  describe('Deprecation Warnings', () => {
    it('should show deprecation warnings for known scripts', () => {
      // Mock the UI methods
      const originalWarn = compatibilityManager.ui.warn;
      const originalInfo = compatibilityManager.ui.info;
      const warnings = [];
      const infos = [];

      compatibilityManager.ui.warn = (msg) => warnings.push(msg);
      compatibilityManager.ui.info = (msg) => infos.push(msg);

      compatibilityManager.showDeprecationWarning('setup-wizard.mjs');

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('deprecated'))).toBe(true);
      expect(infos.some(i => i.includes('Migration'))).toBe(true);

      // Restore original methods
      compatibilityManager.ui.warn = originalWarn;
      compatibilityManager.ui.info = originalInfo;
    });

    it('should handle unknown scripts gracefully', () => {
      const originalWarn = compatibilityManager.ui.warn;
      const originalInfo = compatibilityManager.ui.info;
      const warnings = [];
      const infos = [];

      compatibilityManager.ui.warn = (msg) => warnings.push(msg);
      compatibilityManager.ui.info = (msg) => infos.push(msg);

      compatibilityManager.showDeprecationWarning('unknown-script.js');

      expect(warnings.some(w => w.includes('deprecated'))).toBe(true);
      expect(infos.some(i => i.includes('unified-cli --help'))).toBe(true);

      // Restore original methods
      compatibilityManager.ui.warn = originalWarn;
      compatibilityManager.ui.info = originalInfo;
    });
  });

  describe('Migration Guidance', () => {
    it('should provide comprehensive migration guidance', () => {
      const guidance = compatibilityManager.getMigrationGuidance('setup-wizard.mjs');

      expect(guidance).toHaveProperty('oldScript', 'setup-wizard.mjs');
      expect(guidance).toHaveProperty('newCommand', 'setup');
      expect(guidance).toHaveProperty('migrationPath');
      expect(guidance).toHaveProperty('timeline');
      expect(guidance).toHaveProperty('severity');
      expect(guidance).toHaveProperty('alternatives');
      expect(guidance).toHaveProperty('documentation');
      expect(guidance).toHaveProperty('additionalNotes');
      expect(guidance).toHaveProperty('migrationSteps');
      expect(guidance.migrationSteps.length).toBeGreaterThan(0);
    });

    it('should handle unknown scripts with default guidance', () => {
      const guidance = compatibilityManager.getMigrationGuidance('unknown-script.js');

      expect(guidance).toHaveProperty('oldScript', 'unknown-script.js');
      expect(guidance).toHaveProperty('newCommand', 'No direct equivalent');
      expect(guidance).toHaveProperty('migrationPath');
      expect(guidance).toHaveProperty('timeline', 'Future version');
    });
  });

  describe('Script Execution', () => {
    it('should execute original scripts when no mapping exists', () => {
      // This is a basic test - in a real scenario, you'd mock execSync
      const scriptName = 'test-script.sh';
      const scriptPath = path.join(ROOT_DIR, 'scripts', scriptName);

      // Create a test script
      const testScriptContent = `#!/bin/bash\necho "Test script executed"`;
      require('fs').writeFileSync(scriptPath, testScriptContent);
      require('fs').chmodSync(scriptPath, '755');

      try {
        // Test that the method doesn't throw for unknown scripts
        expect(() => compatibilityManager.executeOriginalScript(scriptName, [])).not.toThrow();
      } finally {
        // Clean up
        if (existsSync(scriptPath)) {
          require('fs').unlinkSync(scriptPath);
        }
      }
    });
  });

  describe('Integration with CLI', () => {
    it('should provide all deprecated scripts information', () => {
      const allScripts = compatibilityManager.getAllDeprecatedScripts();

      expect(Object.keys(allScripts).length).toBeGreaterThan(0);
      Object.values(allScripts).forEach(guidance => {
        expect(guidance).toHaveProperty('oldScript');
        expect(guidance).toHaveProperty('newCommand');
      });
    });
  });

  describe('Warning Suppression', () => {
    it('should suppress warnings when requested', () => {
      compatibilityManager.suppressWarnings('setup-wizard.mjs');

      const originalWarn = compatibilityManager.ui.warn;
      let warnCalled = false;

      compatibilityManager.ui.warn = () => { warnCalled = true; };

      compatibilityManager.showDeprecationWarning('setup-wizard.mjs');

      expect(warnCalled).toBe(false);

      // Restore original method
      compatibilityManager.ui.warn = originalWarn;
    });
  });
});

describe('Compatibility Layer Integration', () => {
  it('should integrate with main CLI entry point', async () => {
    // Test that the compatibility layer can be imported and used
    const { runCompatibilityMode } = await import('../../scripts/cli/core/compatibility.mjs');

    // This should not throw and should return false (no compatibility mode)
    const result = await runCompatibilityMode();
    expect(result).toBe(false);
  });

  it('should create compatibility wrappers', () => {
    const { createCompatibilityWrapper } = require('../../scripts/cli/core/compatibility.mjs');
    const wrapper = createCompatibilityWrapper('test-script.mjs');

    expect(typeof wrapper).toBe('function');
  });
});

describe('Fallback Mechanisms', () => {
  it('should handle script execution failures gracefully', () => {
    // Mock execSync to throw an error
    const originalExecSync = execSync;
    execSync.mockImplementationOnce(() => {
      throw new Error('Test execution error');
    });

    const scriptName = 'nonexistent-script.sh';

    // This should not crash, just return false
    const result = compatibilityManager.executeOriginalScript(scriptName, []);
    expect(result).toBe(false);

    // Restore original execSync
    execSync.mockRestore();
  });
});