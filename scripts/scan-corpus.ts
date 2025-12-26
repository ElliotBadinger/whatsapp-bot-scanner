import fs from "node:fs";
import readline from "node:readline";
import { scanUrl } from "@wbscanner/scanner-core";

type Bucket = {
  total: number;
  benign: number;
  suspicious: number;
  malicious: number;
  scoreSum: number;
};

const filePath = process.env.CORPUS_PATH || "storage/link-corpus.jsonl";

const buckets: Record<string, Bucket> = {};

function ensure(label: string): Bucket {
  if (!buckets[label]) {
    buckets[label] = { total: 0, benign: 0, suspicious: 0, malicious: 0, scoreSum: 0 };
  }
  return buckets[label];
}

const run = async () => {
  const start = Date.now();
  const stream = fs.createReadStream(filePath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const entry = JSON.parse(trimmed) as { url: string; label?: string };
    const result = await scanUrl(entry.url, {
      enableExternalEnrichers: false,
      followRedirects: false,
    });
    const bucket = ensure(entry.label || "unknown");
    bucket.total += 1;
    bucket.scoreSum += result.verdict.score;
    if (result.verdict.level === "benign") bucket.benign += 1;
    if (result.verdict.level === "suspicious") bucket.suspicious += 1;
    if (result.verdict.level === "malicious") bucket.malicious += 1;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const totals = Object.entries(buckets).map(([label, bucket]) => {
    const flagged = bucket.suspicious + bucket.malicious;
    return {
      label,
      total: bucket.total,
      benign: bucket.benign,
      suspicious: bucket.suspicious,
      malicious: bucket.malicious,
      flaggedRate: bucket.total ? Number((flagged / bucket.total).toFixed(3)) : 0,
      avgScore: bucket.total ? Number((bucket.scoreSum / bucket.total).toFixed(2)) : 0,
    };
  });

  console.log(JSON.stringify({ elapsedSeconds: elapsed, totals }, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
