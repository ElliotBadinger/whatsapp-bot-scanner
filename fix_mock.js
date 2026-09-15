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
