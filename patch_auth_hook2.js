const fs = require('fs');

const path = 'services/control-plane/src/index.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from \"fastify\";\nimport crypto from \"node:crypto\";", "import crypto from \"node:crypto\";\nimport fastify, { FastifyInstance, FastifyRequest, FastifyReply } from \"fastify\";");

fs.writeFileSync(path, code);
