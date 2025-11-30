/**
 * Security Reports Fetcher
 *
 * Comprehensive script to fetch security reports from both DeepSource and SonarQube
 * and store them in the docs/security-reports directory.
 *
 * Usage:
 *   node scripts/fetch-security-reports.js
 *
 * Environment Variables:
 *   DEEPSOURCE_API_TOKEN - Personal Access Token from DeepSource dashboard
 *   DEEPSOURCE_REPO_OWNER - Repository owner (default: ElliotBadinger)
 *   DEEPSOURCE_REPO_NAME - Repository name (default: whatsapp-bot-scanner)
 *   SONARQUBE_TOKEN - SonarQube access token (optional)
 *   SONARQUBE_URL - SonarQube server URL (default: https://sonarcloud.io)
 *   SONARQUBE_PROJECT_KEY - SonarQube project key (optional)
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Configuration
const DEEPSOURCE_API_ENDPOINT = "https://api.deepsource.io/graphql/";
// Get your API token from: https://app.deepsource.com/settings/tokens
const DEEPSOURCE_API_TOKEN = process.env.DEEPSOURCE_API_TOKEN;
const DEEPSOURCE_REPO_OWNER =
  process.env.DEEPSOURCE_REPO_OWNER || "ElliotBadinger";
const DEEPSOURCE_REPO_NAME =
  process.env.DEEPSOURCE_REPO_NAME || "whatsapp-bot-scanner";

const SONARQUBE_TOKEN = process.env.SONARQUBE_TOKEN;
const SONARQUBE_URL = process.env.SONARQUBE_URL || "https://sonarcloud.io";
const SONARQUBE_PROJECT_KEY = process.env.SONARQUBE_PROJECT_KEY;

const OUTPUT_DIR = path.join(__dirname, "..", "docs", "security-reports");
const TIMESTAMP = new Date().toISOString().replace(/:/g, "-").split(".")[0];

/**
 * Make a GraphQL request to DeepSource API
 */
