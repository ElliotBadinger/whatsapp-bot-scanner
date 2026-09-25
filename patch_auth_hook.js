const fs = require('fs');
const file = 'services/control-plane/src/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import crypto')) {
  code = `import crypto from "node:crypto";\n` + code;
}

code = code.replace(/if \(token !== expectedToken\) \{\s+reply\.code\(401\)\.send\(\{ error: "unauthorized" \}\);\s+return;\s+\}/,
  `let tokenValid = false;
    try {
      if (token) {
        const tokenHash = crypto.createHash("sha256").update(token).digest();
        const expectedHash = crypto.createHash("sha256").update(expectedToken).digest();
        tokenValid = crypto.timingSafeEqual(tokenHash, expectedHash);
      }
    } catch {
      tokenValid = false;
    }
    if (!tokenValid) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }`);

fs.writeFileSync(file, code);
