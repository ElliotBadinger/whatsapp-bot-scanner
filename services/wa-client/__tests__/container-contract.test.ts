import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = resolve(__dirname, "..", "..", "..");

describe("Container wiring contracts", () => {
  it("docker-compose wa-client healthcheck must gate on /healthz JSON status", () => {
    const composePath = join(repoRoot, "docker-compose.mvp.yml");
    const compose = readFileSync(composePath, "utf-8");

    expect(compose).toContain("wa-client:");
    expect(compose).toContain("fetch(''http://localhost:");
    expect(compose).toContain("/healthz");
    expect(compose).toContain("j && j.status === ''healthy''");
  });

  it("wa-client-baileys Dockerfile stage must install nodejs", () => {
    const dockerfilePath = join(repoRoot, "docker", "Dockerfile");
    const dockerfile = readFileSync(dockerfilePath, "utf-8");

    expect(dockerfile).toMatch(/\nFROM\s+base\s+AS\s+wa-client-baileys\b/);
    expect(dockerfile).toContain("apt-get install -y nodejs");
  });

  it("wa-client entrypoint must prefer /usr/bin/node and exec via NODE_BIN", () => {
    const entrypointPath = join(
      repoRoot,
      "services",
      "wa-client",
      "scripts",
      "entrypoint.sh",
    );
    const entrypoint = readFileSync(entrypointPath, "utf-8");

    expect(entrypoint).toContain('if [ -x "/usr/bin/node" ]; then');
    expect(entrypoint).toContain('NODE_BIN="/usr/bin/node"');
    expect(entrypoint).toContain('exec "$NODE_BIN" dist/main.js');
  });
});
