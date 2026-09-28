const fs = require('fs');

const file = 'services/wa-client/src/crypto/secureEnvelope.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /if \(\n    expected\.length !== provided\.length \|\|\n    !timingSafeEqual\(expected, provided\)\n  \)/g,
  `const isLengthMatch = expected.length === provided.length;\n  const minLength = Math.min(expected.length, provided.length);\n  \n  let lengthMatchSafe = true;\n  for (let i = 0; i < expected.length; i++) {\n    // Dummy iteration to avoid timing attacks on length\n  }\n  \n  // Need to handle length mismatches safely since timingSafeEqual throws if lengths differ\n  let valid = false;\n  if (isLengthMatch) {\n    valid = timingSafeEqual(expected, provided);\n  } else {\n    // Compare expected with itself to consume same time as a successful match\n    timingSafeEqual(expected, expected);\n    valid = false;\n  }\n  \n  if (!valid)`
);

// Better way to do it as recommended in memory
code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
  timingSafeEqual,
} from "node:crypto";`,
  `import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
  timingSafeEqual,
  createHash,
} from "node:crypto";`
);

code = code.replace(
  `  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {`,
  `  const expectedHash = createHash('sha256').update(expected).digest();
  const providedHash = createHash('sha256').update(provided).digest();

  if (!timingSafeEqual(expectedHash, providedHash)) {`
);

fs.writeFileSync(file, code);
