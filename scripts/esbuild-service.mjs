#!/usr/bin/env node
/**
 * esbuild production bundler for services.
 *
 * Usage: node scripts/esbuild-service.mjs <service-name>
 * Example: node scripts/esbuild-service.mjs scan-orchestrator
 *
 * This script bundles a service for production with:
 * - Tree-shaking to remove unused code
 * - Minification to reduce bundle size
 * - External packages marked to avoid bundling node_modules
 */

import * as esbuild from "esbuild";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const serviceName = process.argv[2];
if (!serviceName) {
  console.error("Usage: node scripts/esbuild-service.mjs <service-name>");
  console.error("Example: node scripts/esbuild-service.mjs scan-orchestrator");
  process.exit(1);
}

const serviceDir = join(rootDir, "services", serviceName);
if (!existsSync(serviceDir)) {
  console.error(`Service directory not found: ${serviceDir}`);
  process.exit(1);
}

// Read package.json to determine external dependencies
const pkgPath = join(serviceDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

// Mark all dependencies as external (they're in node_modules)
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
  // Node.js built-ins
  "node:*",
  "fs",
  "path",
  "crypto",
  "http",
  "https",
  "net",
  "tls",
  "stream",
  "events",
  "buffer",
  "util",
  "os",
  "child_process",
  "worker_threads",
  "cluster",
  "dns",
  "url",
  "querystring",
  "assert",
  "zlib",
];

const entryPoint = join(serviceDir, "src", "index.ts");
const outfile = join(serviceDir, "dist", "index.js");

console.log(`Building ${serviceName} with esbuild...`);
console.log(`  Entry: ${entryPoint}`);
console.log(`  Output: ${outfile}`);

try {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile,
    external,
    minify: process.env.NODE_ENV === "production",
    sourcemap: process.env.NODE_ENV !== "production",
    treeShaking: true,
    metafile: true,
    logLevel: "info",
    // Preserve important comments (licenses, etc.)
    legalComments: "linked",
    // Define environment replacements for dead code elimination
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "production",
      ),
    },
  });

  // Report bundle size
  const outputs = result.metafile?.outputs || {};
  for (const [file, info] of Object.entries(outputs)) {
    const sizeKB = (info.bytes / 1024).toFixed(2);
    console.log(`  Output size: ${sizeKB} KB`);
  }

  console.log(`Successfully built ${serviceName}`);
} catch (error) {
  console.error(`Failed to build ${serviceName}:`, error);
  process.exit(1);
}
