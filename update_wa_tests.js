const fs = require('fs');
const crypto = require('crypto');

const file = 'services/wa-client/src/__tests__/commands.test.ts';
let code = fs.readFileSync(file, 'utf8');

const derivedToken = crypto.createHash('sha256').update('secret-token' + 'csrf-salt').digest('hex');

code = code.replace(/authorization: "Bearer secret-token",\s+"x-csrf-token": "secret-token",/g,
  `authorization: "Bearer secret-token",\n          "x-csrf-token": "${derivedToken}",`);

fs.writeFileSync(file, code);
