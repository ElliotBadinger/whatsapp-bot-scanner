const fs = require("fs");

let configContent = fs.readFileSync(
  "services/wa-client/src/__tests__/commands.test.ts",
  "utf8",
);

const targetString = `"x-csrf-token": "secret-token",`;

const replacementString = `"x-csrf-token": "4f555a40c92b3514d8a14df0057d04a32f528b27e72992f04ab0d39abd9367d5",`;

configContent = configContent.replace(targetString, replacementString);
configContent = configContent.replace(targetString, replacementString);

fs.writeFileSync(
  "services/wa-client/src/__tests__/commands.test.ts",
  configContent,
);
