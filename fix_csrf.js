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
