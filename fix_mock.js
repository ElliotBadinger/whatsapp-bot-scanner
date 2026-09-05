const fs = require('fs');

let configContent = fs.readFileSync('services/wa-client/__tests__/mocks/wbscanner-shared.ts', 'utf8');

const importCrypto = "import crypto from 'node:crypto';\n";
if (!configContent.includes("import crypto")) {
    configContent = importCrypto + configContent;
}

const targetString = `
    get csrfToken(): string {
      return (
        process.env.CONTROL_PLANE_CSRF_TOKEN ||
        process.env.CONTROL_PLANE_API_TOKEN ||
        "test-token"
      ).trim();
    },`;

const replacementString = `
    get csrfToken(): string {
      if (process.env.CONTROL_PLANE_CSRF_TOKEN) {
        return process.env.CONTROL_PLANE_CSRF_TOKEN.trim();
      }
      return crypto
        .createHash("sha256")
        .update((process.env.CONTROL_PLANE_API_TOKEN || "test-token") + "csrf-salt")
        .digest("hex");
    },`;

configContent = configContent.replace(targetString, replacementString);
fs.writeFileSync('services/wa-client/__tests__/mocks/wbscanner-shared.ts', configContent);
