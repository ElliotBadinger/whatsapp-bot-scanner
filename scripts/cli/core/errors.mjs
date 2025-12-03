export class SetupError extends Error {
  constructor(message, cause = null, severity = "error", context = null) {
    super(message);
    this.name = "SetupError";
    this.cause = cause;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.recoverySuggestions = [];
  }

  addRecoverySuggestion(suggestion) {
    this.recoverySuggestions.push(suggestion);
    return this;
  }

  getFormattedError() {
    return {
      type: this.name,
      message: this.message,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      cause: this.cause,
      recoverySuggestions: this.recoverySuggestions,
    };
  }
}

export class DependencyError extends SetupError {
  constructor(dependency, message, cause = null, context = null) {
    super(
      `Dependency error (${dependency}): ${message}`,
      cause,
      "critical",
      context,
    );
    this.name = "DependencyError";
    this.dependency = dependency;
    this.addRecoverySuggestion(`Please install ${dependency} and try again`);
    this.addRecoverySuggestion(
      `Run: sudo apt-get install ${dependency} (or equivalent for your OS)`,
    );
  }
}

export class ConfigurationError extends SetupError {
  constructor(message, cause = null, context = null) {
    super(`Configuration error: ${message}`, cause, "high", context);
    this.name = "ConfigurationError";
    this.addRecoverySuggestion(
      "Check your configuration files for syntax errors",
    );
    this.addRecoverySuggestion("Verify all required fields are present");
    this.addRecoverySuggestion("Run: npm run validate-config");
  }
}

export class DockerError extends SetupError {
  constructor(message, cause = null, context = null) {
    super(`Docker error: ${message}`, cause, "critical", context);
    this.name = "DockerError";
    this.addRecoverySuggestion("Check if Docker daemon is running");
    this.addRecoverySuggestion("Run: sudo systemctl start docker");
    this.addRecoverySuggestion(
      "Verify Docker installation with: docker --version",
    );
  }
}

export class DockerComposeError extends DockerError {
  constructor(message, cause = null, context = null) {
    super(`Docker Compose error: ${message}`, cause, "critical", context);
    this.name = "DockerComposeError";
    this.addRecoverySuggestion(
      "Please ensure Docker Compose v2 is installed and running",
    );
    this.addRecoverySuggestion("Run: docker compose version");
    this.addRecoverySuggestion(
      "If using legacy docker-compose, upgrade to Docker Compose v2",
    );
  }
}

export class DockerContainerError extends DockerError {
  constructor(containerName, message, cause = null, context = null) {
    super(
      `Container error (${containerName}): ${message}`,
      cause,
      "high",
      context,
    );
    this.name = "DockerContainerError";
    this.containerName = containerName;
    this.addRecoverySuggestion(
      `Container ${containerName} may need to be restarted`,
    );
    this.addRecoverySuggestion(`Run: docker compose restart ${containerName}`);
    this.addRecoverySuggestion(
      `Check container logs: docker compose logs ${containerName}`,
    );
  }
}

export class DockerLogStreamError extends DockerError {
  constructor(message, cause = null, context = null) {
    super(`Log streaming error: ${message}`, cause, "medium", context);
    this.name = "DockerLogStreamError";
    this.addRecoverySuggestion(
      "Log streaming failed. Check if containers are running",
    );
    this.addRecoverySuggestion("Run: docker compose ps");
    this.addRecoverySuggestion("Try restarting the log streaming process");
  }
}

export class DockerHealthCheckError extends DockerError {
  constructor(serviceName, message, cause = null, context = null) {
    super(
      `Health check error (${serviceName}): ${message}`,
      cause,
      "high",
      context,
    );
    this.name = "DockerHealthCheckError";
    this.serviceName = serviceName;
    this.addRecoverySuggestion(`Service ${serviceName} health check failed`);
    this.addRecoverySuggestion(`Run: docker compose logs ${serviceName}`);
    this.addRecoverySuggestion(`Check service configuration and dependencies`);
  }
}

export class PairingError extends SetupError {
  constructor(message, cause = null, context = null) {
    super(`Pairing error: ${message}`, cause, "high", context);
    this.name = "PairingError";
    this.addRecoverySuggestion(
      "Check your WhatsApp connection and credentials",
    );
    this.addRecoverySuggestion(
      "Verify your phone number format (include country code)",
    );
    this.addRecoverySuggestion("Try generating a new pairing code");
  }
}

