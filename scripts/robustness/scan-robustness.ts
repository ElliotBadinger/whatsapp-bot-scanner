import fs from "node:fs";
import path from "node:path";
import {
  scanJsonlGrouped,
  summarizeBucket,
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

function sumBuckets(target: Bucket, source: Bucket): Bucket {
  target.total += source.total;
  target.labeled += source.labeled;
  target.benign += source.benign;
  target.suspicious += source.suspicious;
  target.malicious += source.malicious;
  target.scoreSum += source.scoreSum;
  target.correct += source.correct;
  target.missed += source.missed;
  target.skipped += source.skipped;
  return target;
}

const manifestPath =
  process.env.ROBUSTNESS_MANIFEST_PATH || "storage/robustness/manifest.json";
const reportPath = process.env.ROBUSTNESS_REPORT_PATH || "";
const reportLimit = Number.parseInt(
  process.env.ROBUSTNESS_REPORT_LIMIT || "500",
  10,
);
const sourceFilter = new Set(parseList(process.env.ROBUSTNESS_SOURCES));

const manifest = JSON.parse(
  fs.readFileSync(manifestPath, "utf8"),
) as Manifest;
const reportEntries: ReportEntry[] = [];
const summaries: Array<Record<string, unknown>> = [];
const skipped: ManifestSource[] = [];

const overall: Bucket = {
  total: 0,
  labeled: 0,
  benign: 0,
  suspicious: 0,
  malicious: 0,
  scoreSum: 0,
  correct: 0,
  missed: 0,
  skipped: 0,
};

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
    });
    const bucket = buckets[source.id];
    if (!bucket) {
      skipped.push({ ...source, reason: "No entries scanned" });
      continue;
    }
    sumBuckets(overall, bucket);
    summaries.push({
      source: source.id,
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
    sources: summaries,
    skipped,
  };

  console.log(JSON.stringify(output, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
