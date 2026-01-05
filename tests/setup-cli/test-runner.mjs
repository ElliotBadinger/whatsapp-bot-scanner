#!/usr/bin/env node

import * as execa from "execa";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { testReporter } from "./test-reporter.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TestRunner {
  constructor() {
    this.testReporter = testReporter;
    this.startTime = new Date();
  }

  async runTests() {
    try {
      console.log("🚀 Starting comprehensive test suite...");

      // Run all test files
      const testFiles = await this.findTestFiles();
      console.log(`📋 Found ${testFiles.length} test files`);

      // Run tests with Vitest
      const result = await this.runVitestTests(testFiles);

      // Generate reports
      await this.generateReports();

      console.log("✅ Test suite completed successfully!");
      return result;
    } catch (error) {
      console.error("❌ Test suite failed:", error.message);
      await this.generateReports();
      process.exit(1);
    }
  }

  async findTestFiles() {
    const testDir = path.join(__dirname, "..", "setup-cli");
    const files = await fs.readdir(testDir);

    return files
      .filter((file) => file.endsWith(".test.mjs"))
      .map((file) => path.join(testDir, file));
  }

  async runVitestTests(testFiles) {
    console.log("🧪 Running tests with Vitest...");

    try {
      const result = await execa.execa(
        "npx",
        [
          "vitest",
          "run",
          ...testFiles,
          "--config",
          path.join(__dirname, "test-config.mjs"),
          "--reporter=verbose",
          "--coverage",
        ],
        {
          stdio: "inherit",
          cwd: __dirname,
        },
      );

      return result;
    } catch (error) {
      console.error("❌ Vitest execution failed:", error.message);
      throw error;
    }
  }

  async generateReports() {
    console.log("📊 Generating test reports...");

    // Generate HTML report
    const htmlReport = await this.testReporter.generateHTMLReport();
    console.log(`📄 HTML report generated: ${htmlReport}`);

    // Generate JSON report
    const jsonReport = await this.testReporter.generateJSONReport();
    console.log(`📄 JSON report generated: ${jsonReport}`);

    // Generate Markdown report
    const mdReport = await this.testReporter.generateMarkdownReport();
    console.log(`📄 Markdown report generated: ${mdReport}`);

    // Generate console report
    this.testReporter.generateConsoleReport();
  }

  async runSpecificTests(testPatterns) {
    console.log(`🎯 Running specific tests: ${testPatterns.join(", ")}`);

    try {
      const result = await execa.execa(
        "npx",
        [
          "vitest",
          "run",
          ...testPatterns,
          "--config",
          path.join(__dirname, "test-config.mjs"),
          "--reporter=verbose",
        ],
        {
          stdio: "inherit",
          cwd: __dirname,
        },
      );

      return result;
    } catch (error) {
      console.error("❌ Specific test execution failed:", error.message);
      throw error;
    }
  }

  async runWatchMode() {
    console.log("👀 Running tests in watch mode...");

    try {
      const result = await execa.execa(
        "npx",
        [
          "vitest",
          "watch",
          "--config",
          path.join(__dirname, "test-config.mjs"),
          "--reporter=verbose",
        ],
        {
          stdio: "inherit",
          cwd: __dirname,
        },
      );

      return result;
    } catch (error) {
      console.error("❌ Watch mode failed:", error.message);
      throw error;
    }
  }

  async runCoverageAnalysis() {
    console.log("🔍 Running coverage analysis...");

    try {
      const result = await execa.execa(
        "npx",
        [
          "vitest",
          "run",
          "--coverage",
          "--config",
          path.join(__dirname, "test-config.mjs"),
          "--reporter=verbose",
        ],
        {
          stdio: "inherit",
          cwd: __dirname,
        },
      );

      return result;
    } catch (error) {
      console.error("❌ Coverage analysis failed:", error.message);
      throw error;
    }
  }

  async analyzeTestResults() {
    console.log("📈 Analyzing test results...");

    const report = this.testReporter.generateReport();

    if (report.summary.passRate < 80) {
      console.warn(
        "⚠️  Test pass rate below 80% - consider improving test coverage",
      );
    }

    if (report.summary.failedTests > 0) {
      console.warn(
        `⚠️  ${report.summary.failedTests} tests failed - review required`,
      );
    }

    return report;
  }
}

// Main execution
(async () => {
  const runner = new TestRunner();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const helpRequested = args.includes("--help") || args.includes("-h");
  const watchMode = args.includes("--watch") || args.includes("-w");
  const coverageOnly = args.includes("--coverage-only");
  const specificTests = args.filter((arg) => !arg.startsWith("--"));

  if (helpRequested) {
    console.log(`
🚀 Comprehensive Test Suite Runner

Usage:
  node test-runner.mjs [options] [test-patterns]

Options:
  --help, -h          Show this help message
  --watch, -w         Run tests in watch mode
  --coverage-only     Run only coverage analysis
  [test-patterns]     Specific test files or patterns to run

Examples:
  node test-runner.mjs
  node test-runner.mjs --watch
  node test-runner.mjs test-core-components.test.mjs
  node test-runner.mjs --coverage-only
    `);
    process.exit(0);
  }

  try {
    if (coverageOnly) {
      await runner.runCoverageAnalysis();
    } else if (watchMode) {
      await runner.runWatchMode();
    } else if (specificTests.length > 0) {
      await runner.runSpecificTests(specificTests);
    } else {
      await runner.runTests();
    }

    // Analyze results
    const analysis = await runner.analyzeTestResults();
    console.log("📊 Test analysis complete:", analysis.summary);
  } catch (error) {
    console.error("❌ Test runner failed:", error.message);
    process.exit(1);
  }
})();