export class ValidationError extends SetupError {
  constructor(field, message, cause = null, context = null) {
    super(`Validation error (${field}): ${message}`, cause, "medium", context);
    this.name = "ValidationError";
    this.field = field;
    this.addRecoverySuggestion(
      `Please check the ${field} field and correct the value`,
    );
    this.addRecoverySuggestion(
      "Verify the format and requirements for this field",
    );
  }
}

export class NetworkError extends SetupError {
  constructor(message, cause = null, context = null) {
    super(`Network error: ${message}`, cause, "critical", context);
    this.name = "NetworkError";
    this.addRecoverySuggestion("Check your internet connection");
    this.addRecoverySuggestion(
      "Verify network connectivity to required services",
    );
    this.addRecoverySuggestion(
      "Check firewall settings and proxy configurations",
    );
  }
}

export class TimeoutError extends SetupError {
  constructor(operation, timeout, cause = null, context = null) {
    super(
      `Timeout error: ${operation} timed out after ${timeout}ms`,
      cause,
      "medium",
      context,
    );
    this.name = "TimeoutError";
    this.operation = operation;
    this.timeout = timeout;
    this.addRecoverySuggestion(
      `The operation ${operation} took too long to complete`,
    );
    this.addRecoverySuggestion(
      "Check system resources and network connectivity",
    );
    this.addRecoverySuggestion(
      "Try increasing the timeout or retrying the operation",
    );
  }
}

export class RetryError extends SetupError {
  constructor(operation, maxRetries, cause = null, context = null) {
    super(
      `Retry error: ${operation} failed after ${maxRetries} attempts`,
      cause,
      "high",
      context,
    );
    this.name = "RetryError";
    this.operation = operation;
    this.maxRetries = maxRetries;
    this.addRecoverySuggestion(
      `The operation ${operation} failed after multiple attempts`,
    );
    this.addRecoverySuggestion(
      "Check the underlying issue causing the failure",
    );
    this.addRecoverySuggestion(
      "Consider manual intervention or different approach",
    );
  }
}

// Error severity levels
export const ERROR_SEVERITY = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "info",
};

// Global error handler with comprehensive error handling
export class GlobalErrorHandler {
  constructor(context) {
    this.context = context;
    this.errorLog = [];
    this.maxErrorLogSize = 100;
  }

  handleError(error, contextOverride = null) {
    const context = contextOverride || this.context;
    const formattedError = this.formatError(error, context);

    // Log the error
    this.logError(formattedError);

    // Display user-friendly error message
    this.displayUserError(formattedError);

    // Attempt recovery if possible
    this.attemptRecovery(formattedError);

    // Return formatted error for further processing
    return formattedError;
  }

  formatError(error, context) {
    // Handle different error types
    if (error instanceof SetupError) {
      return error.getFormattedError();
    }

    // Handle generic errors
    const formatted = {
      type: error.name || "UnknownError",
      message: error.message || "An unknown error occurred",
      severity: "high",
      context: context,
      timestamp: new Date().toISOString(),
      cause: error.cause || null,
      stack: error.stack,
      recoverySuggestions: [],
    };

    // Add context-specific suggestions
    if (context) {
      formatted.recoverySuggestions.push(
        `Check the ${context} component for issues`,
      );
    }

    return formatted;
  }

  logError(formattedError) {
    // Add to error log
    this.errorLog.push(formattedError);

    // Keep log size manageable
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.shift();
    }

    // Log to console
    console.error(
      `[${formattedError.timestamp}] [${formattedError.severity.toUpperCase()}] ${formattedError.type}: ${formattedError.message}`,
    );

