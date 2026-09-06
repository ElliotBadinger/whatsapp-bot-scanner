const fs = require("fs");

const path = "services/control-plane/src/index.ts";
let code = fs.readFileSync(path, "utf8");

if (!code.includes('import crypto from "node:crypto";')) {
  code = code.replace(
    'import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";',
    'import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";\nimport crypto from "node:crypto";',
  );
}

code = code.replace(
  `    if (token !== expectedToken) {`,
  `    const a = Buffer.from(token, 'utf8');
    const b = Buffer.from(expectedToken, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {`,
);

fs.writeFileSync(path, code);
