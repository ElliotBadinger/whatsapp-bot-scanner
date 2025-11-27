#!/usr/bin/env node

/**
 * DeepSource API Client
 *
 * Programmatic access to DeepSource GraphQL API for the WhatsApp Bot Scanner project.
 *
 * Usage:
 *   node scripts/deepsource-api.js status
 *   node scripts/deepsource-api.js issues
 *   node scripts/deepsource-api.js metrics
 *   node scripts/deepsource-api.js trigger
 *
 * Environment Variables:
 *   DEEPSOURCE_API_TOKEN - Personal Access Token from DeepSource dashboard
 *   DEEPSOURCE_REPO_OWNER - Repository owner (default: ElliotBadinger)
 *   DEEPSOURCE_REPO_NAME - Repository name (default: whatsapp-bot-scanner)
 */

const https = require("https");

const API_ENDPOINT = "https://api.deepsource.io/graphql/";
const API_TOKEN = process.env.DEEPSOURCE_API_TOKEN;
const REPO_OWNER = process.env.DEEPSOURCE_REPO_OWNER || "ElliotBadinger";
const REPO_NAME = process.env.DEEPSOURCE_REPO_NAME || "whatsapp-bot-scanner";

/**
 * Make a GraphQL request to DeepSource API
 */
async function graphqlRequest(query, variables = {}) {
  if (!API_TOKEN) {
    throw new Error("DEEPSOURCE_API_TOKEN environment variable is required");
  }

  const data = JSON.stringify({
    query,
    variables,
  });

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Length": data.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(API_ENDPOINT, options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(
              new Error(
                `GraphQL Error: ${JSON.stringify(response.errors, null, 2)}`,
              ),
            );
          } else {
            resolve(response.data);
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Get current user information
 */
async function getViewer() {
  const query = `
    query {
      viewer {
        email
        login
        name
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Get repository analysis status
 */
async function getRepositoryStatus() {
  const query = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        name
        isActivated
        defaultBranch
        analyzers {
          name
          enabled
        }
        metrics {
          issuesCount
          antipatternCount
          bugRiskCount
          securityCount
          performanceCount
          styleCount
          documentationCount
        }
      }
    }
  `;

  return graphqlRequest(query, {
    owner: REPO_OWNER,
    name: REPO_NAME,
  });
}

/**
 * Get repository issues
 */
async function getRepositoryIssues(limit = 20) {
  const query = `
    query($owner: String!, $name: String!, $limit: Int!) {
      repository(owner: $owner, name: $name) {
        name
        issues(first: $limit) {
          edges {
            node {
              title
              category
              severity
              analyzer {
                name
              }
              occurrences {
                totalCount
              }
            }
          }
        }
      }
    }
  `;

  return graphqlRequest(query, {
    owner: REPO_OWNER,
    name: REPO_NAME,
    limit,
  });
}

/**
 * Get repository metrics
 */
async function getRepositoryMetrics() {
  const query = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        name
        metrics {
          issuesCount
          antipatternCount
          bugRiskCount
          securityCount
          performanceCount
          styleCount
          documentationCount
          coverage
          testCoverage
        }
        analyzers {
          name
          enabled
        }
      }
    }
  `;

  return graphqlRequest(query, {
    owner: REPO_OWNER,
    name: REPO_NAME,
  });
}

/**
 * Format and display repository status
 */
function displayStatus(data) {
  const repo = data.repository;

  console.log("\n📊 DeepSource Repository Status\n");
  console.log(`Repository: ${repo.name}`);
  console.log(`Activated: ${repo.isActivated ? "✅" : "❌"}`);
  console.log(`Default Branch: ${repo.defaultBranch || "N/A"}`);

  console.log("\n🔍 Analyzers:");
  repo.analyzers.forEach((analyzer) => {
    console.log(`  ${analyzer.enabled ? "✅" : "❌"} ${analyzer.name}`);
  });

  if (repo.metrics) {
    console.log("\n📈 Metrics:");
    console.log(`  Total Issues: ${repo.metrics.issuesCount || 0}`);
    console.log(`  Anti-patterns: ${repo.metrics.antipatternCount || 0}`);
    console.log(`  Bug Risks: ${repo.metrics.bugRiskCount || 0}`);
    console.log(`  Security: ${repo.metrics.securityCount || 0}`);
    console.log(`  Performance: ${repo.metrics.performanceCount || 0}`);
    console.log(`  Style: ${repo.metrics.styleCount || 0}`);
    console.log(`  Documentation: ${repo.metrics.documentationCount || 0}`);
  }
  console.log("");
}

/**
 * Format and display repository issues
 */
function displayIssues(data) {
  const repo = data.repository;
  const issues = repo.issues.edges;

  console.log("\n🐛 DeepSource Issues\n");
  console.log(`Repository: ${repo.name}`);
  console.log(`Total Issues: ${issues.length}\n`);

  issues.forEach((edge, index) => {
    const issue = edge.node;
    const severityIcon =
      issue.severity === "CRITICAL"
        ? "🔴"
        : issue.severity === "MAJOR"
          ? "🟠"
          : "🟡";

    console.log(`${index + 1}. ${severityIcon} ${issue.title}`);
    console.log(`   Category: ${issue.category}`);
    console.log(`   Analyzer: ${issue.analyzer.name}`);
    console.log(`   Occurrences: ${issue.occurrences.totalCount}`);
    console.log("");
  });
}

/**
 * Format and display repository metrics
 */
function displayMetrics(data) {
  const repo = data.repository;

  console.log("\n📊 DeepSource Metrics\n");
  console.log(`Repository: ${repo.name}\n`);

  console.log("Issue Breakdown:");
  console.log(`  Total Issues: ${repo.metrics.issuesCount || 0}`);
  console.log(`  Anti-patterns: ${repo.metrics.antipatternCount || 0}`);
  console.log(`  Bug Risks: ${repo.metrics.bugRiskCount || 0}`);
  console.log(`  Security: ${repo.metrics.securityCount || 0}`);
  console.log(`  Performance: ${repo.metrics.performanceCount || 0}`);
  console.log(`  Style: ${repo.metrics.styleCount || 0}`);
  console.log(`  Documentation: ${repo.metrics.documentationCount || 0}`);

  if (repo.metrics.coverage !== null && repo.metrics.coverage !== undefined) {
    console.log(`\nCode Coverage: ${repo.metrics.coverage}%`);
  }

  console.log("\nActive Analyzers:");
  repo.analyzers.forEach((analyzer) => {
    if (analyzer.enabled) {
      console.log(`  ✅ ${analyzer.name}`);
    }
  });
  console.log("");
}

/**
 * Main CLI handler
 */
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case "status":
        const statusData = await getRepositoryStatus();
        displayStatus(statusData);
        break;

      case "issues":
        const issuesData = await getRepositoryIssues(20);
        displayIssues(issuesData);
        break;

      case "metrics":
        const metricsData = await getRepositoryMetrics();
        displayMetrics(metricsData);
        break;

      case "viewer":
        const viewerData = await getViewer();
        console.log("\n👤 Current User:");
        console.log(`  Name: ${viewerData.viewer.name || "N/A"}`);
        console.log(`  Email: ${viewerData.viewer.email}`);
        console.log(`  Login: ${viewerData.viewer.login}\n`);
        break;

      default:
        console.log("\n🔧 DeepSource API Client\n");
        console.log("Usage: node scripts/deepsource-api.js <command>\n");
        console.log("Commands:");
        console.log("  status   - Show repository analysis status");
        console.log("  issues   - List current issues");
        console.log("  metrics  - Show detailed metrics");
        console.log("  viewer   - Show current user information\n");
        console.log("Environment Variables:");
        console.log("  DEEPSOURCE_API_TOKEN - Required: Personal Access Token");
        console.log(
          "  DEEPSOURCE_REPO_OWNER - Optional: Repository owner (default: ElliotBadinger)",
        );
        console.log(
          "  DEEPSOURCE_REPO_NAME - Optional: Repository name (default: whatsapp-bot-scanner)\n",
        );
        process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  graphqlRequest,
  getViewer,
  getRepositoryStatus,
  getRepositoryIssues,
  getRepositoryMetrics,
};
