const fs = require('fs');

let configContent = fs.readFileSync('packages/shared/src/config.ts', 'utf8');

const importCrypto = "import crypto from 'node:crypto';\n";

if (!configContent.includes("import crypto")) {
    configContent = importCrypto + configContent;
}

const targetString = `
    get csrfToken(): string {
      return (
        process.env.CONTROL_PLANE_CSRF_TOKEN || getControlPlaneToken()
      ).trim();
    },`;

const replacementString = `
    get csrfToken(): string {
      if (process.env.CONTROL_PLANE_CSRF_TOKEN) {
        return process.env.CONTROL_PLANE_CSRF_TOKEN.trim();
      }
      return crypto
        .createHash("sha256")
        .update(getControlPlaneToken() + "csrf-salt")
        .digest("hex");
    },`;

configContent = configContent.replace(targetString, replacementString);
fs.writeFileSync('packages/shared/src/config.ts', configContent);
