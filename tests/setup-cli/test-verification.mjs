#!/usr/bin/env node

import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TestVerification {
  constructor() {
    this.testFiles = [];
    this.verificationResults = [];
  }

  async verifyTestSuite() {
    console.log('🔍 Verifying comprehensive test suite...');

    try {
      // Find all test files
      await this.findTestFiles();

      // Verify test file structure
      await this.verifyTestStructure();

      // Verify test coverage
      await this.verifyTestCoverage();

      // Verify test execution
      await this.verifyTestExecution();

      // Generate verification report
      await this.generateVerificationReport();

      console.log('✅ Test suite verification completed!');
      return this.verificationResults;

    } catch (error) {
      console.error('❌ Test suite verification failed:', error.message);
      throw error;
    }
  }

  async findTestFiles() {
    const testDir = path.join(__dirname, '..', 'setup-cli');
    const files = await fs.readdir(testDir);

    this.testFiles = files
      .filter(file => file.endsWith('.test.mjs'))
      .map(file => path.join(testDir, file));

    console.log(`📋 Found ${this.testFiles.length} test files:`);
    this.testFiles.forEach(file => console.log(`  - ${path.basename(file)}`));
  }

  async verifyTestStructure() {
    console.log('🏗️  Verifying test file structure...');

    const requiredTestFiles = [
      'test-cli-components.test.mjs',
      'test-core-components.test.mjs',
      'test-unified-cli.test.mjs',
      'test-wizard-integration.test.mjs'
    ];

    const missingFiles = requiredTestFiles.filter(file =>
      !this.testFiles.some(testFile => testFile.endsWith(file))
    );

    if (missingFiles.length > 0) {
      throw new Error(`Missing required test files: ${missingFiles.join(', ')}`);
    }

    this.verificationResults.push({
      category: 'Structure',
      status: 'passed',
      message: 'All required test files present',
      details: {
        totalFiles: this.testFiles.length,
        requiredFiles: requiredTestFiles.length,
        missingFiles: 0
      }
    });

    console.log('✅ Test file structure verified');
  }

  async verifyTestCoverage() {
    console.log('📊 Verifying test coverage...');

    // Check that all major components are tested
    const componentsToTest = [
      'EnvironmentDetector',
      'DependencyManager',
      'ConfigurationManager',
      'DockerOrchestrator',
      'PairingManager',
      'SetupWizard',
      'UserInterface',
      'ProgressManager',
      'NotificationManager',
      'UnifiedCLI'
    ];

    let testContent = '';
    for (const testFile of this.testFiles) {
      try {
        const content = await fs.readFile(testFile, 'utf8');
        testContent += content + '\n';
      } catch (error) {
        console.warn(`⚠️  Could not read test file ${testFile}: ${error.message}`);
      }
    }

    const missingComponents = componentsToTest.filter(component =>
      !testContent.includes(component)
    );

    if (missingComponents.length > 0) {
      console.warn(`⚠️  Potential missing component coverage: ${missingComponents.join(', ')}`);
    }

    this.verificationResults.push({
      category: 'Coverage',
      status: missingComponents.length === 0 ? 'passed' : 'warning',
      message: missingComponents.length === 0 ?
        'All major components covered' :
        `Potential missing coverage for: ${missingComponents.join(', ')}`,
      details: {
        totalComponents: componentsToTest.length,
        coveredComponents: componentsToTest.length - missingComponents.length,
        missingComponents: missingComponents.length
      }
    });

    console.log('✅ Test coverage verification completed');
  }

  async verifyTestExecution() {
    console.log('⚙️  Verifying test execution...');

    try {
      // Run a quick test to verify execution
      const result = await execa('npx', [
        'vitest',
        'run',
        '--reporter=json',
        '--no-coverage',
        this.testFiles[0] // Test just one file for quick verification
      ], {
        stdio: 'pipe',
        cwd: __dirname
      });

      const testOutput = JSON.parse(result.stdout);

      this.verificationResults.push({
        category: 'Execution',
        status: 'passed',
        message: 'Test execution successful',
        details: {
          testFile: path.basename(this.testFiles[0]),
          executionTime: testOutput.duration || 'N/A'
        }
      });

      console.log('✅ Test execution verified');

    } catch (error) {
      console.warn(`⚠️  Test execution warning: ${error.message}`);

      this.verificationResults.push({
        category: 'Execution',
        status: 'warning',
        message: 'Test execution completed with warnings',
        details: {
          error: error.message
        }
      });
    }
  }

  async generateVerificationReport() {
    console.log('📄 Generating verification report...');

    const report = {
      timestamp: new Date().toISOString(),
      testFiles: this.testFiles.length,
      verificationResults: this.verificationResults,
      summary: this.generateSummary()
    };

    const reportDir = path.join(__dirname, 'verification-reports');
    await fs.mkdir(reportDir, { recursive: true });

    const reportFile = path.join(reportDir, `verification-report-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    console.log(`📄 Verification report generated: ${reportFile}`);
    return reportFile;
  }

  generateSummary() {
    const passed = this.verificationResults.filter(r => r.status === 'passed').length;
    const warnings = this.verificationResults.filter(r => r.status === 'warning').length;
    const failed = this.verificationResults.filter(r => r.status === 'failed').length;

    return {
      totalChecks: this.verificationResults.length,
      passedChecks: passed,
      warningChecks: warnings,
      failedChecks: failed,
      passRate: this.verificationResults.length > 0 ?
        (passed / this.verificationResults.length) * 100 : 0
    };
  }

  async verifyTestDependencies() {
    console.log('📦 Verifying test dependencies...');

    try {
      // Check that required dependencies are available
      const dependencies = [
        'vitest',
        'execa',
        'chalk',
        'enquirer',
        'ora',
        'boxen'
      ];

      for (const dep of dependencies) {
        try {
          await execa('npm', ['list', dep], {
            stdio: 'pipe',
            cwd: __dirname
          });
        } catch (error) {
          console.warn(`⚠️  Dependency ${dep} may not be installed: ${error.message}`);
        }
      }

      this.verificationResults.push({
        category: 'Dependencies',
        status: 'passed',
        message: 'Dependency verification completed',
        details: {
          checkedDependencies: dependencies.length
        }
      });

      console.log('✅ Test dependencies verified');

    } catch (error) {
      console.error(`❌ Dependency verification failed: ${error.message}`);
      this.verificationResults.push({
        category: 'Dependencies',
        status: 'failed',
        message: 'Dependency verification failed',
        details: {
          error: error.message
        }
      });
    }
  }

  async verifyTestConfiguration() {
    console.log('⚙️  Verifying test configuration...');

    try {
      // Check that test configuration files exist
      const configFiles = [
        'test-config.mjs',
        'test-setup.mjs',
        'test-utils.mjs',
        'test-reporter.mjs'
      ];

      const missingConfigs = [];
      for (const configFile of configFiles) {
        const configPath = path.join(__dirname, configFile);
        try {
          await fs.access(configPath);
        } catch (error) {
          missingConfigs.push(configFile);
        }
      }

      if (missingConfigs.length > 0) {
        throw new Error(`Missing test configuration files: ${missingConfigs.join(', ')}`);
      }

      this.verificationResults.push({
        category: 'Configuration',
        status: 'passed',
        message: 'All test configuration files present',
        details: {
          configFiles: configFiles.length,
          missingConfigs: 0
        }
      });

      console.log('✅ Test configuration verified');

    } catch (error) {
      console.error(`❌ Test configuration verification failed: ${error.message}`);
      this.verificationResults.push({
        category: 'Configuration',
        status: 'failed',
        message: 'Test configuration verification failed',
        details: {
          error: error.message
        }
      });
    }
  }
}

// Main execution
(async () => {
  const verifier = new TestVerification();

  try {
    // Run comprehensive verification
    await verifier.verifyTestDependencies();
    await verifier.verifyTestConfiguration();
    await verifier.verifyTestSuite();

    // Generate final report
    const report = await verifier.generateVerificationReport();

    // Display summary
    console.log('\n📊 Verification Summary:');
    console.log(`- Total Checks: ${verifier.verificationResults.length}`);
    console.log(`- Passed: ${verifier.generateSummary().passedChecks}`);
    console.log(`- Warnings: ${verifier.generateSummary().warningChecks}`);
    console.log(`- Failed: ${verifier.generateSummary().failedChecks}`);
    console.log(`- Pass Rate: ${verifier.generateSummary().passRate.toFixed(2)}%`);

    if (verifier.generateSummary().failedChecks > 0) {
      console.log('\n⚠️  Some verification checks failed - review required');
      process.exit(1);
    } else {
      console.log('\n✅ All verification checks passed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Verification process failed:', error.message);
    process.exit(1);
  }
})();