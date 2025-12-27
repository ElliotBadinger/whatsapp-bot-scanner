#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function run(cmd, cmdArgs, env) {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    process.exit();
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

const args = parseArgs(process.argv.slice(2));
const mode = args.mode || (args.scan ? "scan" : args.fetch ? "fetch" : "all");
const outputDir = args["output-dir"] || "storage/robustness";
const manifestPath = args.manifest || path.join(outputDir, "manifest.json");
const baselinePath =
  args["baseline-path"] || path.join(outputDir, "link-corpus.jsonl");
const baselineSummaryPath =
  args["baseline-summary"] || path.join(outputDir, "link-corpus.summary.json");
const feedsDir = args["feeds-dir"] || path.join(outputDir, "feeds");
const skipFeedRefresh = Boolean(args["skip-feed-refresh"]);

if (mode === "fetch" || mode === "all") {
  run("node", [
    "scripts/link-corpus.js",
    "--full",
    "--out",
    baselinePath,
    "--summary",
    baselineSummaryPath,
    "--feeds-dir",
    feedsDir,
  ]);
  const fetchArgs = [
    "scripts/robustness/fetch-robustness-datasets.py",
    "--output-dir",
    outputDir,
    "--manifest",
    manifestPath,
  ];
  if (args.force) {
    fetchArgs.push("--force");
  }
  if (args["reports-dir"]) {
    fetchArgs.push("--reports-dir", args["reports-dir"]);
  }
  if (args.source) {
    fetchArgs.push("--source", args.source);
  }
  run("python", fetchArgs);

  if (fs.existsSync(manifestPath) && fs.existsSync(baselinePath)) {
    const manifest = readJson(manifestPath);
    const summary = fs.existsSync(baselineSummaryPath)
      ? readJson(baselineSummaryPath)
      : {};
    const sources = Array.isArray(manifest.sources) ? manifest.sources : [];
    const filtered = sources.filter((source) => source.id !== "local-feeds");
    filtered.push({
      id: "local-feeds",
      status: "ready",
      path: baselinePath,
      counts: summary,
      notes: "link-corpus (full)",
    });
    manifest.sources = filtered;
    writeJson(manifestPath, manifest);
  }
}

if (mode === "scan" || mode === "all") {
  if (!skipFeedRefresh && !fs.existsSync(feedsDir)) {
    run("node", ["scripts/update-local-feeds.js", "--out-dir", feedsDir]);
  }
  run("bun", ["scripts/robustness/scan-robustness.ts"], {
    ROBUSTNESS_MANIFEST_PATH: manifestPath,
    LOCAL_FEED_DIR: feedsDir,
  });
}
