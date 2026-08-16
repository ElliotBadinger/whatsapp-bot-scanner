const fs = require('fs');
const file = 'services/wa-client/src/__tests__/commands.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /"x-csrf-token": "secret-token",/g,
  `"x-csrf-token": "4f555a40c92b3514d8a14df0057d04a32f528b27e72992f04ab0d39abd9367d5",`
);

fs.writeFileSync(file, code);