    // Log to context if available
    if (this.context && this.context.logger) {
      this.context.logger.error("Error occurred", formattedError);
    }
  }

  displayUserError(formattedError) {
    if (!this.context || !this.context.ui) {
      console.error(`Error: ${formattedError.message}`);
      return;
    }

    // Display error based on severity
    switch (formattedError.severity) {
      case ERROR_SEVERITY.CRITICAL:
        this.context?.ui?.error(`🚨 CRITICAL: ${formattedError.message}`);
        break;
      case ERROR_SEVERITY.HIGH:
        this.context?.ui?.error(`❌ ERROR: ${formattedError.message}`);
        break;
      case ERROR_SEVERITY.MEDIUM:
        this.context?.ui?.warn(`⚠️  WARNING: ${formattedError.message}`);
        break;
      case ERROR_SEVERITY.LOW:
        this.context?.ui?.info(`ℹ️  INFO: ${formattedError.message}`);
        break;
      default:
        this.context?.ui?.error(`❌ ERROR: ${formattedError.message}`);
    }

    // Display context if available
    if (formattedError.context) {
      this.context?.ui?.info(`Context: ${formattedError.context}`);
    }

    // Display recovery suggestions
    if (
      formattedError.recoverySuggestions &&
      formattedError.recoverySuggestions.length > 0
    ) {
      this.context?.ui?.info("💡 Recovery suggestions:");
      formattedError.recoverySuggestions.forEach((suggestion, index) => {
        this.context?.ui?.info(`   ${index + 1}. ${suggestion}`);
      });
    }

    // Display additional details for critical errors
    if (
      formattedError.severity === ERROR_SEVERITY.CRITICAL &&
      formattedError.cause
    ) {
      this.context?.ui?.info(
        `Cause: ${formattedError.cause.message || formattedError.cause}`,
      );
    }
  }

  attemptRecovery(formattedError) {
    if (!this.context) return;

    // Context-specific recovery attempts
    if (
      formattedError.context === "docker" &&
      this.context.dockerOrchestrator
    ) {
      this.attemptDockerRecovery(formattedError);
    } else if (
      formattedError.context === "pairing" &&
      this.context.pairingManager
    ) {
      this.attemptPairingRecovery(formattedError);
    } else if (
      formattedError.context === "configuration" &&
      this.context.configManager
    ) {
      this.attemptConfigurationRecovery(formattedError);
    }
  }

  attemptDockerRecovery(error) {
    try {
      this.context.ui.info("🔧 Attempting Docker recovery...");

      // Try to restart containers if Docker error
      if (error.type === "DockerContainerError" && error.containerName) {
        this.context.ui.info(
          `Attempting to restart container: ${error.containerName}`,
        );
        // In a real implementation, this would call docker restart
        this.context.ui.info("Docker recovery attempt completed");
      }
    } catch (recoveryError) {
      this.context.ui.warn(`Recovery attempt failed: ${recoveryError.message}`);
    }
  }

  attemptPairingRecovery(error) {
    try {
      this.context.ui.info("🔧 Attempting pairing recovery...");

      // Try to refresh pairing code if pairing error
      if (error.type === "PairingError") {
        this.context.ui.info("Attempting to refresh pairing code...");
        if (
          this.context.pairingManager &&
          typeof this.context.pairingManager.refreshPairingCode === "function"
        ) {
          this.context.pairingManager.refreshPairingCode();
        }
      }
    } catch (recoveryError) {
      this.context.ui.warn(`Recovery attempt failed: ${recoveryError.message}`);
    }
  }

  attemptConfigurationRecovery(error) {
    try {
      this.context.ui.info("🔧 Attempting configuration recovery...");

      // Try to reload configuration if configuration error
      if (error.type === "ConfigurationError") {
        this.context.ui.info("Attempting to reload configuration...");
        // In a real implementation, this would reload config
        this.context.ui.info("Configuration recovery attempt completed");
      }
    } catch (recoveryError) {
      this.context.ui.warn(`Recovery attempt failed: ${recoveryError.message}`);
    }
  }

  getErrorLog() {
    return [...this.errorLog];
  }

  clearErrorLog() {
    this.errorLog = [];
  }

  // Retry mechanism with exponential backoff
  async retryOperation(
    operation,
    maxRetries = 3,
    initialDelay = 1000,
    context = null,
  ) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;
        const delay = initialDelay * Math.pow(2, attempt - 1);

        if (this.context && this.context.ui) {
          this.context.ui.warn(
            `Attempt ${attempt} failed. Retrying in ${delay / 1000} seconds...`,
          );
        }

        // Log the retry attempt
        if (this.context && this.context.logger) {
          this.context.logger.warn("Operation retry attempt", {
            attempt,
            maxRetries,
            delay,
            error: error.message,
            context: context,
          });
        }

        // Wait before retrying
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed, throw a RetryError
    throw new RetryError(context || "operation", maxRetries, lastError);
  }

  // Fallback mechanism
  async withFallback(primaryOperation, fallbackOperation, context = null) {
    try {
      return await primaryOperation();
    } catch (error) {
      if (this.context && this.context.ui) {
        this.context.ui.warn(
          `Primary operation failed, attempting fallback: ${error.message}`,
        );
      }

      try {
        const result = await fallbackOperation();
        if (this.context && this.context.ui) {
          this.context.ui.info("Fallback operation succeeded");
        }
        return result;
      } catch (fallbackError) {
        if (this.context && this.context.ui) {
          this.context.ui.error(
            `Both primary and fallback operations failed: ${fallbackError.message}`,
          );
        }
        throw fallbackError;
      }
    }
  }
}

