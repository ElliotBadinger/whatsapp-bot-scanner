const fs = require("fs");

const path = "services/control-plane/src/index.ts";
let content = fs.readFileSync(path, "utf8");

// Add crypto import if it doesn't exist
if (!content.includes('import crypto from "node:crypto";')) {
  content = content.replace(
    'import fs from "node:fs/promises";',
    'import fs from "node:fs/promises";\nimport crypto from "node:crypto";',
  );
}

// Replace string comparison with timingSafeEqual by hashing first
const oldCode = `    if (token !== expectedToken) {`;
const newCode = `    const hashA = crypto.createHash("sha256").update(token).digest();
    const hashB = crypto.createHash("sha256").update(expectedToken).digest();
    if (!crypto.timingSafeEqual(hashA, hashB)) {`;

content = content.replace(oldCode, newCode);

// Write back
fs.writeFileSync(path, content, "utf8");
