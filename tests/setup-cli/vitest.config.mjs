import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.mjs"],
    exclude: ["**/node_modules/**", "**/.git/**", "**/archive/**"],
  },
  resolve: {
    alias: {
      execa: "execa",
    },
  },
});
