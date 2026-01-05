#!/usr/bin/env node

/**
 * Backward Compatibility Layer for Unified CLI
 *
 * This module provides a compatibility layer to ensure existing scripts
 * continue to work during the transition to the unified CLI system.
 */

import { program } from 'commander';
import { UserInterface } from '../ui/prompts.mjs';
import { NotificationManager } from '../ui/notifications.mjs';
import { FileManager } from '../utils/file.mjs';
import { handleError } from './errors.mjs';
import { execSync, execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

/**
 * Script mapping for backward compatibility
 * Maps old script names to new CLI commands
 */
const SCRIPT_MAPPING = {
  'setup-wizard.mjs': 'setup',
  'pair.sh': 'pair',
  'validate-setup.sh': 'status',
  'validate-compilation.sh': 'status',
  'validate-config.js': 'status',
  'run-migrations.js': 'logs --service db-migrator',
  'run-seeds.js': 'logs --service db-seeder',
  'init-sqlite.js': 'setup --skip-dependencies',
  'test-wa-auth.sh': 'pair'
};

/**
 * Deprecation warnings and migration guidance
 */
const DEPRECATION_MESSAGES = {
  'setup-wizard.mjs': {
    message: 'The standalone setup-wizard.mjs script is deprecated.',
    migration: 'Use: unified-cli setup',
    timeline: 'This script will be removed in v2.0.0 (scheduled for Q2 2026)',
    severity: 'high',
    alternatives: ['unified-cli setup', 'unified-cli setup --noninteractive'],
    documentation: 'https://github.com/yourorg/whatsapp-bot-scanner/wiki/Migration-Guide#setup-wizard'
  },
  'pair.sh': {
    message: 'The pair.sh script is deprecated.',
    migration: 'Use: unified-cli pair',
    timeline: 'This script will be removed in v2.0.0 (scheduled for Q2 2026)',
    severity: 'medium',
    alternatives: ['unified-cli pair'],
    documentation: 'https://github.com/yourorg/whatsapp-bot-scanner/wiki/Migration-Guide#pairing'
  },
  'validate-setup.sh': {
    message: 'The validate-setup.sh script is deprecated.',
    migration: 'Use: unified-cli status',
    timeline: 'This script will be removed in v2.0.0 (scheduled for Q2 2026)',
    severity: 'low',
    alternatives: ['unified-cli status', 'unified-cli status --monitor'],
    documentation: 'https://github.com/yourorg/whatsapp-bot-scanner/wiki/Migration-Guide#validation'
  },
  'validate-compilation.sh': {
    message: 'The validate-compilation.sh script is deprecated.',
    migration: 'Use: unified-cli status',
    timeline: 'This script will be removed in v2.0.0 (scheduled for Q2 2026)',
    severity: 'low',
    alternatives: ['unified-cli status'],
    documentation: 'https://github.com/yourorg/whatsapp-bot-scanner/wiki/Migration-Guide#validation'
  },
  'run-migrations.js': {
    message: 'The run-migrations.js script is deprecated.',
    migration: 'Use: unified-cli logs --service db-migrator',
    timeline: 'This script will be removed in v2.0.0 (scheduled for Q2 2026)',
    severity: 'medium',
    alternatives: ['unified-cli logs --service db-migrator'],
    documentation: 'https://github.com/yourorg/whatsapp-bot-scanner/wiki/Migration-Guide#database-operations'
  }
};

/**
 * Compatibility Manager
 * Handles script detection, routing, and deprecation warnings
 */
export class CompatibilityManager {
  constructor() {
    this.ui = new UserInterface(true);
    this.notificationManager = new NotificationManager();
    this.fileManager = new FileManager();
    this.suppressedWarnings = new Set();
  }

  /**
   * Detect if an old script is being called
   * @param {string} scriptName - The script name being executed
   * @returns {boolean} True if it's an old script
   */
  isOldScript(scriptName) {
    return SCRIPT_MAPPING.hasOwnProperty(scriptName);
  }

  /**
   * Get the new CLI command equivalent for an old script
   * @param {string} scriptName - The old script name
   * @returns {string|null} The new CLI command or null if not found
   */
  getNewCommand(scriptName) {
    return SCRIPT_MAPPING[scriptName] || null;
  }

  /**
   * Show deprecation warning
   * @param {string} scriptName - The deprecated script name
   * @param {boolean} showMigration - Whether to show migration guidance
   * @param {boolean} showAlternatives - Whether to show alternative commands
   */
  showDeprecationWarning(scriptName, showMigration = true, showAlternatives = true) {
    if (this.suppressedWarnings.has(scriptName)) {
      return;
    }

    const deprecationInfo = DEPRECATION_MESSAGES[scriptName];

    if (deprecationInfo) {
      // Show severity-based warning
      const severityEmoji = deprecationInfo.severity === 'high' ? '🔴' :
                           deprecationInfo.severity === 'medium' ? '🟡' : '🔵';

      this.ui.warn(`${severityEmoji}  ${deprecationInfo.message}`);
      this.ui.warn(`📅  ${deprecationInfo.timeline}`);

      if (showMigration) {
        this.ui.info(`🔧  Migration: ${deprecationInfo.migration}`);
      }

      if (showAlternatives && deprecationInfo.alternatives) {
        this.ui.info('🔄  Alternatives:');
        deprecationInfo.alternatives.forEach(alt => this.ui.info(`   • ${alt}`));
      }

      if (deprecationInfo.documentation) {
        this.ui.info(`📖  Documentation: ${deprecationInfo.documentation}`);
      }
    } else {
      this.ui.warn(`⚠️  This script is deprecated and will be removed in future versions.`);
      this.ui.info('📖  For more information, run: unified-cli --help');
    }
  }

  /**
   * Suppress deprecation warnings for a script
   * @param {string} scriptName - The script name to suppress warnings for
   */
  suppressWarnings(scriptName) {
    this.suppressedWarnings.add(scriptName);
  }

  /**
   * Execute old script with compatibility layer
   * @param {string} scriptName - The script name being executed
   * @param {string[]} args - Arguments passed to the script
   */
  async executeOldScript(scriptName, args = []) {
    try {
      // Show deprecation warning
      this.showDeprecationWarning(scriptName);

      // Check if the script exists
      const scriptPath = path.join(ROOT_DIR, 'scripts', scriptName);

      if (!existsSync(scriptPath)) {
        throw new Error(`Script ${scriptName} not found at ${scriptPath}`);
      }

      // Route to new CLI command if available
      const newCommand = this.getNewCommand(scriptName);

      if (newCommand) {
        this.ui.info(`🔄  Routing to new CLI command: ${newCommand}`);

        // Execute the new command
        const unifiedCliPath = path.join(ROOT_DIR, 'scripts', 'unified-cli.mjs');
        const command = `node ${unifiedCliPath} ${newCommand}`;

        try {
          execSync(command, { stdio: 'inherit' });
          return true;
        } catch (execError) {
          this.ui.error(`❌  Failed to execute new command: ${execError.message}`);
          this.ui.info('🔙  Falling back to original script...');

          // Fallback to original script execution
          return this.executeOriginalScript(scriptName, args);
        }
      } else {
        // No mapping available, execute original script
        return this.executeOriginalScript(scriptName, args);
      }
    } catch (error) {
      handleError(error, this);
      return false;
    }
  }

  /**
   * Execute the original script with proper error handling
   * @param {string} scriptName - The script name
   * @param {string[]} args - Arguments for the script
   * @returns {boolean} Success status
   */
  executeOriginalScript(scriptName, args = []) {
    try {
      const scriptPath = path.join(ROOT_DIR, 'scripts', scriptName);

      // Handle different script types
      if (scriptName.endsWith('.sh')) {
        // Bash script - use execFile with proper argument array to prevent injection
        const sanitizedArgs = args.filter(arg => 
          typeof arg === 'string' && 
          !arg.includes(';') && 
          !arg.includes('&&') && 
          !arg.includes('||') && 
          !arg.includes('|') &&
          !arg.includes('>') &&
          !arg.includes('<') &&
          !arg.includes('`') &&
          !arg.includes('$')
        );
        execFileSync('bash', [scriptPath, ...sanitizedArgs], { stdio: 'inherit' });
      } else if (scriptName.endsWith('.mjs') || scriptName.endsWith('.js')) {
        // Node script - use execFile with proper argument array to prevent injection
        const sanitizedArgs = args.filter(arg => 
          typeof arg === 'string' && 
          !arg.includes('--eval') &&
          !arg.includes('-e') &&
          !arg.includes('--require') &&
          !arg.includes('-r')
        );
        execFileSync('node', [scriptPath, ...sanitizedArgs], { stdio: 'inherit' });
      } else {
        throw new Error(`Unsupported script type: ${scriptName}`);
      }

      return true;
    } catch (error) {
      this.ui.error(`❌  Script execution failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get migration guidance for a specific script
   * @param {string} scriptName - The script name
   * @returns {Object} Migration guidance object
   */
  getMigrationGuidance(scriptName) {
    const deprecationInfo = DEPRECATION_MESSAGES[scriptName];

    if (deprecationInfo) {
      return {
        oldScript: scriptName,
        newCommand: this.getNewCommand(scriptName),
        migrationPath: deprecationInfo.migration,
        timeline: deprecationInfo.timeline,
        severity: deprecationInfo.severity,
        alternatives: deprecationInfo.alternatives,
        documentation: deprecationInfo.documentation,
        additionalNotes: this.getAdditionalMigrationNotes(scriptName),
        migrationSteps: this.getMigrationSteps(scriptName)
      };
    }

    return {
      oldScript: scriptName,
      newCommand: this.getNewCommand(scriptName) || 'No direct equivalent',
      migrationPath: 'Check unified-cli --help for available commands',
      timeline: 'Future version',
      severity: 'unknown',
      alternatives: [],
      documentation: null,
      additionalNotes: [],
      migrationSteps: []
    };
  }

  /**
   * Get additional migration notes for specific scripts
   * @param {string} scriptName - The script name
   * @returns {string[]} Array of additional notes
   */
  getAdditionalMigrationNotes(scriptName) {
    const notes = [];

    switch (scriptName) {
      case 'setup-wizard.mjs':
        notes.push('The new setup command includes all the functionality of the old wizard');
        notes.push('Additional features: Docker health checks, dependency validation');
        break;

      case 'pair.sh':
        notes.push('The new pair command provides better error handling');
        notes.push('Includes QR code display and pairing status monitoring');
        break;

      case 'validate-setup.sh':
        notes.push('The status command provides comprehensive health checks');
        notes.push('Includes service monitoring and detailed error reporting');
        break;
    }

    return notes;
  }
  /**
   * Get step-by-step migration steps for specific scripts
   * @param {string} scriptName - The script name
   * @returns {string[]} Array of migration steps
   */
  getMigrationSteps(scriptName) {
    const steps = [];

    switch (scriptName) {
      case 'setup-wizard.mjs':
        steps.push('1. Replace `node scripts/setup-wizard.mjs` with `unified-cli setup`');
        steps.push('2. Add `--noninteractive` flag for CI/CD environments');
        steps.push('3. Use `--hobby-mode` for personal/hobby setups');
        steps.push('4. Review new Docker health check features');
        break;

      case 'pair.sh':
        steps.push('1. Replace `bash scripts/pair.sh` with `unified-cli pair`');
        steps.push('2. No additional flags needed - same functionality');
        steps.push('3. New command includes automatic QR code display');
        break;

      case 'validate-setup.sh':
        steps.push('1. Replace `bash scripts/validate-setup.sh` with `unified-cli status`');
        steps.push('2. Use `--monitor` flag for continuous monitoring');
        steps.push('3. Review new comprehensive health check output');
        break;

      case 'run-migrations.js':
        steps.push('1. Replace `node scripts/run-migrations.js` with `unified-cli logs --service db-migrator`');
        steps.push('2. Use `--tail 100` to see last 100 lines');
        steps.push('3. Add `--timestamps` for better log analysis');
        break;
    }

    return steps;
  }

  /**
   * Check version compatibility
   * @param {string} scriptName - The script name
   * @returns {boolean} True if the script is compatible
   */
  checkVersionCompatibility(scriptName) {
    // All scripts are currently compatible
    return true;
  }

  /**
   * Get all deprecated scripts information
   * @returns {Object} Information about all deprecated scripts
   */
  getAllDeprecatedScripts() {
    return Object.keys(SCRIPT_MAPPING).reduce((result, scriptName) => {
      result[scriptName] = this.getMigrationGuidance(scriptName);
      return result;
    }, {});
  }
}

/**
 * Main compatibility entry point
 * This function can be called from other scripts to enable compatibility mode
 */
export async function runCompatibilityMode() {
  const compatibilityManager = new CompatibilityManager();

  // Detect if we're being called from an old script
  const callingScript = process.env.COMPATIBILITY_CALLING_SCRIPT;

  if (callingScript) {
    // Extract arguments (skip first 2: node, script)
    const args = process.argv.slice(2);
    return compatibilityManager.executeOldScript(callingScript, args);
  }

  return false;
}

/**
 * Compatibility wrapper for direct script execution
 * This can be used to wrap old scripts to make them compatible
 */
export function createCompatibilityWrapper(scriptName) {
  return async function() {
    const compatibilityManager = new CompatibilityManager();
    const args = process.argv.slice(2);
    return compatibilityManager.executeOldScript(scriptName, args);
  };
}

// Export for use in other modules
export const compatibilityManager = new CompatibilityManager();
