import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { format } from 'node:util';

/**
 * Logging utility for the unified CLI
 */
export class Logger {
  /**
   * Initialize logger
   * @param {Object} options - Logger options
   * @param {string} options.logFile - Path to log file
   * @param {boolean} options.debug - Enable debug logging
   */
  constructor({ logFile = 'setup-wizard.log', debug = false }) {
    this.logFile = logFile;
    this.debug = debug;
    this.logDir = path.dirname(fileURLToPath(import.meta.url));
    this.fullLogPath = path.join(this.logDir, '..', '..', '..', 'logs', logFile);

    // Ensure logs directory exists
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    const logDir = path.dirname(this.fullLogPath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.warn('Could not create log directory:', error.message);
    }
  }

  /**
   * Log message with timestamp and level
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Object} [context] - Additional context
   */
  async log(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context
    };

    const formattedMessage = this.formatLogEntry(logEntry);

    // Console output
    this.outputToConsole(level, formattedMessage);

    // File output
    try {
      await this.appendToLogFile(formattedMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Format log entry for display
   * @param {Object} entry - Log entry
   * @returns {string} Formatted log entry
   */
  formatLogEntry(entry) {
    const { timestamp, level, message, ...context } = entry;
    const contextStr = Object.keys(context).length > 0
      ? ` | ${JSON.stringify(context)}`
      : '';

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  /**
   * Output to console with appropriate formatting
   * @param {string} level - Log level
   * @param {string} message - Formatted message
   */
  outputToConsole(level, message) {
    switch (level) {
      case 'info':
        console.log(chalk.blue('ℹ'), message);
        break;
      case 'warn':
        console.log(chalk.yellow('⚠'), message);
        break;
      case 'error':
        console.log(chalk.red('✗'), message);
        break;
      case 'debug':
        if (this.debug) {
          console.log(chalk.gray('🐛'), message);
        }
        break;
      default:
        console.log(message);
    }
  }

  /**
   * Append log entry to log file
   * @param {string} message - Log message
   */
  async appendToLogFile(message) {
    try {
      await fs.appendFile(this.fullLogPath, message + '\n');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // If file doesn't exist, create it
      await fs.writeFile(this.fullLogPath, message + '\n');
    }
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} [context] - Additional context
   */
  async info(message, context = {}) {
    await this.log('info', message, context);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} [context] - Additional context
   */
  async warn(message, context = {}) {
    await this.log('warn', message, context);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} [context] - Additional context
   */
  async error(message, context = {}) {
    await this.log('error', message, context);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} [context] - Additional context
   */
  async debug(message, context = {}) {
    await this.log('debug', message, context);
  }

  /**
   * Log step completion
   * @param {number} step - Step number
   * @param {string} stepName - Step name
   * @param {Object} [data] - Step data
   */
  async logStepCompletion(step, stepName, data = {}) {
    await this.info(`Step ${step} completed: ${stepName}`, {
      step,
      stepName,
      ...data
    });
  }

  /**
   * Get log file path
   * @returns {string} Full path to log file
   */
  getLogFilePath() {
    return this.fullLogPath;
  }
}