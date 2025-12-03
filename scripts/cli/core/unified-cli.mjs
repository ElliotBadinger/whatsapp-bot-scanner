import { EnvironmentDetector } from './environment.mjs';
import { DependencyManager } from './dependencies.mjs';
import { ConfigurationManager } from './configuration.mjs';
import { DockerOrchestrator } from './docker.mjs';
import { PairingManager } from './pairing.mjs';
import { UserInterface } from '../ui/prompts.mjs';
import { ProgressManager } from '../ui/progress.mjs';
import { NotificationManager } from '../ui/notifications.mjs';
import { SetupWizard } from './setup-wizard.mjs';
import { handleError } from './errors.mjs';

export class UnifiedCLI {
  constructor(argv) {
    this.argv = argv;
    this.rootDir = process.cwd();
    this.interactive = !argv.includes('--noninteractive');
    this.debug = argv.includes('--debug');

    // Initialize UI components
    this.ui = new UserInterface(this.interactive);
    this.progress = new ProgressManager();

    // Initialize core components
    this.envDetector = new EnvironmentDetector();
    this.dependencyManager = new DependencyManager(this.envDetector, this.ui);
    this.configManager = new ConfigurationManager(this.rootDir, this.ui);
    this.dockerOrchestrator = new DockerOrchestrator(this.rootDir, this.ui);
    this.notifications = new NotificationManager(this.ui);
    this.pairingManager = new PairingManager(this.dockerOrchestrator, this.ui, this.notifications);
  }

  async run() {
    try {
      const wizard = this.createSetupWizard();

      // Run the complete 5-step wizard
      const result = await wizard.run();

      if (result.success) {
        this.ui.success('🎉 Setup completed successfully!');
        return result;
      } else {
        throw new Error(result.error || 'Setup failed');
      }
    } catch (error) {
      handleError(error, this);
      process.exit(1);
    }
  }

  /**
   * Get the setup wizard instance
   * @returns {SetupWizard} The setup wizard instance
   */
  getSetupWizard() {
    return this.setupWizard;
  }

  /**
   * Check if setup wizard has been initialized
   * @returns {boolean} True if wizard is initialized
   */
  hasSetupWizard() {
    return !!this.setupWizard;
  }

  /**
   * Get the Docker orchestrator instance
   * @returns {DockerOrchestrator} The Docker orchestrator instance
   */
  getDockerOrchestrator() {
    return this.dockerOrchestrator;
  }

  /**
   * Get the pairing manager instance
   * @returns {PairingManager}
   */
  getPairingManager() {
    return this.pairingManager;
  }

  /**
   * Get configuration manager
   * @returns {ConfigurationManager}
   */
  getConfigurationManager() {
    return this.configManager;
  }

  /**
   * Get dependency manager
   * @returns {DependencyManager}
   */
  getDependencyManager() {
    return this.dependencyManager;
  }

  /**
   * Get notification manager
   * @returns {NotificationManager}
   */
  getNotificationManager() {
    return this.notifications;
  }

  /**
   * Get UI helper
   * @returns {UserInterface}
   */
  getUserInterface() {
    return this.ui;
  }

  /**
   * Factory for setup wizard instances with shared config
   * @param {Object} options
   * @returns {SetupWizard}
   */
  createSetupWizard(options = {}) {
    this.setupWizard = new SetupWizard({
      rootDir: this.rootDir,
      interactive: this.interactive,
      argv: this.argv,
      debug: this.debug,
      skipPairing: options.skipPairing ?? false
    });
    return this.setupWizard;
  }

  /**
   * Stream logs for a specific service with formatting
   * @param {string} serviceName - Service name to stream logs for
   * @param {Object} options - Log streaming options
   */
  async streamServiceLogs(serviceName, options = {}) {
    try {
      const { process, stop } = await this.dockerOrchestrator.streamLogsWithFormatting(serviceName, options);

      // Handle process events
      process.on('error', (error) => {
        this.ui.error(`Log streaming error: ${error.message}`);
        // Don't exit in test environment
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
      });

      process.on('exit', (code) => {
        if (code !== 0) {
          this.ui.error(`Log streaming process exited with code ${code}`);
          // Don't exit in test environment
          if (process.env.NODE_ENV !== 'test') {
            process.exit(code);
          }
        }
      });

      return { process, stop };
    } catch (error) {
      handleError(error, this);
      // Don't exit in test environment
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error; // Re-throw for test handling
    }
  }

  /**
   * Check and display service health status
   */
  async checkServiceHealth() {
    try {
      const healthResults = await this.dockerOrchestrator.checkAllServicesHealth();
      this.dockerOrchestrator.displayHealthStatus(healthResults);
      return healthResults;
    } catch (error) {
      handleError(error, this);
      // Don't exit in test environment
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error; // Re-throw for test handling
    }
  }

  /**
   * Start health monitoring for services
   * @param {string[]} services - Services to monitor
   * @param {number} interval - Monitoring interval in ms
   */
  async startHealthMonitoring(services, interval = 5000) {
    try {
      return await this.dockerOrchestrator.startHealthMonitoring(services, interval);
    } catch (error) {
      handleError(error, this);
      // Don't exit in test environment
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error; // Re-throw for test handling
    }
  }
}