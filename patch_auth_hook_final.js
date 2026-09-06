const fs = require('fs');
const path = 'services/control-plane/src/index.ts';
let code = fs.readFileSync(path, 'utf8');

// Ensure crypto is imported correctly
if (!code.includes('import crypto from "node:crypto";')) {
    code = code.replace("import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from \"fastify\";", "import crypto from \"node:crypto\";\nimport fastify, { FastifyInstance, FastifyRequest, FastifyReply } from \"fastify\";");
}

fs.writeFileSync(path, code);
