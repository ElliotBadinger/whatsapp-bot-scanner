const fs = require('fs');
const file = 'packages/shared/src/config.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import crypto')) {
  code = `import crypto from "node:crypto";\n` + code;
}

code = code.replace(
  /get csrfToken\(\): string \{\s+return \(\s+process\.env\.CONTROL_PLANE_CSRF_TOKEN \|\| getControlPlaneToken\(\)\s+\)\.trim\(\);\s+\},/,
  `get csrfToken(): string {
      if (process.env.CONTROL_PLANE_CSRF_TOKEN) {
        return process.env.CONTROL_PLANE_CSRF_TOKEN.trim();
      }
      return crypto
        .createHash("sha256")
        .update(getControlPlaneToken() + "csrf-salt")
        .digest("hex");
    },`
);

fs.writeFileSync(file, code);
