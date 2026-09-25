const fs = require('fs');
const code = fs.readFileSync('packages/shared/src/config.ts', 'utf8');
if (code.includes('createHash')) {
  console.log('Patch applied successfully!');
} else {
  console.log('Failed to apply patch.');
}
