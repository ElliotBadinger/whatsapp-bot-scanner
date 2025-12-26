import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class TestReporter {
  constructor() {
    this.testResults = [];
    this.startTime = new Date();
    this.passedTests = 0;
    this.failedTests = 0;
    this.skippedTests = 0;
    this.testDuration = 0;
  }

  /**
   * Add test result
   * @param {Object} result - Test result
   */
  addTestResult(result) {
    this.testResults.push(result);

    if (result.status === 'passed') {
      this.passedTests++;
    } else if (result.status === 'failed') {
      this.failedTests++;
    } else if (result.status === 'skipped') {
      this.skippedTests++;
    }
  }

  /**
   * Generate test report
   * @returns {Object} Test report
   */
  generateReport() {
    this.testDuration = new Date() - this.startTime;

    return {
      summary: {
        totalTests: this.testResults.length,
        passedTests: this.passedTests,
        failedTests: this.failedTests,
        skippedTests: this.skippedTests,
        passRate: this.testResults.length > 0 ? (this.passedTests / this.testResults.length) * 100 : 0,
        duration: this.testDuration,
        startTime: this.startTime,
        endTime: new Date()
      },
      results: this.testResults,
      coverage: this.calculateCoverage()
    };
  }

  /**
   * Calculate test coverage
   * @returns {Object} Coverage data
   */
  calculateCoverage() {
    // This would be populated by actual coverage data in a real implementation
    return {
      lines: { total: 0, covered: 0, percentage: 0 },
      functions: { total: 0, covered: 0, percentage: 0 },
      branches: { total: 0, covered: 0, percentage: 0 },
      statements: { total: 0, covered: 0, percentage: 0 }
    };
  }

  /**
   * Generate HTML report
   * @param {string} outputDir - Output directory
   * @returns {Promise<string>} Path to HTML report
   */
  async generateHTMLReport(outputDir = './test-reports') {
    const report = this.generateReport();
    const reportDir = path.join(__dirname, outputDir);
    const reportFile = path.join(reportDir, `test-report-${new Date().toISOString().split('T')[0]}.html`);

    // Create report directory if it doesn't exist
    await fs.mkdir(reportDir, { recursive: true });

    const htmlContent = this.generateHTMLContent(report);
    await fs.writeFile(reportFile, htmlContent);

    return reportFile;
  }

  /**
   * Generate HTML content for report
   * @param {Object} report - Test report
   * @returns {string} HTML content
   */
  generateHTMLContent(report) {
    const passRate = report.summary.passRate.toFixed(2);
    const passColor = passRate >= 80 ? 'green' : passRate >= 60 ? 'orange' : 'red';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .header {
      background-color: #f5f5f5;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }
    .summary-card {
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 15px;
      flex: 1;
      min-width: 200px;
    }
    .summary-card h3 {
      margin-top: 0;
      color: #666;
    }
    .summary-card p {
      font-size: 24px;
      font-weight: bold;
      margin: 5px 0 0;
    }
    .pass-rate {
      color: ${passColor};
      font-size: 28px;
    }
    .test-results {
      margin-top: 30px;
    }
    .test-result {
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 10px;
    }
    .test-result.passed {
      border-left: 4px solid #4CAF50;
    }
    .test-result.failed {
      border-left: 4px solid #F44336;
    }
    .test-result.skipped {
      border-left: 4px solid #FFC107;
    }
    .test-name {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .test-status {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .test-status.passed {
      background-color: #4CAF50;
      color: white;
    }
    .test-status.failed {
      background-color: #F44336;
      color: white;
    }
    .test-status.skipped {
      background-color: #FFC107;
      color: black;
    }
    .test-duration {
      color: #666;
      font-size: 12px;
    }
    .coverage {
      margin-top: 30px;
      background-color: #f5f5f5;
      padding: 20px;
      border-radius: 5px;
    }
    .coverage-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .coverage-item {
      background-color: white;
      padding: 10px;
      border-radius: 5px;
    }
    .coverage-item h4 {
      margin: 0 0 5px 0;
      color: #666;
    }
    .coverage-item p {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Test Report</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Total Tests</h3>
      <p>${report.summary.totalTests}</p>
    </div>
    <div class="summary-card">
      <h3>Passed</h3>
      <p>${report.summary.passedTests}</p>
    </div>
    <div class="summary-card">
      <h3>Failed</h3>
      <p>${report.summary.failedTests}</p>
    </div>
    <div class="summary-card">
      <h3>Skipped</h3>
      <p>${report.summary.skippedTests}</p>
    </div>
    <div class="summary-card">
      <h3>Pass Rate</h3>
      <p class="pass-rate">${passRate}%</p>
    </div>
    <div class="summary-card">
      <h3>Duration</h3>
      <p>${(report.summary.duration / 1000).toFixed(2)}s</p>
    </div>
  </div>

  <div class="test-results">
    <h2>Test Results</h2>
    ${report.results.map(result => `
      <div class="test-result ${result.status}">
        <div class="test-name">${result.name}</div>
        <div class="test-status ${result.status}">${result.status}</div>
        ${result.message ? `<div class="test-message">${result.message}</div>` : ''}
        <div class="test-duration">Duration: ${result.duration || 'N/A'}ms</div>
        ${result.error ? `<div class="test-error" style="color: #F44336; margin-top: 5px;">${result.error}</div>` : ''}
      </div>
    `).join('')}
  </div>

  <div class="coverage">
    <h2>Test Coverage</h2>
    <div class="coverage-grid">
      <div class="coverage-item">
        <h4>Lines</h4>
        <p>${report.coverage.lines.percentage.toFixed(2)}%</p>
        <p style="font-size: 12px; color: #666;">${report.coverage.lines.covered}/${report.coverage.lines.total}</p>
      </div>
      <div class="coverage-item">
        <h4>Functions</h4>
        <p>${report.coverage.functions.percentage.toFixed(2)}%</p>
        <p style="font-size: 12px; color: #666;">${report.coverage.functions.covered}/${report.coverage.functions.total}</p>
      </div>
      <div class="coverage-item">
        <h4>Branches</h4>
        <p>${report.coverage.branches.percentage.toFixed(2)}%</p>
        <p style="font-size: 12px; color: #666;">${report.coverage.branches.covered}/${report.coverage.branches.total}</p>
      </div>
      <div class="coverage-item">
        <h4>Statements</h4>
        <p>${report.coverage.statements.percentage.toFixed(2)}%</p>
        <p style="font-size: 12px; color: #666;">${report.coverage.statements.covered}/${report.coverage.statements.total}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate JSON report
   * @param {string} outputDir - Output directory
   * @returns {Promise<string>} Path to JSON report
   */
  async generateJSONReport(outputDir = './test-reports') {
    const report = this.generateReport();
    const reportDir = path.join(__dirname, outputDir);
    const reportFile = path.join(reportDir, `test-report-${new Date().toISOString().split('T')[0]}.json`);

    // Create report directory if it doesn't exist
    await fs.mkdir(reportDir, { recursive: true });

    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    return reportFile;
  }

  /**
   * Generate Markdown report
   * @param {string} outputDir - Output directory
   * @returns {Promise<string>} Path to Markdown report
   */
  async generateMarkdownReport(outputDir = './test-reports') {
    const report = this.generateReport();
    const reportDir = path.join(__dirname, outputDir);
    const reportFile = path.join(reportDir, `test-report-${new Date().toISOString().split('T')[0]}.md`);

    // Create report directory if it doesn't exist
    await fs.mkdir(reportDir, { recursive: true });

    const mdContent = this.generateMarkdownContent(report);
    await fs.writeFile(reportFile, mdContent);

    return reportFile;
  }

  /**
   * Generate Markdown content for report
   * @param {Object} report - Test report
   * @returns {string} Markdown content
   */
  generateMarkdownContent(report) {
    const passRate = report.summary.passRate.toFixed(2);

    let mdContent = `# Test Report - ${new Date().toLocaleDateString()}\n\n`;
    mdContent += `Generated on ${new Date().toLocaleString()}\n\n`;

    mdContent += `## Summary\n\n`;
    mdContent += `- **Total Tests**: ${report.summary.totalTests}\n`;
    mdContent += `- **Passed**: ${report.summary.passedTests}\n`;
    mdContent += `- **Failed**: ${report.summary.failedTests}\n`;
    mdContent += `- **Skipped**: ${report.summary.skippedTests}\n`;
    mdContent += `- **Pass Rate**: ${passRate}%\n`;
    mdContent += `- **Duration**: ${(report.summary.duration / 1000).toFixed(2)} seconds\n\n`;

    mdContent += `## Test Results\n\n`;
    mdContent += `| Test Name | Status | Duration | Message |\n`;
    mdContent += `|-----------|--------|----------|---------|\n`;

    report.results.forEach(result => {
      mdContent += `| ${result.name} | ${result.status} | ${result.duration || 'N/A'}ms | ${result.message || ''} |\n`;
      if (result.error) {
        mdContent += `| | | | \`${result.error}\` |\n`;
      }
    });

    mdContent += `\n## Coverage\n\n`;
    mdContent += `- **Lines**: ${report.coverage.lines.percentage.toFixed(2)}% (${report.coverage.lines.covered}/${report.coverage.lines.total})\n`;
    mdContent += `- **Functions**: ${report.coverage.functions.percentage.toFixed(2)}% (${report.coverage.functions.covered}/${report.coverage.functions.total})\n`;
    mdContent += `- **Branches**: ${report.coverage.branches.percentage.toFixed(2)}% (${report.coverage.branches.covered}/${report.coverage.branches.total})\n`;
    mdContent += `- **Statements**: ${report.coverage.statements.percentage.toFixed(2)}% (${report.coverage.statements.covered}/${report.coverage.statements.total})\n`;

    return mdContent;
  }

  /**
   * Generate console report
   */
  generateConsoleReport() {
    const report = this.generateReport();
    const passRate = report.summary.passRate.toFixed(2);

    console.log('='.repeat(60));
    console.log('TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Generated on: ${new Date().toLocaleString()}`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Skipped: ${report.summary.skippedTests}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration: ${(report.summary.duration / 1000).toFixed(2)} seconds`);
    console.log('='.repeat(60));

    if (report.summary.failedTests > 0) {
      console.log('FAILED TESTS:');
      report.results
        .filter(result => result.status === 'failed')
        .forEach(result => {
          console.log(`- ${result.name}: ${result.message}`);
          if (result.error) {
            console.log(`  Error: ${result.error}`);
          }
        });
    }

    console.log('='.repeat(60));
  }
}

// Export reporter instance
export const testReporter = new TestReporter();