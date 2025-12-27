import fs from "node:fs";
import readline from "node:readline";
import type { ScanOptions, ScanResult } from "@wbscanner/scanner-core";

export type ScanEntry = {
  url: string;
  label?: string;
  source?: string;
  mlLabel?: string;
  mlMaliciousScore?: number;
  mlBenignScore?: number;
  mlSource?: string;
};

export type Bucket = {
  total: number;
  labeled: number;
  benign: number;
  suspicious: number;
  malicious: number;
  scoreSum: number;
  correct: number;
  missed: number;
  skipped: number;
};

export type ReportEntry = {
  url: string;
  expected: string | null;
  actual: string;
  score: number;
  reasons: string[];
  source?: string;
  label?: string | null;
};

export type ScanGroupedOptions = {
  scanOptions?: ScanOptions;
  scanFn?: (url: string, options: ScanOptions) => Promise<ScanResult>;
  reportEntries?: ReportEntry[];
  reportLimit?: number;
  groupKey?: (entry: ScanEntry) => string;
  sourceOverride?: string;
};

function isFiniteNumber(value: number | undefined): value is number {
  return Number.isFinite(value ?? Number.NaN);
}

export function normalizeLabel(label?: string): string | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  if (!normalized) return null;
  if (["phish", "phishing", "malware", "malicious", "bad", "evil"].includes(normalized)) {
    return "malicious";
  }
  if (["benign", "legit", "legitimate", "good", "clean"].includes(normalized)) {
    return "benign";
  }
  if (["sus", "suspicious"].includes(normalized)) {
    return "suspicious";
  }
  if (["tricky", "hard"].includes(normalized)) {
    return "tricky";
  }
  if (["unknown", "unlabeled", "unlabelled"].includes(normalized)) {
    return "unknown";
  }
  if (normalized === "1") return "malicious";
  if (normalized === "0") return "benign";
  return normalized;
}

export function resolveExpectedLabel(label?: string | null): string | null {
  const normalized = normalizeLabel(label ?? undefined);
  if (!normalized || normalized === "unknown") return null;
  if (normalized === "tricky") return "suspicious";
  if (["benign", "suspicious", "malicious"].includes(normalized)) {
    return normalized;
  }
  return null;
}

export function summarizeBucket(bucket: Bucket): {
  total: number;
  labeled: number;
  benign: number;
  suspicious: number;
  malicious: number;
  flaggedRate: number;
  avgScore: number;
  accuracy: number;
  missed: number;
  skipped: number;
} {
  const flagged = bucket.suspicious + bucket.malicious;
  return {
    total: bucket.total,
    labeled: bucket.labeled,
    benign: bucket.benign,
    suspicious: bucket.suspicious,
    malicious: bucket.malicious,
    flaggedRate: bucket.total ? Number((flagged / bucket.total).toFixed(3)) : 0,
    avgScore: bucket.total
      ? Number((bucket.scoreSum / bucket.total).toFixed(2))
      : 0,
    accuracy: bucket.labeled
      ? Number((bucket.correct / bucket.labeled).toFixed(3))
      : 0,
    missed: bucket.missed,
    skipped: bucket.skipped,
  };
}

function ensureBucket(buckets: Record<string, Bucket>, key: string): Bucket {
  if (!buckets[key]) {
    buckets[key] = {
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
  }
  return buckets[key];
}

let cachedScanUrl: ((url: string, options: ScanOptions) => Promise<ScanResult>) | null =
  null;

async function defaultScanUrl(
  url: string,
  scanOptions: ScanOptions,
): Promise<ScanResult> {
  if (!cachedScanUrl) {
    const mod = await import("@wbscanner/scanner-core");
    cachedScanUrl = mod.scanUrl;
  }
  return cachedScanUrl(url, scanOptions);
}

export async function scanJsonlGrouped(
  filePath: string,
  options: ScanGroupedOptions = {},
): Promise<{ buckets: Record<string, Bucket>; elapsedSeconds: string }> {
  const start = Date.now();
  const scanFn = options.scanFn ?? defaultScanUrl;
  const scanOptions = options.scanOptions ?? {
    enableExternalEnrichers: false,
    followRedirects: false,
  };
  const reportEntries = options.reportEntries ?? [];
  const reportLimit = isFiniteNumber(options.reportLimit)
    ? options.reportLimit
    : 0;

  const stream = fs.createReadStream(filePath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const buckets: Record<string, Bucket> = {};

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: ScanEntry;
    try {
      entry = JSON.parse(trimmed) as ScanEntry;
    } catch {
      continue;
    }
    if (!entry?.url) continue;

    const groupKey =
      options.groupKey?.(entry) ?? options.sourceOverride ?? "all";
    const bucket = ensureBucket(buckets, groupKey);
    bucket.total += 1;

    const extraSignals = {
      ...(isFiniteNumber(entry.mlMaliciousScore)
        ? { mlMaliciousScore: entry.mlMaliciousScore }
        : {}),
      ...(isFiniteNumber(entry.mlBenignScore)
        ? { mlBenignScore: entry.mlBenignScore }
        : {}),
      ...(entry.mlLabel ? { mlLabel: entry.mlLabel } : {}),
      ...(entry.mlSource ? { mlSource: entry.mlSource } : {}),
    };
    const scanOptionsForEntry =
      Object.keys(extraSignals).length > 0
        ? { ...scanOptions, extraSignals }
        : scanOptions;

    let result: ScanResult | null = null;
    try {
      result = await scanFn(entry.url, scanOptionsForEntry);
    } catch {
      bucket.skipped += 1;
      continue;
    }
    bucket.scoreSum += result.verdict.score;
    if (result.verdict.level === "benign") bucket.benign += 1;
    if (result.verdict.level === "suspicious") bucket.suspicious += 1;
    if (result.verdict.level === "malicious") bucket.malicious += 1;

    const expected = resolveExpectedLabel(entry.label);
    const normalizedLabel = normalizeLabel(entry.label);
    if (expected) {
      bucket.labeled += 1;
      if (result.verdict.level === expected) {
        bucket.correct += 1;
      } else {
        bucket.missed += 1;
        if (reportLimit && reportEntries.length < reportLimit) {
          reportEntries.push({
            url: entry.url,
            expected,
            actual: result.verdict.level,
            score: result.verdict.score,
            reasons: result.verdict.reasons,
            source: entry.source ?? options.sourceOverride,
            label: normalizedLabel,
          });
        }
      }
    } else {
      bucket.skipped += 1;
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  return { buckets, elapsedSeconds: elapsed };
}
