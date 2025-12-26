import fs from "node:fs";
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

const run = async () => {
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
