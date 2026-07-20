const fs = require('fs');
const file = 'services/wa-client/__tests__/mocks/wbscanner-shared.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import crypto from "node:crypto";') && !code.includes('import crypto from "crypto";')) {
  code = `import crypto from "node:crypto";\n` + code;
} else if (!code.includes('import crypto from "crypto";')) {
  code = `import crypto from "crypto";\n` + code;
}

fs.writeFileSync(file, code);
console.log("Patched mock crypto import");