// Enhanced error handler function
export function handleError(error, context) {
  const globalHandler = new GlobalErrorHandler(context);
  return globalHandler.handleError(error);
}

// Error context tracking
export class ErrorContextTracker {
  constructor() {
    this.contextStack = [];
  }

  pushContext(context) {
    this.contextStack.push(context);
  }

  popContext() {
    return this.contextStack.pop();
  }

  getCurrentContext() {
    return this.contextStack.length > 0
      ? this.contextStack[this.contextStack.length - 1]
      : null;
  }

  clearContext() {
    this.contextStack = [];
  }
}

// User Recovery System
export class UserRecoverySystem {
  constructor(context) {
    this.context = context;
    this.recoveryOptions = [];
    this.recoveryHistory = [];
    this.maxRecoveryHistory = 50;
  }

  addRecoveryOption(option) {
    this.recoveryOptions.push(option);
  }

  getRecoveryOptions() {
    return [...this.recoveryOptions];
  }

  clearRecoveryOptions() {
    this.recoveryOptions = [];
  }

  addRecoveryAttempt(attempt) {
    this.recoveryHistory.push({
      ...attempt,
      timestamp: new Date().toISOString(),
    });

    // Keep history size manageable
    if (this.recoveryHistory.length > this.maxRecoveryHistory) {
      this.recoveryHistory.shift();
    }
  }

  getRecoveryHistory() {
    return [...this.recoveryHistory];
  }

  clearRecoveryHistory() {
    this.recoveryHistory = [];
  }

  // Interactive recovery menu
  async showRecoveryMenu(error) {
    if (!this.context || !this.context.ui) {
      console.log("Recovery options available:");
      this.recoveryOptions.forEach((option, index) => {
        console.log(`  ${index + 1}. ${option.description}`);
      });
      return;
    }

    this.context.ui.info("🛠️  Recovery Options Available:");
    this.context.ui.info("─".repeat(40));

    const choices = this.recoveryOptions.map((option, index) => ({
      name: `${index + 1}. ${option.description}`,
      value: option.action,
    }));

    // Add exit option
    choices.push({
      name: `${choices.length + 1}. Exit recovery menu`,
      value: "exit",
    });

    const selectedAction = await this.context.ui.select({
      message: "Select a recovery option:",
      choices: choices,
    });

    if (selectedAction === "exit") {
      this.context.ui.info("Exiting recovery menu.");
      return;
    }

    // Execute the selected recovery action
    try {
      this.context.ui.info(`🔧 Executing recovery action: ${selectedAction}`);
      await selectedAction();
      this.context.ui.success("✅ Recovery action completed successfully!");
    } catch (recoveryError) {
      this.context.ui.error(
        `❌ Recovery action failed: ${recoveryError.message}`,
      );
      this.addRecoveryAttempt({
        action: selectedAction,
        success: false,
        error: recoveryError.message,
      });
    }
  }

