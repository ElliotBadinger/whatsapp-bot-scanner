import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    env: {
      URLSCAN_ENABLED: "false",
      CONTROL_PLANE_API_TOKEN: "integration-test-token",
      DNSBL_ENABLED: "false",
      CERT_INTEL_ENABLED: "false",
      HTTP_FINGERPRINT_ENABLED: "false",
      URLSCAN_ARTIFACT_DIR: resolve(rootDir, "../../storage/urlscan-artifacts"),
      IDENTIFIER_HASH_SECRET: "integration-test-secret",
    },
  },
  resolve: {
    alias: {
      "@wbscanner/shared": resolve(rootDir, "../../packages/shared/src"),
      bottleneck: resolve(rootDir, "./stubs/bottleneck.ts"),
    },
  },
});
