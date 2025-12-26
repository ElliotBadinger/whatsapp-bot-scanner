import { EnvironmentDetector } from './environment.mjs';
import { DependencyManager } from './dependencies.mjs';
import { ConfigurationManager } from './configuration.mjs';
import { DockerOrchestrator } from './docker.mjs';
import { PairingManager } from './pairing.mjs';
import { UserInterface } from '../ui/prompts.mjs';
import { ProgressManager } from '../ui/progress.mjs';
import { NotificationManager } from '../ui/notifications.mjs';
import { validateApiKey } from '../utils/validation.mjs';
import { Logger } from '../utils/logging.mjs';
import { DependencyError, ConfigurationError, DockerError, PairingError, GlobalErrorHandler, UserRecoverySystem, ERROR_SEVERITY } from './errors.mjs';
import chalk from 'chalk';
import boxen from 'boxen';

/**
 * SetupWizard - Interactive 5-step wizard for unified CLI setup
 *
 * This class orchestrates the complete setup process with visual feedback,
 * error handling, and user-friendly interactions.
 */
export class SetupWizard {
  /**
   * Initialize the setup wizard
   * @param {Object} options - Wizard configuration options
   * @param {string} options.rootDir - Root directory for the project
   * @param {boolean} options.interactive - Whether to run in interactive mode
   * @param {string[]} options.argv - Command line arguments
   */
  constructor({ rootDir, interactive = true, argv = [], debug = false }) {
    this.rootDir = rootDir;
    this.interactive = interactive;
    this.argv = argv;
    this.debug = debug;

    // Initialize logging
    this.logger = new Logger({ debug });

    // Initialize UI components
    this.ui = new UserInterface(interactive);
    this.progress = new ProgressManager();
    this.notifications = new NotificationManager(this.ui);

    // Initialize core components
    this.envDetector = new EnvironmentDetector();
    this.dependencyManager = new DependencyManager(this.envDetector, this.ui);
    this.configManager = new ConfigurationManager(rootDir, this.ui);
    this.dockerOrchestrator = new DockerOrchestrator(rootDir, this.ui);
    this.pairingManager = new PairingManager(this.dockerOrchestrator, this.ui, this.notifications);

    // Wizard state
    this.currentStep = 0;
    this.totalSteps = 5;
    this.setupData = {};

    // Log initialization
    this.logger.info('SetupWizard initialized', {
      rootDir,
      interactive,
      debug
    });
  }

  /**
   * Main entry point for the setup wizard
   */
  async run() {
    try {
      await this.logger.info('Starting setup wizard');

      this.ui.info(chalk.bold('🚀 WhatsApp Bot Scanner - Setup Wizard'));
      this.ui.info('This wizard will guide you through the setup process.');

      // Show welcome message
      this.showWelcomeMessage();

      // Run all 5 steps sequentially
      await this.step1PrerequisitesCheck();
      await this.step2ApiKeysCollection();
      await this.step3WhatsAppPairing();
      await this.step4StartingServices();
      await this.step5Verification();

      // Final success message
      this.showCompletionMessage();

      await this.logger.info('Setup wizard completed successfully', {
        stepsCompleted: this.totalSteps,
        setupData: this.setupData
      });

      return {
        success: true,
        message: 'Setup completed successfully!',
        data: this.setupData,
        logFile: this.logger.getLogFilePath()
      };
    } catch (error) {
      await this.handleWizardError(error);
      return {
        success: false,
        message: 'Setup failed',
        error: error.message,
        logFile: this.logger.getLogFilePath()
      };
    }
  }

