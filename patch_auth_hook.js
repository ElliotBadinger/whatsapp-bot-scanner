const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "services/scan-orchestrator/src/index.ts",
);
let content = fs.readFileSync(filePath, "utf8");

// Check if crypto is imported, if not, add it.
if (
  !content.includes("import crypto from 'node:crypto';") &&
  !content.includes('import crypto from "node:crypto";')
) {
  content = content.replace(
    /^import /m,
    "import crypto from 'node:crypto';\nimport ",
  );
}

const targetStr = `  if (!secret || (headerToken !== secret && queryToken !== secret)) {`;
const replaceStr = `  const secureCompare = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const hashA = crypto.createHash('sha256').update(a).digest();
    const hashB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  };

  if (!secret || (!secureCompare(headerToken, secret) && !secureCompare(queryToken, secret))) {`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync(filePath, content);
