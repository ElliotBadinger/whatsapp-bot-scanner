import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60_000,
    env: {
      URLSCAN_ENABLED: "false",
      CONTROL_PLANE_API_TOKEN: "dataset-test-token",
      LOG_LEVEL: "error",
    },
  },
  resolve: {
    alias: {
      "@wbscanner/shared": resolve(rootDir, "../../packages/shared/src"),
    },
  },
});