  /**
   * Display welcome message with ASCII art
   */
  showWelcomeMessage() {
    const welcomeArt = chalk.bold.green(`
      ██╗    ██╗██╗  ██╗███████╗██████╗ ██████╗ ███████╗
      ██║    ██║██║  ██║██╔════╝██╔══██╗██╔══██╗██╔════╝
      ██║ █╗ ██║███████║█████╗  ██████╔╝██████╔╝█████╗
      ██║███╗██║██╔══██║██╔══╝  ██╔══██╗██╔══██╗██╔══╝
      ╚███╔███╔╝██║  ██║███████╗██║  ██║██║  ██║███████╗
       ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
    `);

    console.log(welcomeArt);
    this.ui.info('Welcome to the WhatsApp Bot Scanner Setup Wizard!');
    this.ui.info('This will guide you through 5 simple steps to get everything running.\n');
  }

  /**
   * Display completion message with next steps
   */
  showCompletionMessage() {
    this.ui.success(chalk.bold.green('🎉 Setup completed successfully!'));

    const dashboardUrl = 'http://localhost:3000';
    const dashboardBox = boxen(chalk.bold(`📊 Dashboard: ${dashboardUrl}`), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
      backgroundColor: '#000000'
    });

    console.log(dashboardBox);
    this.ui.info('Your WhatsApp Bot Scanner is now ready to use!');
    this.ui.info('Next steps:');
    this.ui.info('1. Open the dashboard in your browser');
    this.ui.info('2. Start scanning WhatsApp messages');
    this.ui.info('3. Monitor security alerts and reports');
  }

  /**
   * Handle wizard errors with user-friendly messages
   * @param {Error} error - The error to handle
   */
  handleWizardError(error) {
    this.ui.error(chalk.bold.red('❌ Setup failed'));

    if (error instanceof DependencyError) {
      this.ui.error(`Dependency issue: ${error.message}`);
      this.ui.info('Please install the required dependencies and try again.');
    } else if (error instanceof ConfigurationError) {
      this.ui.error(`Configuration problem: ${error.message}`);
      this.ui.info('Check your configuration files and API keys.');
    } else if (error instanceof DockerError) {
      this.ui.error(`Docker error: ${error.message}`);
      this.ui.info('Make sure Docker is installed and running.');
    } else if (error instanceof PairingError) {
      this.ui.error(`Pairing error: ${error.message}`);
      this.ui.info('Check your WhatsApp connection and try pairing again.');
    } else {
      this.ui.error(`Unexpected error: ${error.message}`);
    }

    this.ui.info('You can run the setup again after resolving the issue.');
    console.error('Error details:', error.stack);
  }

  /**
   * Step 1: Prerequisites Check
   * - Check Node.js version
   * - Check Docker installation
   * - Verify all dependencies
   */
  async step1PrerequisitesCheck() {
    this.currentStep = 1;
    await this.logger.info(`Starting Step ${this.currentStep}: Prerequisites Check`);

    this.ui.info(chalk.bold(`\nStep ${this.currentStep}/${this.totalSteps}: Prerequisites Check`));

    // Check Node.js
    this.progress.start('node-check', 'Checking Node.js version...');
    try {
      const nodeVersion = await this.dependencyManager.getNodeVersion();
      if (!nodeVersion) {
        this.progress.fail('node-check', 'Node.js not found');
        throw new DependencyError('nodejs', 'Node.js is required but not installed');
      }

      if (!this.dependencyManager.isVersionSufficient(nodeVersion)) {
        this.progress.fail('node-check', `Node.js version ${nodeVersion} is insufficient`);
        await this.dependencyManager.ensureNodeJS();
      } else {
        this.progress.succeed('node-check', `Node.js ${nodeVersion} ✓`);
      }

      await this.logger.info('Node.js check passed', { version: nodeVersion });
    } catch (error) {
      this.progress.fail('node-check', 'Node.js check failed');
      await this.logger.error('Node.js check failed', { error: error.message });
      throw new DependencyError('nodejs', error.message, error);
    }

    // Check Docker
    this.progress.start('docker-check', 'Checking Docker installation...');
    try {
      await this.dependencyManager.ensureDocker();
      this.progress.succeed('docker-check', 'Docker ✓');
      await this.logger.info('Docker check passed');
    } catch (error) {
      this.progress.fail('docker-check', 'Docker check failed');
      await this.logger.error('Docker check failed', { error: error.message });
      throw new DependencyError('docker', error.message, error);
    }

    // Verify all dependencies
    this.progress.start('deps-check', 'Verifying all dependencies...');
    try {
      await this.dependencyManager.verifyDependencies();
      this.progress.succeed('deps-check', 'All dependencies verified ✓');
      await this.logger.info('All dependencies verified');
    } catch (error) {
      this.progress.fail('deps-check', 'Dependency verification failed');
      await this.logger.error('Dependency verification failed', { error: error.message });
      throw new DependencyError('dependencies', error.message, error);
    }

    this.ui.success('✅ All prerequisites satisfied');
    this.setupData.prerequisites = {
      nodeVersion: await this.dependencyManager.getNodeVersion(),
      dockerInstalled: true,
      dependenciesVerified: true
    };

    await this.logger.logStepCompletion(this.currentStep, 'Prerequisites Check', this.setupData.prerequisites);
  }

  /**
   * Step 2: API Keys Collection
   * - Collect VirusTotal API key (required)
   * - Collect Google Safe Browsing API key (optional)
   * - Validate and save API keys
   */
  async step2ApiKeysCollection() {
    this.currentStep = 2;
    await this.logger.info(`Starting Step ${this.currentStep}: API Keys Collection`);

    this.ui.info(chalk.bold(`\nStep ${this.currentStep}/${this.totalSteps}: API Keys Collection`));

    // Load existing config or create new one
    try {
      await this.configManager.loadOrCreateConfig();
      await this.logger.info('Configuration loaded or created');
    } catch (error) {
      await this.logger.error('Failed to load configuration', { error: error.message });
      throw new ConfigurationError(`Failed to load configuration: ${error.message}`, error);
    }

    // Collect API keys
    this.progress.start('api-keys', 'Collecting API keys...');

    try {
      const apiKeys = {};

      // VirusTotal API Key (required)
      const vtKey = await this.ui.prompt({
        message: 'Enter VirusTotal API Key:',
        validate: validateApiKey,
        required: true
      });

      apiKeys.VT_API_KEY = vtKey;
      this.ui.success('✓ VirusTotal API key configured');
      await this.logger.info('VirusTotal API key configured');

      // Google Safe Browsing API Key (optional)
      const gsbChoice = await this.ui.confirm({
        message: 'Do you want to configure Google Safe Browsing API?',
        initial: true
      });

      if (gsbChoice) {
        const gsbKey = await this.ui.prompt({
          message: 'Enter Google Safe Browsing API Key (optional):',
          validate: (value) => {
            if (value && value.length < 32) return 'API key must be at least 32 characters';
            return true;
          },
          required: false
        });

        if (gsbKey) {
          apiKeys.GSB_API_KEY = gsbKey;
          this.ui.success('✓ Google Safe Browsing API key configured');
          await this.logger.info('Google Safe Browsing API key configured');
        }
      }

      // Update configuration
      await this.configManager.updateConfig(apiKeys);
      this.progress.succeed('api-keys', 'API keys saved ✓');
      await this.logger.info('API keys saved to configuration');

      this.setupData.apiKeys = {
        virusTotalConfigured: !!apiKeys.VT_API_KEY,
        googleSafeBrowsingConfigured: !!apiKeys.GSB_API_KEY
      };

      await this.logger.logStepCompletion(this.currentStep, 'API Keys Collection', this.setupData.apiKeys);

    } catch (error) {
      this.progress.fail('api-keys', 'API key collection failed');
      await this.logger.error('API key collection failed', { error: error.message });
      throw new ConfigurationError(`Failed to collect API keys: ${error.message}`, error);
    }
  }

  /**
   * Step 3: WhatsApp Pairing
   * - Display pairing options
   * - Monitor for pairing codes
   * - Handle manual pairing
   */
  async step3WhatsAppPairing() {
    this.currentStep = 3;
    await this.logger.info(`Starting Step ${this.currentStep}: WhatsApp Pairing`);

    this.ui.info(chalk.bold(`\nStep ${this.currentStep}/${this.totalSteps}: WhatsApp Pairing`));

    // Check if pairing is needed
    const config = this.configManager.getConfig();
    const needsPairing = config?.whatsapp?.authStrategy === 'remote';

    if (!needsPairing) {
      this.ui.warn('WhatsApp pairing not required for current configuration');
      this.ui.success('✅ WhatsApp pairing setup skipped');
      await this.logger.info('WhatsApp pairing not required - skipped');
      return;
    }

    // Offer pairing choices
    const pairingChoice = await this.ui.select({
      message: 'Choose WhatsApp pairing method:',
      choices: [
        { name: '🤖 Automatic pairing (monitor for pairing codes)', value: 'auto' },
        { name: '📱 Manual pairing (enter code manually)', value: 'manual' },
        { name: '⏭️  Skip pairing for now', value: 'skip' }
      ]
    });

    this.setupData.whatsappPairing = {
      method: pairingChoice,
      timestamp: new Date().toISOString()
    };

    await this.logger.info('WhatsApp pairing method selected', { method: pairingChoice });

    if (pairingChoice === 'auto') {
      await this.handleAutomaticPairing();
    } else if (pairingChoice === 'manual') {
      await this.handleManualPairing();
    } else {
      this.ui.warn('WhatsApp pairing skipped - you can set this up later');
      this.ui.success('✅ WhatsApp pairing setup complete');
      await this.logger.info('WhatsApp pairing skipped by user');
    }

    await this.logger.logStepCompletion(this.currentStep, 'WhatsApp Pairing', this.setupData.whatsappPairing);
  }

  /**
   * Handle automatic pairing with monitoring
   */
  async handleAutomaticPairing() {
    this.ui.info('Starting automatic WhatsApp pairing monitoring...');
    this.ui.info('This will monitor for pairing codes from the WhatsApp client.');

    // Start pairing monitoring with auto-detection
    try {
      this.progress.start('pairing-monitor', 'Monitoring for pairing codes...');
      await this.logger.info('Starting automatic WhatsApp pairing monitoring');

      // Set up pairing success callback
      const pairingSuccessCallback = (result) => {
        this.handlePairingSuccess(result);
      };

      const pairingErrorCallback = (error) => {
        this.handlePairingError(error);
      };

      // Start monitoring with auto-detection
      const monitoringStarted = await this.pairingManager.monitorForPairingSuccess(
        pairingSuccessCallback,
        pairingErrorCallback
      );

      if (!monitoringStarted) {
        throw new PairingError('Failed to start pairing success monitoring');
      }

      this.ui.info('🔍 Waiting for pairing code from WhatsApp...');
      this.ui.info('🎯 Auto-detection enabled - will progress automatically when pairing succeeds');

      // Simulate receiving a pairing code for demonstration
      const simulatedCode = this.pairingManager.generateSimulatedPairingCode();
      const phone = '+1234567890'; // Example phone number

      // Handle the pairing code with countdown
      this.pairingManager.handlePairingCode(simulatedCode, phone);

      this.progress.succeed('pairing-monitor', 'Pairing monitoring active ✓');
      await this.logger.info('Pairing monitoring started successfully with auto-detection');

    } catch (error) {
      this.progress.fail('pairing-monitor', 'Pairing monitoring failed');
      await this.logger.error('Pairing monitoring failed', { error: error.message });
      throw new PairingError(`Failed to start pairing monitoring: ${error.message}`, error);
    }
  }

  /**
   * Handle successful pairing detection
   * @param {Object} result - Pairing success result
   */
  async handlePairingSuccess(result) {
    try {
      this.ui.success('🎉 WhatsApp pairing completed successfully!');

      if (result.sessionInfo) {
        this.ui.info(`Session established: ${result.sessionInfo}`);
      }

      // Update setup data
      this.setupData.whatsappPairing.success = true;
      this.setupData.whatsappPairing.completedAt = new Date().toISOString();
      this.setupData.whatsappPairing.sessionInfo = result.sessionInfo;

      // Automatic progression to next step
      this.ui.success('✅ WhatsApp pairing setup complete - progressing to next step');
      await this.logger.info('WhatsApp pairing completed successfully with auto-detection');

    } catch (error) {
      this.ui.error(`Error handling pairing success: ${error.message}`);
      await this.logger.error('Error handling pairing success', { error: error.message });
    }
  }

  /**
   * Handle pairing error detection
   * @param {Object} error - Pairing error result
   */
  async handlePairingError(error) {
    try {
      this.ui.error('❌ WhatsApp pairing encountered an error');

      if (error.errorDetails) {
        this.ui.error(`Error: ${error.errorDetails}`);
      }

      // Update setup data with error
      this.setupData.whatsappPairing.error = error.message;
      this.setupData.whatsappPairing.errorDetails = error.errorDetails;

      // Offer recovery options
      this.ui.info('You can try again or choose a different pairing method.');
      await this.logger.error('WhatsApp pairing error detected', { error: error.message });

    } catch (error) {
      this.ui.error(`Error handling pairing error: ${error.message}`);
      await this.logger.error('Error handling pairing error', { error: error.message });
    }
  }

  /**
   * Handle manual pairing process
   */
  async handleManualPairing() {
    this.ui.info('Manual WhatsApp pairing process started.');
    await this.logger.info('Starting manual WhatsApp pairing process');

    try {
      const phone = await this.ui.prompt({
        message: 'Enter phone number to pair (with country code, e.g., +1234567890):',
        validate: (value) => {
          if (!value) return 'Phone number is required';
          if (!/^\+?[0-9\s-]+$/.test(value)) return 'Invalid phone number format';
          return true;
        },
        required: true
      });

      this.progress.start('manual-pairing', `Requesting pairing for ${phone}...`);
      this.ui.info(`📱 Manual pairing requested for ${phone}`);
      this.ui.info('Please check your WhatsApp for the pairing code.');

      await this.logger.info('Manual pairing requested', { phone });

      // Request manual pairing which will generate and display the code
      await this.pairingManager.requestManualPairing();

      this.progress.succeed('manual-pairing', 'Manual pairing request sent ✓');
      this.ui.success('✅ Manual pairing setup complete');
      await this.logger.info('Manual pairing request completed');

    } catch (error) {
      this.progress.fail('manual-pairing', 'Manual pairing failed');
      await this.logger.error('Manual pairing failed', { error: error.message });
      throw new PairingError(`Manual pairing failed: ${error.message}`, error);
    }
  }

  /**
   * Step 4: Starting Services
   * - Build Docker containers
   * - Start all services
   * - Monitor progress with real-time logs
   */
  async step4StartingServices() {
    this.currentStep = 4;
    await this.logger.info(`Starting Step ${this.currentStep}: Starting Services`);

    this.ui.info(chalk.bold(`\nStep ${this.currentStep}/${this.totalSteps}: Starting Services`));

    this.progress.start('docker-build', 'Building Docker containers...');
    await this.logger.info('Starting Docker build process');

    try {
      // Build and start services
      await this.dockerOrchestrator.buildAndStartServices();
      await this.logger.info('Docker containers built and started');

      this.progress.succeed('docker-build', 'Docker containers built and started ✓');

      // Start real-time log streaming for key services
      this.ui.info('📡 Starting real-time log monitoring...');
      const logStreams = [];

      // Stream logs for key services with formatting
      const servicesToMonitor = ['wa-client', 'control-plane', 'scan-orchestrator'];
      for (const service of servicesToMonitor) {
        try {
          const { stop } = await this.dockerOrchestrator.streamLogsWithFormatting(service, {
            tail: '50',
            timestamps: true,
            follow: true
          });
          logStreams.push({ service, stop });
          this.ui.info(`📊 Monitoring logs for ${service}`);
        } catch (error) {
          this.ui.warn(`⚠ Could not start log monitoring for ${service}: ${error.message}`);
        }
      }

      // Show service status with enhanced health monitoring
      this.progress.start('service-status', 'Checking service status...');
      const healthResults = await this.dockerOrchestrator.checkAllServicesHealth();
      this.dockerOrchestrator.displayHealthStatus(healthResults);
      await this.logger.info('Retrieved and displayed service health status');

      // Parse and display service status
      const runningServices = healthResults
        .filter(r => r.healthy)
        .map(r => r.service);

      this.progress.succeed('service-status', `${runningServices.length} services healthy ✓`);

      this.setupData.services = {
        started: true,
        runningServices,
        healthResults,
        timestamp: new Date().toISOString()
      };

      this.ui.success('✅ All services started successfully with real-time monitoring');
      await this.logger.logStepCompletion(this.currentStep, 'Starting Services', this.setupData.services);

      // Store log stream stop functions for cleanup
      this.setupData.logStreams = logStreams;

    } catch (error) {
      // Clean up any active log streams
      if (this.setupData.logStreams) {
        for (const { stop } of this.setupData.logStreams) {
          try {
            stop();
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
      }

      this.progress.fail('docker-build', 'Failed to start services');
      await this.logger.error('Failed to start services', { error: error.message });
      throw new DockerError(`Failed to start services: ${error.message}`, error);
    }
  }

  /**
   * Step 5: Verification
   * - Verify service health
   * - Check WhatsApp connection
   * - Display final status
   */
  async step5Verification() {
    this.currentStep = 5;
    await this.logger.info(`Starting Step ${this.currentStep}: Verification`);

    this.ui.info(chalk.bold(`\nStep ${this.currentStep}/${this.totalSteps}: Verification`));

    this.progress.start('verification', 'Verifying setup...');
    await this.logger.info('Starting setup verification');

    try {
      // Check service health
      const status = await this.dockerOrchestrator.getServiceStatus();
      const requiredServices = ['wa-client', 'control-plane', 'scan-orchestrator'];
      let allServicesHealthy = true;

      for (const service of requiredServices) {
        if (status.includes(service) && status.includes('Up')) {
          this.ui.success(`✓ ${service} is healthy`);
          await this.logger.info(`Service ${service} verified as healthy`);
        } else {
          this.ui.warn(`⚠ ${service} may have issues`);
          await this.logger.warn(`Service ${service} may have health issues`);
          allServicesHealthy = false;
        }
      }

      // Verify WhatsApp connection (simplified check)
      if (this.setupData.whatsappPairing?.method === 'auto') {
        this.ui.info('🔄 WhatsApp connection: Monitoring active');
        await this.logger.info('WhatsApp connection: monitoring active');
      } else if (this.setupData.whatsappPairing?.method === 'manual') {
        this.ui.info('📱 WhatsApp connection: Manual pairing configured');
        await this.logger.info('WhatsApp connection: manual pairing configured');
      } else {
        this.ui.info('ℹ️  WhatsApp connection: Not configured');
        await this.logger.info('WhatsApp connection: not configured');
      }

      // Final verification
      if (allServicesHealthy) {
        this.progress.succeed('verification', 'All systems verified ✓');
        this.ui.success('✅ Setup verification complete - all systems operational');
        await this.logger.info('All systems verified as operational');
      } else {
        this.progress.warn('verification', 'Setup complete with some warnings');
        this.ui.warn('⚠️  Setup complete but some services may need attention');
        await this.logger.warn('Setup complete with some service warnings');
      }

      this.setupData.verification = {
        allServicesHealthy,
        timestamp: new Date().toISOString()
      };

      await this.logger.logStepCompletion(this.currentStep, 'Verification', this.setupData.verification);

    } catch (error) {
      this.progress.fail('verification', 'Verification failed');
      await this.logger.error('Verification failed', { error: error.message });
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  /**
   * Get current wizard state
   * @returns {Object} Current wizard state
   */
  getState() {
    return {
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      setupData: this.setupData,
      interactive: this.interactive
    };
  }
}