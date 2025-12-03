import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    env: {
      URLSCAN_ENABLED: "false",
      CONTROL_PLANE_API_TOKEN: "integration-test-token",
    },
  },
  resolve: {
    alias: {
      "@wbscanner/shared": resolve(rootDir, "../../packages/shared/src"),
      bottleneck: resolve(rootDir, "./stubs/bottleneck.ts"),
    },
  },
});
