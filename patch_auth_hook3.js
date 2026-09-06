const fs = require("fs");

const path = "services/control-plane/src/index.ts";
let code = fs.readFileSync(path, "utf8");

if (!code.includes('import crypto from "node:crypto";')) {
  code = `import crypto from "node:crypto";\n` + code;
}

fs.writeFileSync(path, code);
