const fs = require('fs');
const file = 'services/wa-client/__tests__/mocks/wbscanner-shared.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("import crypto from 'node:crypto';")) {
  code = "import crypto from 'node:crypto';\n" + code;
}

code = code.replace(
  /get csrfToken\(\): string \{\s+const raw = process\.env\.CONTROL_PLANE_CSRF_TOKEN;\s+if \(raw\) return raw\.trim\(\);\s+const token = process\.env\.CONTROL_PLANE_API_TOKEN \|\| "test-token";\s+const crypto = require\('crypto'\);\s+return crypto\.createHash\('sha256'\)\.update\(token \+ 'csrf-salt'\)\.digest\('hex'\);\s+\}/,
  `get csrfToken(): string {
      const raw = process.env.CONTROL_PLANE_CSRF_TOKEN;
      if (raw) return raw.trim();
      const token = process.env.CONTROL_PLANE_API_TOKEN || "test-token";
      return crypto.createHash('sha256').update(token + 'csrf-salt').digest('hex');
    }`
);

fs.writeFileSync(file, code);