async function deepsourceGraphqlRequest(query, variables = {}) {
  if (!DEEPSOURCE_API_TOKEN) {
    throw new Error("DEEPSOURCE_API_TOKEN is required");
  }

  const data = JSON.stringify({
    query,
    variables,
  });

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSOURCE_API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Length": data.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(DEEPSOURCE_API_ENDPOINT, options, (res) => {
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
                `DeepSource GraphQL Error: ${JSON.stringify(response.errors, null, 2)}`,
              ),
            );
          } else {
            resolve(response.data);
          }
        } catch (error) {
          reject(
            new Error(`Failed to parse DeepSource response: ${error.message}`),
          );
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
 * Make a REST API request to SonarQube
 */
async function sonarqubeRestRequest(endpoint) {
  if (!SONARQUBE_TOKEN) {
    console.log("⚠️  SONARQUBE_TOKEN not set, skipping SonarQube reports");
    return null;
  }

  if (!SONARQUBE_PROJECT_KEY) {
    console.log(
      "⚠️  SONARQUBE_PROJECT_KEY not set, skipping SonarQube reports",
    );
    return null;
  }

  const url = new URL(endpoint, SONARQUBE_URL);
  const protocol = url.protocol === "https:" ? https : http;

  const options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${SONARQUBE_TOKEN}`,
      Accept: "application/json",
    },
  };

  return new Promise((resolve, reject) => {
    const req = protocol.request(url, options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(
              new Error(
                `SonarQube API Error (${res.statusCode}): ${JSON.stringify(response)}`,
              ),
            );
          } else {
            resolve(response);
          }
        } catch (error) {
          reject(
            new Error(`Failed to parse SonarQube response: ${error.message}`),
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Fetch comprehensive security data from DeepSource
 */
async function fetchDeepSourceSecurityReports() {
  console.log("\n🔍 Fetching DeepSource Security Reports...\n");

  const reports = {
    metadata: {
      timestamp: new Date().toISOString(),
      source: "DeepSource",
      repository: `${DEEPSOURCE_REPO_OWNER}/${DEEPSOURCE_REPO_NAME}`,
    },
    repository: null,
    issues: [],
    securityIssues: [],
    analysisRuns: [],
    metrics: null,
  };

  try {
    // 1. Get repository details
    const repoQuery = `
            query($owner: String!, $name: String!) {
                repository(login: $owner, name: $name, vcsProvider: GITHUB) {
                    name
                    isActivated
                    defaultBranch
                    dsn
                    enabledAnalyzers {
                        edges {
                            node {
                                name
                                shortcode
                            }
                        }
                    }
                    targets {
                        edges {
                            node {
                                id
                                manifestPath
                                lockfilePath
                                ecosystem
                                isActivated
                            }
                        }
                    }
                    configJson
                }
            }
        `;

    const repoData = await deepsourceGraphqlRequest(repoQuery, {
      owner: DEEPSOURCE_REPO_OWNER,
      name: DEEPSOURCE_REPO_NAME,
    });

    reports.repository = repoData.repository;
    console.log(`✅ Repository: ${repoData.repository.name}`);
    console.log(
      `   Activated: ${repoData.repository.isActivated ? "Yes" : "No"}`,
    );

    // 2. Get ALL issues with pagination (DeepSource has 1.2k+ occurrences)
    console.log("   Fetching all issues with ALL occurrences...");
    let allIssues = [];
    let hasNextPage = true;
    let cursor = null;
    let pageCount = 0;

    while (hasNextPage) {
      pageCount++;
      const issuesQuery = `
                query($owner: String!, $name: String!, $cursor: String) {
                    repository(login: $owner, name: $name, vcsProvider: GITHUB) {
                        issues(first: 100, after: $cursor) {
                            edges {
                                node {
                                    id
                                    issue {
                                        shortcode
                                        title
                                        category
                                        severity
                                        description
                                        shortDescription
                                        tags
                                        autofixAvailable
                                    }
                                    occurrences(first: 100) {
                                        totalCount
                                        edges {
                                            node {
                                                path
                                                beginLine
                                                endLine
                                                beginColumn
                                                endColumn
                                                title
                                            }
                                        }
                                        pageInfo {
                                            hasNextPage
                                            endCursor
                                        }
                                    }
                                }
                            }
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                            totalCount
                        }
                    }
                }
            `;

      const issuesData = await deepsourceGraphqlRequest(issuesQuery, {
        owner: DEEPSOURCE_REPO_OWNER,
        name: DEEPSOURCE_REPO_NAME,
        cursor: cursor,
      });

      for (const edge of issuesData.repository.issues.edges) {
        const node = edge.node;

        // Fetch ALL occurrences for this issue if there are more than 100
        let allOccurrences = node.occurrences.edges.map((occ) => ({
          path: occ.node.path,
          beginLine: occ.node.beginLine,
          endLine: occ.node.endLine,
          beginColumn: occ.node.beginColumn,
          endColumn: occ.node.endColumn,
          title: occ.node.title,
        }));

        // If there are more occurrences, paginate through them
        let occCursor = node.occurrences.pageInfo.endCursor;
        let hasMoreOccurrences = node.occurrences.pageInfo.hasNextPage;

        while (hasMoreOccurrences) {
          const moreOccQuery = `
                        query($issueId: ID!, $occCursor: String) {
                            node(id: $issueId) {
                                ... on RepositoryIssue {
                                    occurrences(first: 100, after: $occCursor) {
                                        edges {
                                            node {
                                                path
                                                beginLine
                                                endLine
                                                beginColumn
                                                endColumn
                                                title
                                            }
                                        }
                                        pageInfo {
                                            hasNextPage
                                            endCursor
                                        }
                                    }
                                }
                            }
                        }
                    `;

          const moreOccData = await deepsourceGraphqlRequest(moreOccQuery, {
            issueId: node.id,
            occCursor: occCursor,
          });

          const moreOccs = moreOccData.node.occurrences.edges.map((occ) => ({
            path: occ.node.path,
            beginLine: occ.node.beginLine,
            endLine: occ.node.endLine,
            beginColumn: occ.node.beginColumn,
            endColumn: occ.node.endColumn,
            title: occ.node.title,
          }));

          allOccurrences = allOccurrences.concat(moreOccs);
          hasMoreOccurrences =
            moreOccData.node.occurrences.pageInfo.hasNextPage;
          occCursor = moreOccData.node.occurrences.pageInfo.endCursor;
        }

        const issue = {
          id: node.id,
          shortcode: node.issue.shortcode,
          title: node.issue.title,
          category: node.issue.category,
          severity: node.issue.severity,
          description: node.issue.description,
          shortDescription: node.issue.shortDescription,
          tags: node.issue.tags,
          autofixAvailable: node.issue.autofixAvailable,
          occurrenceCount: node.occurrences.totalCount,
          occurrences: allOccurrences,
        };

        allIssues.push(issue);
      }

      hasNextPage = issuesData.repository.issues.pageInfo.hasNextPage;
      cursor = issuesData.repository.issues.pageInfo.endCursor;

      console.log(
        `   Page ${pageCount}: fetched ${issuesData.repository.issues.edges.length} issue types (total: ${allIssues.length} issues, ${allIssues.reduce((sum, i) => sum + i.occurrences.length, 0)} occurrences)`,
      );
    }

    reports.issues = allIssues;

    // Filter security-specific issues
    reports.securityIssues = reports.issues.filter(
      (issue) =>
        issue.category === "SECURITY" ||
        issue.category === "ANTIPATTERN" ||
        issue.severity === "CRITICAL",
    );

    console.log(`✅ Found ${reports.issues.length} total issues`);
    console.log(`   Security-related: ${reports.securityIssues.length}`);

    // 3. Get recent analysis runs
    const runsQuery = `
            query($owner: String!, $name: String!) {
                repository(login: $owner, name: $name, vcsProvider: GITHUB) {
                    analysisRuns(first: 20) {
                        edges {
                            node {
                                runUid
                                status
                                createdAt
                                commitOid
                                summary {
                                    occurrencesIntroduced
                                    occurrencesResolved
                                    occurrencesSuppressed
                                }
                            }
                        }
                    }
                }
            }
        `;

    const runsData = await deepsourceGraphqlRequest(runsQuery, {
      owner: DEEPSOURCE_REPO_OWNER,
      name: DEEPSOURCE_REPO_NAME,
    });

    reports.analysisRuns = runsData.repository.analysisRuns.edges.map(
      (edge) => edge.node,
    );
    console.log(`✅ Found ${reports.analysisRuns.length} analysis runs`);

    // 4. Get metrics
    const metricsQuery = `
            query($owner: String!, $name: String!) {
                repository(login: $owner, name: $name, vcsProvider: GITHUB) {
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

    const metricsData = await deepsourceGraphqlRequest(metricsQuery, {
      owner: DEEPSOURCE_REPO_OWNER,
      name: DEEPSOURCE_REPO_NAME,
    });

    reports.metrics = metricsData.repository.metrics;
    console.log(`✅ Security Issues: ${reports.metrics?.securityCount || 0}`);
    console.log(`✅ Bug Risks: ${reports.metrics?.bugRiskCount || 0}`);
  } catch (error) {
    console.error(`❌ DeepSource Error: ${error.message}`);
    reports.error = error.message;
  }

  return reports;
}

/**
 * Fetch comprehensive security data from SonarQube
 */
async function fetchSonarQubeSecurityReports() {
  console.log("\n🔍 Fetching SonarQube Security Reports...\n");

  if (!SONARQUBE_TOKEN || !SONARQUBE_PROJECT_KEY) {
    console.log("⚠️  SonarQube credentials not configured, skipping...\n");
    return null;
  }

  const reports = {
    metadata: {
      timestamp: new Date().toISOString(),
      source: "SonarQube",
      projectKey: SONARQUBE_PROJECT_KEY,
      serverUrl: SONARQUBE_URL,
    },
    project: null,
    vulnerabilities: [],
    securityHotspots: [],
    bugs: [],
    codeSmells: [],
    measures: null,
  };

  try {
    // 1. Get project information
    const projectEndpoint = `/api/components/show?component=${SONARQUBE_PROJECT_KEY}`;
    reports.project = await sonarqubeRestRequest(projectEndpoint);
    console.log(
      `✅ Project: ${reports.project?.component?.name || SONARQUBE_PROJECT_KEY}`,
    );

    // 2. Get ALL vulnerabilities with pagination
    console.log("   Fetching all vulnerabilities...");
    let allVulnerabilities = [];
    let vulnPage = 1;
    let vulnTotal = 0;
    do {
      const vulnEndpoint = `/api/issues/search?componentKeys=${SONARQUBE_PROJECT_KEY}&types=VULNERABILITY&ps=500&p=${vulnPage}`;
      const vulnData = await sonarqubeRestRequest(vulnEndpoint);
      allVulnerabilities = allVulnerabilities.concat(vulnData?.issues || []);
      vulnTotal = vulnData?.total || 0;
      console.log(
        `   Page ${vulnPage}: ${vulnData?.issues?.length || 0} vulnerabilities (total: ${allVulnerabilities.length}/${vulnTotal})`,
      );
      vulnPage++;
    } while (allVulnerabilities.length < vulnTotal && vulnTotal > 0);
    reports.vulnerabilities = allVulnerabilities;
    console.log(`✅ Found ${reports.vulnerabilities.length} vulnerabilities`);

    // 3. Get ALL security hotspots with pagination
    console.log("   Fetching all security hotspots...");
    let allHotspots = [];
    let hotspotPage = 1;
    let hotspotTotal = 0;
    do {
      const hotspotsEndpoint = `/api/hotspots/search?projectKey=${SONARQUBE_PROJECT_KEY}&ps=500&p=${hotspotPage}`;
      const hotspotsData = await sonarqubeRestRequest(hotspotsEndpoint);
      allHotspots = allHotspots.concat(hotspotsData?.hotspots || []);
      hotspotTotal = hotspotsData?.paging?.total || 0;
      console.log(
        `   Page ${hotspotPage}: ${hotspotsData?.hotspots?.length || 0} hotspots (total: ${allHotspots.length}/${hotspotTotal})`,
      );
      hotspotPage++;
    } while (allHotspots.length < hotspotTotal && hotspotTotal > 0);
    reports.securityHotspots = allHotspots;
    console.log(
      `✅ Found ${reports.securityHotspots.length} security hotspots`,
    );

    // 4. Get ALL bugs with pagination
    console.log("   Fetching all bugs...");
    let allBugs = [];
    let bugPage = 1;
    let bugTotal = 0;
    do {
      const bugsEndpoint = `/api/issues/search?componentKeys=${SONARQUBE_PROJECT_KEY}&types=BUG&ps=500&p=${bugPage}`;
      const bugsData = await sonarqubeRestRequest(bugsEndpoint);
      allBugs = allBugs.concat(bugsData?.issues || []);
      bugTotal = bugsData?.total || 0;
      console.log(
        `   Page ${bugPage}: ${bugsData?.issues?.length || 0} bugs (total: ${allBugs.length}/${bugTotal})`,
      );
      bugPage++;
    } while (allBugs.length < bugTotal && bugTotal > 0);
    reports.bugs = allBugs;
    console.log(`✅ Found ${reports.bugs.length} bugs`);

    // 5. Get ALL code smells with pagination (not just CRITICAL/BLOCKER - get ALL severities)
    console.log("   Fetching all code smells...");
    let allCodeSmells = [];
    let smellPage = 1;
    let smellTotal = 0;
    do {
      const smellsEndpoint = `/api/issues/search?componentKeys=${SONARQUBE_PROJECT_KEY}&types=CODE_SMELL&ps=500&p=${smellPage}`;
      const smellsData = await sonarqubeRestRequest(smellsEndpoint);
      allCodeSmells = allCodeSmells.concat(smellsData?.issues || []);
      smellTotal = smellsData?.total || 0;
      console.log(
        `   Page ${smellPage}: ${smellsData?.issues?.length || 0} code smells (total: ${allCodeSmells.length}/${smellTotal})`,
      );
      smellPage++;
    } while (allCodeSmells.length < smellTotal && smellTotal > 0);
    reports.codeSmells = allCodeSmells;
    console.log(
      `✅ Found ${reports.codeSmells.length} code smells (all severities)`,
    );

    // 6. Get security measures
    const measuresEndpoint = `/api/measures/component?component=${SONARQUBE_PROJECT_KEY}&metricKeys=vulnerabilities,security_hotspots,security_rating,bugs,reliability_rating,code_smells,sqale_rating`;
    reports.measures = await sonarqubeRestRequest(measuresEndpoint);
    console.log(
      `✅ Security Rating: ${reports.measures?.component?.measures?.find((m) => m.metric === "security_rating")?.value || "N/A"}`,
    );
  } catch (error) {
    console.error(`❌ SonarQube Error: ${error.message}`);
    reports.error = error.message;
  }

  return reports;
}

/**
 * Save reports to JSON files
 */
function saveReports(deepsourceReports, sonarqubeReports) {
  console.log("\n💾 Saving reports to disk...\n");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Save DeepSource reports
  const deepsourceFile = path.join(
    OUTPUT_DIR,
    `deepsource-report-${TIMESTAMP}.json`,
  );
  fs.writeFileSync(deepsourceFile, JSON.stringify(deepsourceReports, null, 2));
  console.log(`✅ DeepSource report saved: ${deepsourceFile}`);

  // Save DeepSource security-only report
  const deepsourceSecurityFile = path.join(
    OUTPUT_DIR,
    `deepsource-security-${TIMESTAMP}.json`,
  );
  const deepsourceSecurityReport = {
    metadata: deepsourceReports.metadata,
    repository: {
      name: deepsourceReports.repository?.name,
      isActivated: deepsourceReports.repository?.isActivated,
    },
    securityIssues: deepsourceReports.securityIssues,
    metrics: {
      securityCount: deepsourceReports.metrics?.securityCount,
      bugRiskCount: deepsourceReports.metrics?.bugRiskCount,
      antipatternCount: deepsourceReports.metrics?.antipatternCount,
    },
  };
  fs.writeFileSync(
    deepsourceSecurityFile,
    JSON.stringify(deepsourceSecurityReport, null, 2),
  );
  console.log(`✅ DeepSource security report saved: ${deepsourceSecurityFile}`);

  // Save SonarQube reports
  if (sonarqubeReports) {
    const sonarqubeFile = path.join(
      OUTPUT_DIR,
      `sonarqube-report-${TIMESTAMP}.json`,
    );
    fs.writeFileSync(sonarqubeFile, JSON.stringify(sonarqubeReports, null, 2));
    console.log(`✅ SonarQube report saved: ${sonarqubeFile}`);

    // Save SonarQube security-only report
    const sonarqubeSecurityFile = path.join(
      OUTPUT_DIR,
      `sonarqube-security-${TIMESTAMP}.json`,
    );
    const sonarqubeSecurityReport = {
      metadata: sonarqubeReports.metadata,
      vulnerabilities: sonarqubeReports.vulnerabilities,
      securityHotspots: sonarqubeReports.securityHotspots,
      securityRating: sonarqubeReports.measures?.component?.measures?.find(
        (m) => m.metric === "security_rating",
      ),
    };
    fs.writeFileSync(
      sonarqubeSecurityFile,
      JSON.stringify(sonarqubeSecurityReport, null, 2),
    );
    console.log(`✅ SonarQube security report saved: ${sonarqubeSecurityFile}`);
  }

  // Create a combined summary report
  const summaryFile = path.join(
    OUTPUT_DIR,
    `security-summary-${TIMESTAMP}.json`,
  );
  const summary = {
    metadata: {
      timestamp: new Date().toISOString(),
      generatedBy: "fetch-security-reports.js",
    },
    deepsource: {
      totalIssues: deepsourceReports.issues?.length || 0,
      securityIssues: deepsourceReports.securityIssues?.length || 0,
      securityCount: deepsourceReports.metrics?.securityCount || 0,
      bugRiskCount: deepsourceReports.metrics?.bugRiskCount || 0,
      criticalIssues:
        deepsourceReports.issues?.filter((i) => i.severity === "CRITICAL")
          ?.length || 0,
    },
    sonarqube: sonarqubeReports
      ? {
          vulnerabilities: sonarqubeReports.vulnerabilities?.length || 0,
          securityHotspots: sonarqubeReports.securityHotspots?.length || 0,
          bugs: sonarqubeReports.bugs?.length || 0,
          criticalCodeSmells: sonarqubeReports.codeSmells?.length || 0,
        }
      : null,
    files: {
      deepsourceReport: path.basename(deepsourceFile),
      deepsourceSecurityReport: path.basename(deepsourceSecurityFile),
      sonarqubeReport: sonarqubeReports
        ? path.basename(
            path.join(OUTPUT_DIR, `sonarqube-report-${TIMESTAMP}.json`),
          )
        : null,
      sonarqubeSecurityReport: sonarqubeReports
        ? path.basename(
            path.join(OUTPUT_DIR, `sonarqube-security-${TIMESTAMP}.json`),
          )
        : null,
    },
  };

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`✅ Summary report saved: ${summaryFile}`);

  // Create/update latest symlinks
  const latestDeepSource = path.join(OUTPUT_DIR, "deepsource-latest.json");
  const latestSonarQube = path.join(OUTPUT_DIR, "sonarqube-latest.json");
  const latestSummary = path.join(OUTPUT_DIR, "security-summary-latest.json");

  try {
    if (fs.existsSync(latestDeepSource)) fs.unlinkSync(latestDeepSource);
    if (fs.existsSync(latestSummary)) fs.unlinkSync(latestSummary);
    fs.copyFileSync(deepsourceFile, latestDeepSource);
    fs.copyFileSync(summaryFile, latestSummary);
    console.log(`✅ Updated latest report links`);

    if (sonarqubeReports) {
      if (fs.existsSync(latestSonarQube)) fs.unlinkSync(latestSonarQube);
      fs.copyFileSync(
        path.join(OUTPUT_DIR, `sonarqube-report-${TIMESTAMP}.json`),
        latestSonarQube,
      );
    }
  } catch (err) {
    console.log(`⚠️  Could not create latest links: ${err.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║         Security Reports Fetcher                           ║");
  console.log("║  Retrieving reports from DeepSource and SonarQube          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  try {
    // Fetch reports from both platforms
    const deepsourceReports = await fetchDeepSourceSecurityReports();
    const sonarqubeReports = await fetchSonarQubeSecurityReports();

    // Save all reports
    saveReports(deepsourceReports, sonarqubeReports);

    console.log("\n✅ All security reports fetched and saved successfully!\n");
    console.log(`📁 Reports location: ${OUTPUT_DIR}\n`);
  } catch (error) {
    console.error(`\n❌ Fatal Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  fetchDeepSourceSecurityReports,
  fetchSonarQubeSecurityReports,
  saveReports,
};
