#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const DEEPSOURCE_PATH = path.join(
  __dirname,
  "../docs/security-reports/deepsource-latest.json",
);
const SONARQUBE_PATH = path.join(
  __dirname,
  "../docs/security-reports/sonarqube-latest.json",
);
const OUTPUT_PATH = path.join(
  __dirname,
  "../docs/security-reports/COMPREHENSIVE_SECURITY_TICKETS.md",
);

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

function formatDeepSourceIssues(report) {
  if (!report || !report.issues) return [];

  return report.issues.map((issue) => {
    return {
      source: "DeepSource",
      severity: issue.severity, // CRITICAL, MAJOR, MINOR
      title: issue.title,
      ruleId: issue.shortcode,
      description: issue.description,
      recommendation: issue.title, // DeepSource titles are often recommendations
      locations: issue.occurrences.map((occ) => ({
        file: occ.path,
        line: occ.beginLine,
        message: occ.title,
      })),
      autofix: issue.autofixAvailable,
      type: issue.category, // Map category to type (e.g. BUG_RISK, PERFORMANCE)
    };
  });
}

function formatSonarQubeIssues(report) {
  if (!report) return [];

  const issues = [];

  // Vulnerabilities
  if (report.vulnerabilities) {
    report.vulnerabilities.forEach((vuln) => {
      // Clean component path (remove project key prefix if present)
      const filePath = vuln.component.split(":").pop();

      issues.push({
        source: "SonarQube",
        severity: vuln.severity, // CRITICAL, HIGH, MEDIUM, LOW
        title: vuln.message,
        ruleId: vuln.rule,
        description: vuln.message,
        recommendation: "See SonarQube rule documentation",
        locations: [
          {
            file: filePath,
            line: vuln.line,
            message: vuln.message,
          },
        ],
        type: "Vulnerability",
      });
    });
  }

  // Security Hotspots
  if (report.securityHotspots) {
    report.securityHotspots.forEach((hotspot) => {
      const filePath = hotspot.component.split(":").pop();

      issues.push({
        source: "SonarQube",
        severity: hotspot.vulnerabilityProbability, // HIGH, MEDIUM, LOW
        title: hotspot.message,
        ruleId: hotspot.ruleKey,
        description: hotspot.message,
        recommendation: "Review security hotspot",
        locations: [
          {
            file: filePath,
            line: hotspot.line,
            message: hotspot.message,
          },
        ],
        type: "Security Hotspot",
      });
    });
  }

  // Bugs
  if (report.bugs) {
    report.bugs.forEach((bug) => {
      const filePath = bug.component.split(":").pop();
      issues.push({
        source: "SonarQube",
        severity: bug.severity,
        title: bug.message,
        ruleId: bug.rule,
        description: bug.message,
        recommendation: "Fix bug",
        locations: [
          {
            file: filePath,
            line: bug.line,
            message: bug.message,
          },
        ],
        type: "Bug",
      });
    });
  }

  // Code Smells
  if (report.codeSmells) {
    report.codeSmells.forEach((smell) => {
      const filePath = smell.component.split(":").pop();
      issues.push({
        source: "SonarQube",
        severity: smell.severity,
        title: smell.message,
        ruleId: smell.rule,
        description: smell.message,
        recommendation: "Refactor code smell",
        locations: [
          {
            file: filePath,
            line: smell.line,
            message: smell.message,
          },
        ],
        type: "Code Smell",
      });
    });
  }

  return issues;
}

