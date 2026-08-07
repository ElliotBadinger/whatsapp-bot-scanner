const fs = require('fs');
const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).update('csrf-salt').digest('hex');
}

const csrfTokenHash = hashToken('secret-token');

let testTs = fs.readFileSync('services/wa-client/src/__tests__/commands.test.ts', 'utf8');

testTs = testTs.replace(/"x-csrf-token": "secret-token"/g, `"x-csrf-token": "${csrfTokenHash}"`);

fs.writeFileSync('services/wa-client/src/__tests__/commands.test.ts', testTs);
console.log('Patched services/wa-client/src/__tests__/commands.test.ts');
