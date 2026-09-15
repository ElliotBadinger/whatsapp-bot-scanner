#!/bin/bash
git restore bun.lock packages/shared/src/config.ts services/wa-client/__tests__/mocks/wbscanner-shared.ts services/wa-client/src/__tests__/commands.test.ts
cat << 'JS_EOF' > fix_csrf.js
const fs = require('fs');

// Fix config.ts
let configContent = fs.readFileSync('packages/shared/src/config.ts', 'utf8');

// Ensure crypto is imported
if (!configContent.includes("import crypto from 'node:crypto';")) {
    configContent = "import crypto from 'node:crypto';\n" + configContent;
}

// Fix csrfToken logic
configContent = configContent.replace(
    /get csrfToken\(\): string {\s*return \(\s*process\.env\.CONTROL_PLANE_CSRF_TOKEN \|\| getControlPlaneToken\(\)\s*\)\.trim\(\);\s*},/g,
    `get csrfToken(): string {
      if (process.env.CONTROL_PLANE_CSRF_TOKEN) {
        return process.env.CONTROL_PLANE_CSRF_TOKEN.trim();
      }
      const token = getControlPlaneToken();
      return crypto.createHash('sha256').update(token + 'csrf-salt').digest('hex');
    },`
);

fs.writeFileSync('packages/shared/src/config.ts', configContent);
JS_EOF
node fix_csrf.js

cat << 'JS_EOF' > fix_mock.js
const fs = require('fs');
let mockContent = fs.readFileSync('services/wa-client/__tests__/mocks/wbscanner-shared.ts', 'utf8');

if (!mockContent.includes("import crypto from 'node:crypto';")) {
    mockContent = "import crypto from 'node:crypto';\n" + mockContent;
}

mockContent = mockContent.replace(
    /get csrfToken\(\): string {\s*return \(\s*process\.env\.CONTROL_PLANE_CSRF_TOKEN \|\|\s*process\.env\.CONTROL_PLANE_API_TOKEN \|\|\s*"test-token"\s*\)\.trim\(\);\s*},/g,
    `get csrfToken(): string {
      if (process.env.CONTROL_PLANE_CSRF_TOKEN) {
        return process.env.CONTROL_PLANE_CSRF_TOKEN.trim();
      }
      const token = (process.env.CONTROL_PLANE_API_TOKEN || "test-token").trim();
      return crypto.createHash('sha256').update(token + 'csrf-salt').digest('hex');
    },`
);

fs.writeFileSync('services/wa-client/__tests__/mocks/wbscanner-shared.ts', mockContent);
JS_EOF
node fix_mock.js

cat << 'JS_EOF' > fix_test.js
const fs = require('fs');
let testContent = fs.readFileSync('services/wa-client/src/__tests__/commands.test.ts', 'utf8');

if (!testContent.includes("import crypto from 'node:crypto';")) {
    testContent = testContent.replace('import { handleAdminCommand, formatGroupVerdict } from "../index";', "import { handleAdminCommand, formatGroupVerdict } from \"../index\";\nimport crypto from 'node:crypto';");
}

testContent = testContent.replace(
    /"x-csrf-token": "secret-token",/g,
    `"x-csrf-token": crypto.createHash('sha256').update('secret-token' + 'csrf-salt').digest('hex'),`
);

fs.writeFileSync('services/wa-client/src/__tests__/commands.test.ts', testContent);
JS_EOF
node fix_test.js
export PUPPETEER_SKIP_DOWNLOAD=true && bun install
bun run --filter '@wbscanner/shared' test
bun run --filter '@wbscanner/wa-client' test
