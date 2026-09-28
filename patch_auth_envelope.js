const fs = require('fs');

const file = 'services/wa-client/src/crypto/secureEnvelope.ts';
let code = fs.readFileSync(file, 'utf8');

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
