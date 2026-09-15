const fs = require('fs');
let testContent = fs.readFileSync('services/wa-client/src/__tests__/commands.test.ts', 'utf8');

if (!testContent.includes("import crypto from 'node:crypto';")) {
    testContent = testContent.replace('import { handleAdminCommand, formatGroupVerdict } from "../index";', "import { handleAdminCommand, formatGroupVerdict } from \"../index\";\nimport crypto from 'node:crypto';");
}

testContent = testContent.replace(
    /"x-csrf-token": "secret-token",/g,
    `"x-csrf-token": crypto.createHash('sha256').update('secret-token' + 'csrf-salt').digest('hex'),`
);

fs.writeFileSync('services/wa-client/src/__tests__/commands.test.ts', testContent);
