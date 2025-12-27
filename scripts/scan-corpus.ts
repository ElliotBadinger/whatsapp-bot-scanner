import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  normalizeLabel,
  scanJsonlGrouped,
  summarizeBucket,
  type ReportEntry,
} from "./scan-utils";

const filePath = process.env.CORPUS_PATH || "storage/link-corpus.jsonl";
const reportPath = process.env.SCAN_CORPUS_REPORT_PATH || "";
const reportLimit = Number.parseInt(
  process.env.SCAN_CORPUS_REPORT_LIMIT || "250",
  10,
);

const refreshFeeds =
  (process.env.SCAN_CORPUS_REFRESH_FEEDS || "true").toLowerCase() !== "false" &&
  (process.env.SCAN_CORPUS_REFRESH_FEEDS || "true").toLowerCase() !== "0";

const run = async () => {
  if (refreshFeeds) {
    const result = spawnSync("node", ["scripts/update-local-feeds.js"], {
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) {
      throw new Error("Failed to refresh local feeds for scan-corpus");
    }
  }
  const reportEntries: ReportEntry[] = [];
  const { buckets, elapsedSeconds } = await scanJsonlGrouped(filePath, {
    reportEntries,
    reportLimit,
    groupKey: (entry) => normalizeLabel(entry.label) ?? "unknown",
  });

  if (reportPath && reportEntries.length > 0) {
    const lines = reportEntries.map((entry) => JSON.stringify(entry));
    fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  }

  const totals = Object.entries(buckets).map(([label, bucket]) => ({
    label,
    ...summarizeBucket(bucket),
  }));

  console.log(JSON.stringify({ elapsedSeconds, totals }, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
