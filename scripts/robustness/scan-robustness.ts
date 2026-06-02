import fs from "node:fs";
import path from "node:path";
import {
  scanJsonlGrouped,
  summarizeBucket,
  mergeBuckets,
  createEmptyBucket,
  type Bucket,
  type ReportEntry,
} from "../scan-utils";

type ManifestSource = {
  id: string;
  status?: string;
  path?: string;
  sourceUrl?: string;
  notes?: string;
  counts?: Record<string, number>;
  reason?: string;
};

type Manifest = {
  generatedAt?: string;
  sources?: ManifestSource[];
};

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type SourceClasses = {
  memorization?: string[];
  generalization?: string[];
};

function loadSourceClasses(filePath: string): {
  classOf: Map<string, "memorization" | "generalization">;
} {
  const classOf = new Map<string, "memorization" | "generalization">();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as SourceClasses;
    for (const id of raw.memorization ?? []) classOf.set(id, "memorization");
    for (const id of raw.generalization ?? []) classOf.set(id, "generalization");
  } catch {
    // No classification file — slices will be empty; overall still reported.
  }
  return { classOf };
}

const manifestPath =
  process.env.ROBUSTNESS_MANIFEST_PATH || "storage/robustness/manifest.json";
const reportPath = process.env.ROBUSTNESS_REPORT_PATH || "";
const reportLimit = Number.parseInt(
  process.env.ROBUSTNESS_REPORT_LIMIT || "500",
  10,
);
const sourceFilter = new Set(parseList(process.env.ROBUSTNESS_SOURCES));
const disableLocalFeeds =
  (process.env.ROBUSTNESS_DISABLE_LOCAL_FEEDS || "").toLowerCase() === "true";
const offlineMode =
  (process.env.ROBUSTNESS_OFFLINE || "").toLowerCase() === "true";
const disableEnhancedSecurity =
  (process.env.ROBUSTNESS_DISABLE_ENHANCED_SECURITY || "").toLowerCase() === "true";

if (disableLocalFeeds) {
  process.env.LOCAL_FEEDS_ENABLED = "false";
}

const scanOptions =
  offlineMode || disableEnhancedSecurity || disableLocalFeeds
    ? {
        enableExternalEnrichers: false,
        followRedirects: false,
        enableEnhancedSecurity: false,
      }
    : undefined;

const summaryPath = process.env.ROBUSTNESS_SUMMARY_PATH || "";
const sourceClassesPath =
  process.env.ROBUSTNESS_SOURCE_CLASSES || "benchmarks/source-classes.json";
const { classOf } = loadSourceClasses(sourceClassesPath);

const manifest = JSON.parse(
  fs.readFileSync(manifestPath, "utf8"),
) as Manifest;
const reportEntries: ReportEntry[] = [];
const summaries: Array<Record<string, unknown>> = [];
const skipped: ManifestSource[] = [];

// `overall` mixes feed-loaded (memorization) and held-out (generalization)
// sources, so it is leakage-polluted; the slices below are the honest signal.
const overall: Bucket = createEmptyBucket();
const memorization: Bucket = createEmptyBucket();
const generalization: Bucket = createEmptyBucket();

const run = async () => {
  for (const source of manifest.sources ?? []) {
    if (sourceFilter.size && !sourceFilter.has(source.id)) {
      continue;
    }
    if (source.status !== "ready" || !source.path) {
      skipped.push(source);
      continue;
    }
    const filePath = path.resolve(source.path);
    if (!fs.existsSync(filePath)) {
      skipped.push({ ...source, reason: "Missing output file" });
      continue;
    }
    const { buckets, elapsedSeconds } = await scanJsonlGrouped(filePath, {
      reportEntries,
      reportLimit,
      groupKey: () => source.id,
      sourceOverride: source.id,
      scanOptions,
    });
    const bucket = buckets[source.id];
    if (!bucket) {
      skipped.push({ ...source, reason: "No entries scanned" });
      continue;
    }
    mergeBuckets(overall, bucket);
    const sourceClass = classOf.get(source.id);
    if (sourceClass === "memorization") {
      mergeBuckets(memorization, bucket);
    } else if (sourceClass === "generalization") {
      mergeBuckets(generalization, bucket);
    }
    summaries.push({
      source: source.id,
      class: sourceClass ?? "unclassified",
      elapsedSeconds,
      ...summarizeBucket(bucket),
    });
  }

  if (reportPath && reportEntries.length > 0) {
    const lines = reportEntries.map((entry) => JSON.stringify(entry));
    fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  }

  const output = {
    manifest: manifestPath,
    generatedAt: manifest.generatedAt,
    overall: summarizeBucket(overall),
    memorization: summarizeBucket(memorization),
    generalization: summarizeBucket(generalization),
    sources: summaries,
    skipped,
  };

  if (summaryPath) {
    fs.writeFileSync(
      summaryPath,
      `${JSON.stringify(output, null, 2)}\n`,
      "utf8",
    );
  }
  console.log(JSON.stringify(output, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
