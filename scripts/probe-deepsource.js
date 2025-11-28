/**
 * DeepSource API Probe Script
 *
 * Probes the DeepSource API to verify configuration and check repository status
 */

const https = require("https");

const API_ENDPOINT = "https://api.deepsource.io/graphql/";
const API_TOKEN =
  process.env.DEEPSOURCE_API_TOKEN ||
  "dsp_40730dd472c7e52abd28e7de0fd2883e76d5";

/**
 * Make a GraphQL request to DeepSource API
 */
async function graphqlRequest(query, variables = {}) {
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
          reject(
            new Error(
              `Failed to parse response: ${error.message}\nBody: ${body}`,
            ),
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
 * Get current user information
 */
async function getViewer() {
  const query = `
    query {
      viewer {
        email
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Introspect Repository type
 */
async function introspectRepository() {
  const query = `
    query {
      __type(name: "Repository") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Introspect specific types
 */
async function introspectTypes() {
  const query = `
    query {
      analyzerConnection: __type(name: "AnalyzerConnection") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
      repositoryTarget: __type(name: "RepositoryTarget") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
      analyzer: __type(name: "Analyzer") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
      analysisRun: __type(name: "AnalysisRun") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
      analysisRunSummary: __type(name: "AnalysisRunSummary") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
      analysisCheck: __type(name: "AnalysisCheck") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Introspect Mutation type
 */
async function introspectMutations() {
  const query = `
    query {
      __type(name: "Mutation") {
        name
        fields {
          name
          description
        }
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Get repository analysis runs
 */
async function getAnalysisRuns() {
  const query = `
    query {
      repository(login: "ElliotBadinger", name: "whatsapp-bot-scanner", vcsProvider: GITHUB) {
        name
        analysisRuns(first: 10) {
          edges {
            node {
              runUid
              status
              createdAt
              commitOid
              checks {
                edges {
                  node {
                    name
                    status
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Get repository details with SCA info
 */
async function getRepositoryDetails() {
  const query = `
    query {
      repository(login: "ElliotBadinger", name: "whatsapp-bot-scanner", vcsProvider: GITHUB) {
        name
        isActivated
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

  return graphqlRequest(query);
}

/**
 * Main probe function
 */
async function probe() {
  console.log("\n🔍 DeepSource API Schema Introspection\n");
  console.log("=".repeat(60));

  try {
    // 1. Check authentication
    console.log("\n1️⃣  Checking Authentication...");
    const viewer = await getViewer();
    console.log(`   ✅ Authenticated as: ${viewer.viewer.email}`);

    // 2. Introspect Mutations
    console.log("\n2️⃣  Introspecting Mutations...");
    const mutationSchema = await introspectMutations();

    if (mutationSchema.__type && mutationSchema.__type.fields) {
      const fields = mutationSchema.__type.fields.map((f) => f.name).sort();
      console.log("   ⚡ Available Mutations:");

      // Group fields
      const columns = 3;
      const rows = Math.ceil(fields.length / columns);

      for (let i = 0; i < rows; i++) {
        let row = "";
        for (let j = 0; j < columns; j++) {
          const index = i + j * rows;
          if (index < fields.length) {
            row += fields[index].padEnd(35);
          }
        }
        console.log(`      ${row}`);
      }
    }

    // 3. Introspect Types
    console.log("\n3️⃣  Introspecting Types...");
    const types = await introspectTypes();

    [
      "analyzerConnection",
      "repositoryTarget",
      "analyzer",
      "analysisRun",
      "analysisRunSummary",
      "analysisCheck",
    ].forEach((typeName) => {
      const typeInfo = types[typeName];
      if (typeInfo && typeInfo.fields) {
        console.log(`\n   Fields on ${typeInfo.name}:`);
        const fields = typeInfo.fields.map((f) => f.name).sort();

        // Group fields
        const columns = 3;
        const rows = Math.ceil(fields.length / columns);

        for (let i = 0; i < rows; i++) {
          let row = "";
          for (let j = 0; j < columns; j++) {
            const index = i + j * rows;
            if (index < fields.length) {
              row += fields[index].padEnd(30);
            }
          }
          console.log(`      ${row}`);
        }
      } else {
        console.log(`\n   ❌ Could not find type info for ${typeName}`);
      }
    });

    // 2. Get repository details
    console.log("\n2️⃣  Fetching Repository Details...");
    const data = await getRepositoryDetails();
    const repo = data.repository;

    console.log(`   Repository: ${repo.name}`);
    console.log(`   Activated: ${repo.isActivated ? "✅ Yes" : "❌ No"}`);

    console.log("\n   🛡️  Enabled Analyzers:");
    if (repo.enabledAnalyzers && repo.enabledAnalyzers.edges.length > 0) {
      repo.enabledAnalyzers.edges.forEach((edge) => {
        const analyzer = edge.node;
        console.log(`      ✅ ${analyzer.name} (${analyzer.shortcode})`);
      });
    } else {
      console.log("      ⚠️  No analyzers enabled");
    }

    console.log("\n   🎯 Detected Targets (SCA):");
    if (repo.targets && repo.targets.edges.length > 0) {
      repo.targets.edges.forEach((edge) => {
        const target = edge.node;
        const path = target.manifestPath || target.lockfilePath;
        console.log(
          `      ${target.isActivated ? "✅" : "❌"} ${path} (${target.ecosystem})`,
        );
      });
    } else {
      console.log("      ❌ No dependency targets detected");
      console.log("      (SCA might not be active or no manifest files found)");
    }

    console.log("\n   📄 Config JSON:", repo.configJson);

    // 5. Get recent analysis runs
    console.log("\n5️⃣  Fetching Recent Analysis Runs...");
    const runs = await getAnalysisRuns();
    const edges = runs.repository.analysisRuns.edges;

    if (edges.length > 0) {
      console.log(
        `   Found ${edges.length} recent runs (checking for latest):`,
      );
      // Sort by createdAt descending to get true latest
      const sortedRuns = edges
        .map((e) => e.node)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      sortedRuns.forEach((run, index) => {
        console.log(
          `   ${index + 1}. ${run.status} (${run.commitOid.substring(0, 7)}) - ${new Date(run.createdAt).toLocaleString()}`,
        );
        if (run.checks && run.checks.edges && run.checks.edges.length > 0) {
          run.checks.edges.forEach((edge) => {
            const check = edge.node;
            console.log(`      - ${check.name}: ${check.status}`);
          });
        }
      });

      const latestRun = sortedRuns[0];
      console.log(
        `\n   👉 True Latest Run: ${latestRun.status} (${latestRun.commitOid.substring(0, 7)})`,
      );
    } else {
      console.log("   ⚠️  No analysis runs found");
    }
    const schema = await introspectRepository();

    if (schema.__type && schema.__type.fields) {
      console.log("   Available fields on Repository:");
      const fields = schema.__type.fields.map((f) => f.name).sort();

      // Group fields for better readability
      const columns = 3;
      const rows = Math.ceil(fields.length / columns);

      for (let i = 0; i < rows; i++) {
        let row = "";
        for (let j = 0; j < columns; j++) {
          const index = i + j * rows;
          if (index < fields.length) {
            row += fields[index].padEnd(30);
          }
        }
        console.log(`   ${row}`);
      }

      // Check for specific interesting fields
      const interestingFields = [
        "analyzers",
        "config",
        "sca",
        "dependencies",
        "targets",
      ];
      const found = fields.filter((f) =>
        interestingFields.some((i) => f.toLowerCase().includes(i)),
      );

      if (found.length > 0) {
        console.log("\n   🎯 Potentially relevant fields found:");
        found.forEach((f) => console.log(`      - ${f}`));
      }
    } else {
      console.log("   ❌ Failed to fetch schema information");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the probe
probe();