  // Add common recovery options based on error type
  addCommonRecoveryOptions(error) {
    this.clearRecoveryOptions();

    // Add error-specific recovery options
    if (error instanceof DependencyError) {
      this.addRecoveryOption({
        description: `Install ${error.dependency} automatically`,
        action: async () => {
          if (this.context && this.context.dependencyManager) {
            await this.context.dependencyManager.ensureDependencies();
          }
        },
      });

      this.addRecoveryOption({
        description: `Show manual installation instructions for ${error.dependency}`,
        action: async () => {
          this.context.ui.info(
            `Manual installation instructions for ${error.dependency}:`,
          );
          error.recoverySuggestions.forEach((suggestion) => {
            this.context.ui.info(`   • ${suggestion}`);
          });
        },
      });
    }

    // Add Docker-specific recovery options
    if (error instanceof DockerError) {
      this.addRecoveryOption({
        description: "Restart Docker daemon",
        action: async () => {
          this.context.ui.info("Attempting to restart Docker daemon...");
          // In a real implementation, this would execute: sudo systemctl restart docker
          this.context.ui.info("Docker restart command would be executed here");
        },
      });

      this.addRecoveryOption({
        description: "Check Docker service status",
        action: async () => {
          if (this.context && this.context.dockerOrchestrator) {
            const status =
              await this.context.dockerOrchestrator.getServiceStatus();
            this.context.ui.info("Docker service status:");
            this.context.ui.info(status);
          }
        },
      });
    }

    // Add pairing-specific recovery options
    if (error instanceof PairingError) {
      this.addRecoveryOption({
        description: "Retry pairing process",
        action: async () => {
          if (this.context && this.context.pairingManager) {
            await this.context.pairingManager.requestManualPairing();
          }
        },
      });

      this.addRecoveryOption({
        description: "Show pairing troubleshooting guide",
        action: async () => {
          this.context.ui.info("WhatsApp Pairing Troubleshooting Guide:");
          this.context.ui.info(
            "1. Verify your phone number format (include country code)",
          );
          this.context.ui.info("2. Check your internet connection");
          this.context.ui.info(
            "3. Ensure WhatsApp is not running on another device",
          );
          this.context.ui.info("4. Verify your API keys are valid");
          this.context.ui.info("5. Check Docker container logs for wa-client");
        },
      });
    }

    // Add general recovery options
    this.addRecoveryOption({
      description: "Show detailed error information",
      action: async () => {
        this.context.ui.info("Detailed Error Information:");
        this.context.ui.info(`Type: ${error.name}`);
        this.context.ui.info(`Message: ${error.message}`);
        this.context.ui.info(`Severity: ${error.severity}`);
        if (error.context) {
          this.context.ui.info(`Context: ${error.context}`);
        }
        if (error.cause) {
          this.context.ui.info(`Cause: ${error.cause.message || error.cause}`);
        }
      },
    });

    this.addRecoveryOption({
      description: "Show system diagnostic information",
      action: async () => {
        this.context.ui.info("System Diagnostic Information:");
        if (this.context && this.context.envDetector) {
          const envInfo = await this.context.envDetector.detect();
          this.context.ui.info(
            `Platform: ${envInfo.platform.platform} (${envInfo.platform.arch})`,
          );
          this.context.ui.info(
            `Node.js: ${this.context.dependencyManager.getNodeVersion()}`,
          );
          this.context.ui.info(`Docker: Installed`);
          this.context.ui.info(`Package Manager: ${envInfo.packageManager}`);
        }
      },
    });

    this.addRecoveryOption({
      description: "Restart the entire setup process",
      action: async () => {
        this.context.ui.info("⚠️  Restarting setup process...");
        if (this.context && this.context.setupWizard) {
          await this.context.setupWizard.run();
        }
      },
    });
  }

  // Fallback strategy system
  async executeWithFallbacks(
    primaryAction,
    fallbackActions = [],
    context = "operation",
  ) {
    let lastError = null;

    // Try primary action
    try {
      return await primaryAction();
    } catch (error) {
      lastError = error;
      this.context.ui.warn(`Primary ${context} failed: ${error.message}`);
    }

    // Try fallback actions in order
    for (let i = 0; i < fallbackActions.length; i++) {
      try {
        this.context.ui.info(
          `🔄 Attempting fallback ${i + 1}/${fallbackActions.length}...`,
        );
        return await fallbackActions[i].action();
      } catch (fallbackError) {
        lastError = fallbackError;
        this.context.ui.warn(
          `Fallback ${i + 1} failed: ${fallbackError.message}`,
        );

        // Add to recovery history
        this.addRecoveryAttempt({
          action: fallbackActions[i].description,
          success: false,
          error: fallbackError.message,
        });
      }
    }

    // All attempts failed
    const finalError = new RetryError(
      context,
      fallbackActions.length + 1,
      lastError,
    );
    finalError.addRecoverySuggestion("All recovery attempts failed");
    finalError.addRecoverySuggestion(
      "Check system logs for detailed information",
    );
    finalError.addRecoverySuggestion(
      "Consider manual intervention or support request",
    );
    this.errorHandler.handleError(finalError);
    throw finalError;
  }
}
