/**
 * DeepSource API Schema Explorer
 *
 * Comprehensive introspection of DeepSource GraphQL API to discover
 * the correct structure for querying individual issues.
 */

const https = require("https");

const API_ENDPOINT = "https://api.deepsource.io/graphql/";
const API_TOKEN = process.env.DEEPSOURCE_API_TOKEN;

if (!API_TOKEN) {
  console.error(
    "\\n❌ Error: DEEPSOURCE_API_TOKEN environment variable is required",
  );
  console.error(
    "   Generate a token at: https://app.deepsource.com/settings/tokens\\n",
  );
  process.exit(1);
}

async function graphqlRequest(query, variables = {}) {
  const data = JSON.stringify({ query, variables });

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
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function introspectIssueTypes() {
  console.log("\n🔍 Introspecting Issue-Related Types...\n");

  const query = `
        query {
            repositoryIssue: __type(name: "RepositoryIssue") {
                name
                kind
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
            issue: __type(name: "Issue") {
                name
                kind
                fields {
                    name
                    type {
                        name
                        kind
                    }
                }
            }
            occurrence: __type(name: "Occurrence") {
                name
                kind
                fields {
                    name
                    type {
                        name
                        kind
                    }
                }
            }
            check: __type(name: "Check") {
                name
                kind  
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

  try {
    const data = await graphqlRequest(query);

    for (const [typeName, typeInfo] of Object.entries(data)) {
      if (typeInfo && typeInfo.fields) {
        console.log(`\n📋 Type: ${typeInfo.name}`);
        console.log("   Fields:");
        typeInfo.fields.forEach((field) => {
          const typeStr = field.type.ofType
            ? `${field.type.ofType.name}`
            : `${field.type.name || field.type.kind}`;
          console.log(`      - ${field.name}: ${typeStr}`);
        });
      } else {
        console.log(`\n❌ Type ${typeName} not found or has no fields`);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function testIssueQuery() {
  console.log("\n🧪 Testing Issue Query Variants...\n");

  const testQueries = [
    {
      name: "Simple issue count",
      query: `
                query {
                    repository(login: "ElliotBadinger", name: "whatsapp-bot-scanner", vcsProvider: GITHUB) {
                        issues(first: 1) {
                            totalCount
                        }
                    }
                }`,
    },
    {
      name: "Issue with check field",
      query: `
                query {
                    repository(login: "ElliotBadinger", name: "whatsapp-bot-scanner", vcsProvider: GITHUB) {
                        issues(first: 1) {
                            edges {
                                node {
                                    check {
                                        shortcode
                                        title
                                    }
                                }
                            }
                        }
                    }
                }`,
    },
    {
      name: "Issue with occurrences",
      query: `
                query {
                    repository(login: "ElliotBadinger", name: "whatsapp-bot-scanner", vcsProvider: GITHUB) {
                        issues(first: 1) {
                            edges {
                                node {
                                    occurrences(first: 1) {
                                        edges {
                                            node {
                                                path
                                                beginLine
                                                endLine
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`,
    },
  ];

  for (const test of testQueries) {
    console.log(`\n📝 Testing: ${test.name}`);
    try {
      const data = await graphqlRequest(test.query);
      console.log("   ✅ Success:", JSON.stringify(data, null, 2));
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message.split("\n")[0]}`);
    }
  }
}

async function exploreAnalyzersAndChecks() {
  console.log("\n🔍 Exploring Analyzers and Checks...\n");

  const query = `
        query {
            repository(login: "ElliotBadinger", name: "whatsapp-bot-scanner", vcsProvider: GITHUB) {
                enabledAnalyzers(first: 10) {
                    edges {
                        node {
                            name
                            shortcode
                            issues(first: 5) {
                                edges {
                                    node {
                                        check {
                                            shortcode
                                            title
                                            category
                                            severity
                                        }
                                        occurrences {
                                            totalCount
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

  try {
    const data = await graphqlRequest(query);
    console.log("✅ Analyzer/Check structure:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║      DeepSource API Schema Explorer                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  await introspectIssueTypes();
  await testIssueQuery();
  await exploreAnalyzersAndChecks();
}

main();
