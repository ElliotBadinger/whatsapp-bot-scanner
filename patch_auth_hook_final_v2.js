const fs = require('fs');
const path = 'services/control-plane/src/index.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('import crypto from "node:crypto";')) {
    code = `import crypto from "node:crypto";\n` + code;
}

code = code.replace(
`    if (token !== expectedToken) {`,
`    const a = Buffer.from(token, 'utf8');
    const b = Buffer.from(expectedToken, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {`
);

fs.writeFileSync(path, code);
