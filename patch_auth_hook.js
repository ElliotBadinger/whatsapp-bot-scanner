const fs = require("fs");

const path = "services/control-plane/src/index.ts";
let code = fs.readFileSync(path, "utf8");

// Add crypto import if it doesn't exist
if (
  !code.includes('import crypto from "node:crypto";') &&
  !code.includes('import crypto from "crypto";')
) {
  code = 'import crypto from "node:crypto";\n' + code;
}

const target = `function createAuthHook(expectedToken: string) {
  return function authHook(
    req: FastifyRequest,
    reply: FastifyReply,
    done: (err?: Error) => void,
  ) {
    const hdr = req.headers["authorization"] || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : hdr;
    if (token !== expectedToken) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    done();
  };
}`;

const replacement = `function createAuthHook(expectedToken: string) {
  const expectedHash = crypto.createHash("sha256").update(expectedToken).digest();

  return function authHook(
    req: FastifyRequest,
    reply: FastifyReply,
    done: (err?: Error) => void,
  ) {
    const hdr = req.headers["authorization"] || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : hdr;

    const tokenHash = crypto.createHash("sha256").update(token).digest();

    if (!crypto.timingSafeEqual(expectedHash, tokenHash)) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    done();
  };
}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(path, code);
  console.log("Patched control-plane index.ts successfully");
} else {
  console.log("Could not find target block in index.ts");
}
