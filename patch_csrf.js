const fs = require("fs");

// Patch config.ts
let configTs = fs.readFileSync("packages/shared/src/config.ts", "utf8");

// Add crypto import if not present
if (!configTs.includes("import crypto from")) {
  configTs = "import crypto from 'node:crypto';\n" + configTs;
}

// Modify CSRF logic
configTs = configTs.replace(
  /get csrfToken\(\): string {\s*return \(\s*process\.env\.CONTROL_PLANE_CSRF_TOKEN \|\| getControlPlaneToken\(\)\s*\)\.trim\(\);\s*}/g,
  `get csrfToken(): string {
      const explicitToken = (process.env.CONTROL_PLANE_CSRF_TOKEN || "").trim();
      if (explicitToken) return explicitToken;

      const apiToken = getControlPlaneToken();
      // Derive a CSRF token securely from the API token to prevent token reuse
      return crypto
        .createHash("sha256")
        .update(apiToken)
        .update("csrf-salt")
        .digest("hex");
    }`,
);

fs.writeFileSync("packages/shared/src/config.ts", configTs);
console.log("Patched packages/shared/src/config.ts");

// Patch mocks
let mockTs = fs.readFileSync(
  "services/wa-client/__tests__/mocks/wbscanner-shared.ts",
  "utf8",
);

if (!mockTs.includes("import crypto from")) {
  mockTs = "import crypto from 'node:crypto';\n" + mockTs;
}

mockTs = mockTs.replace(
  /get csrfToken\(\): string {\s*return \(\s*process\.env\.CONTROL_PLANE_CSRF_TOKEN \|\|\s*process\.env\.CONTROL_PLANE_API_TOKEN \|\|\s*"test-token"\s*\)\.trim\(\);\s*}/g,
  `get csrfToken(): string {
      const explicitToken = (process.env.CONTROL_PLANE_CSRF_TOKEN || "").trim();
      if (explicitToken) return explicitToken;

      const apiToken = (process.env.CONTROL_PLANE_API_TOKEN || "test-token").trim();
      return crypto
        .createHash("sha256")
        .update(apiToken)
        .update("csrf-salt")
        .digest("hex");
    }`,
);

fs.writeFileSync(
  "services/wa-client/__tests__/mocks/wbscanner-shared.ts",
  mockTs,
);
console.log("Patched services/wa-client/__tests__/mocks/wbscanner-shared.ts");