function generateMarkdown(allIssues) {
  const timestamp = new Date().toISOString();

  // Calculate statistics
  const totalRules = allIssues.length;
  const totalOccurrences = allIssues.reduce(
    (sum, issue) => sum + issue.locations.length,
    0,
  );

  const bySource = {};
  const byCategory = {};
  const bySeverity = {};

  allIssues.forEach((issue) => {
    // Source
    if (!bySource[issue.source]) bySource[issue.source] = 0;
    bySource[issue.source] += issue.locations.length;

    // Category
    const cat = issue.type || "Other";
    if (!byCategory[cat]) byCategory[cat] = 0;
    byCategory[cat] += issue.locations.length;

    // Severity
    const sev = issue.severity ? issue.severity.toUpperCase() : "UNKNOWN";
    if (!bySeverity[sev]) bySeverity[sev] = 0;
    bySeverity[sev] += issue.locations.length;
  });

  let md = `# Comprehensive Security Tickets Document\n\n`;
  md += `**Generated:** ${timestamp}\n`;
  md += `**Total Findings:** ${totalOccurrences} (across ${totalRules} rules)\n\n`;
  md += `This document aggregates all findings from DeepSource and SonarQube, organized by severity.\n\n`;

  md += `## 📊 Executive Summary\n\n`;

  md += `### By Source\n`;
  md += `| Source | Findings |\n`;
  md += `|--------|----------|\n`;
  Object.keys(bySource).forEach((src) => {
    md += `| ${src} | ${bySource[src]} |\n`;
  });
  md += `\n`;

  md += `### By Severity\n`;
  md += `| Severity | Findings |\n`;
  md += `|----------|----------|\n`;
  Object.keys(bySeverity)
    .sort()
    .forEach((sev) => {
      md += `| ${sev} | ${bySeverity[sev]} |\n`;
    });
  md += `\n`;

  md += `### By Category\n`;
  md += `| Category | Findings |\n`;
  md += `|----------|----------|\n`;
  Object.keys(byCategory)
    .sort()
    .forEach((cat) => {
      md += `| ${cat} | ${byCategory[cat]} |\n`;
    });
  md += `\n`;

  md += `---\n\n`;

  // Group by Severity
  const severityOrder = [
    "BLOCKER",
    "CRITICAL",
    "HIGH",
    "MAJOR",
    "MEDIUM",
    "MINOR",
    "LOW",
    "INFO",
  ];

  // Helper to normalize severity
  const normalizeSeverity = (s) => {
    return s.toUpperCase();
  };

  const grouped = allIssues.reduce((acc, issue) => {
    const sev = normalizeSeverity(issue.severity);
    if (!acc[sev]) acc[sev] = [];
    acc[sev].push(issue);
    return acc;
  }, {});

  const MAX_LOCATIONS_BEFORE_GROUPING = 15;

  severityOrder.forEach((sev) => {
    if (grouped[sev] && grouped[sev].length > 0) {
      md += `## ${sev} Priority Issues (${grouped[sev].length})\n\n`;

      // Group by Rule ID to consolidate same issues across multiple files
      const byRule = grouped[sev].reduce((acc, issue) => {
        const key = `${issue.source}:${issue.ruleId}`;
        if (!acc[key]) {
          acc[key] = {
            ...issue,
            locations: [...issue.locations],
          };
        } else {
          acc[key].locations.push(...issue.locations);
        }
        return acc;
      }, {});

      Object.values(byRule).forEach((issue, index) => {
        md += `### [${issue.source}] ${issue.title} (${issue.ruleId})\n\n`;
        md += `**Category:** ${issue.type || "Issue"}\n`;
        md += `**Description:**\n${issue.description}\n\n`;
        if (issue.autofix) {
          md += `**Autofix Available:** Yes\n\n`;
        }

        const totalLocs = issue.locations.length;
        md += `**Total Locations:** ${totalLocs}\n\n`;

        if (totalLocs > MAX_LOCATIONS_BEFORE_GROUPING) {
          // Group by directory
          const byDir = issue.locations.reduce((acc, loc) => {
            const dir = path.dirname(loc.file);
            if (!acc[dir]) acc[dir] = [];
            acc[dir].push(loc);
            return acc;
          }, {});

          md += `**Breakdown by Directory:**\n\n`;
          Object.keys(byDir)
            .sort()
            .forEach((dir) => {
              md += `#### 📂 ${dir} (${byDir[dir].length})\n`;
              byDir[dir].forEach((loc) => {
                md += `- [ ] \`${loc.file}:${loc.line}\` - ${loc.message}\n`;
              });
              md += `\n`;
            });
        } else {
          md += `**Locations:**\n`;
          issue.locations.forEach((loc) => {
            md += `- [ ] \`${loc.file}:${loc.line}\` - ${loc.message}\n`;
          });
        }
        md += `\n---\n\n`;
      });
    }
  });

  return md;
}

function main() {
  console.log("Loading reports...");
  const deepSourceReport = loadJson(DEEPSOURCE_PATH);
  const sonarQubeReport = loadJson(SONARQUBE_PATH);

  console.log("Processing issues...");
  const dsIssues = formatDeepSourceIssues(deepSourceReport);
  const sqIssues = formatSonarQubeIssues(sonarQubeReport);

  const allIssues = [...dsIssues, ...sqIssues];

  console.log(
    `Found ${dsIssues.length} DeepSource issues and ${sqIssues.length} SonarQube issues.`,
  );

  const markdown = generateMarkdown(allIssues);

  fs.writeFileSync(OUTPUT_PATH, markdown);
  console.log(`Report written to ${OUTPUT_PATH}`);
}

main();
