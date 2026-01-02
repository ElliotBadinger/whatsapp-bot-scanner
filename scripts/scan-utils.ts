import fs from "node:fs";
import readline from "node:readline";
import type { ScanOptions, ScanResult } from "@wbscanner/scanner-core";
import { extraHeuristics, isShortener } from "@wbscanner/shared";
import type { Signals } from "@wbscanner/shared";

export type ScanEntry = {
  url: string;
  inputUrl?: string;
  finalUrl?: string;
  redirectChain?: string[];
  tags?: string[];
  metadata?: {
    domainAgeDays?: number;
  };
  signals?: Partial<Signals>;
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
  expectedByLabel: Record<string, number>;
  confusion: Record<string, Record<string, number>>;
  trickyExpected: number;
  trickyFlagged: number;
  trickyBlocked: number;
};

export type ReportEntry = {
  url: string;
  inputUrl?: string;
  finalUrl?: string;
  expected: string | null;
  actual: string;
  score: number;
  reasons: string[];
  source?: string;
  label?: string | null;
  tags?: string[];
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
  confusion: Record<string, Record<string, number>>;
  expectedByLabel: Record<string, number>;
  precisionByLabel: Record<string, number>;
  recallByLabel: Record<string, number>;
  f1ByLabel: Record<string, number>;
  flagged: {
    precision: number;
    recall: number;
    tpr: number;
    fpr: number;
  };
  tricky: {
    expected: number;
    flaggedRate: number;
    blockRate: number;
  };
} {
  const flagged = bucket.suspicious + bucket.malicious;
  const { precisionByLabel, recallByLabel, f1ByLabel } = metricsFromConfusion(
    bucket.confusion,
  );
  const flaggedMetrics = binaryMetrics(bucket.confusion, new Set([
    "suspicious",
    "malicious",
  ]));
  const trickyExpected = bucket.trickyExpected;
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
    confusion: bucket.confusion,
    expectedByLabel: bucket.expectedByLabel,
    precisionByLabel,
    recallByLabel,
    f1ByLabel,
    flagged: flaggedMetrics,
    tricky: {
      expected: trickyExpected,
      flaggedRate: trickyExpected
        ? Number((bucket.trickyFlagged / trickyExpected).toFixed(3))
        : 0,
      blockRate: trickyExpected
        ? Number((bucket.trickyBlocked / trickyExpected).toFixed(3))
        : 0,
    },
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
      expectedByLabel: {},
      confusion: {},
      trickyExpected: 0,
      trickyFlagged: 0,
      trickyBlocked: 0,
    };
  }
  return buckets[key];
}

function safeParseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function buildFixtureSignals(entry: ScanEntry): Partial<Signals> {
  const derived: Partial<Signals> = {};
  const inputUrl = entry.inputUrl ?? entry.url;
  const chain = Array.isArray(entry.redirectChain) ? entry.redirectChain : [];
  const finalUrl = entry.finalUrl ?? chain.at(-1);
  const inputParsed = safeParseUrl(inputUrl);
  const finalParsed = safeParseUrl(finalUrl);

  if (chain.length > 0) {
    derived.redirectCount = chain.length;
  }

  if (inputParsed) {
    const wasShortened = isShortener(inputParsed.hostname);
    derived.wasShortened = wasShortened;
    if (wasShortened && finalParsed && inputParsed.hostname !== finalParsed.hostname) {
      derived.finalUrlMismatch = true;
    }
  }

  if (finalParsed) {
    Object.assign(derived, extraHeuristics(finalParsed));
  }

  if (entry.metadata && isFiniteNumber(entry.metadata.domainAgeDays)) {
    derived.domainAgeDays = entry.metadata.domainAgeDays;
  }

  return { ...derived, ...(entry.signals ?? {}) };
}

function incrementConfusion(
  bucket: Bucket,
  expected: string,
  actual: string,
): void {
  if (!bucket.confusion[expected]) {
    bucket.confusion[expected] = {};
  }
  bucket.confusion[expected][actual] =
    (bucket.confusion[expected][actual] ?? 0) + 1;
}

function metricsFromConfusion(confusion: Record<string, Record<string, number>>): {
  precisionByLabel: Record<string, number>;
  recallByLabel: Record<string, number>;
  f1ByLabel: Record<string, number>;
} {
  const labels = new Set<string>();
  for (const expected of Object.keys(confusion)) {
    labels.add(expected);
    for (const actual of Object.keys(confusion[expected] ?? {})) {
      labels.add(actual);
    }
  }

  const precisionByLabel: Record<string, number> = {};
  const recallByLabel: Record<string, number> = {};
  const f1ByLabel: Record<string, number> = {};

  for (const label of labels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const expected of Object.keys(confusion)) {
      const actuals = confusion[expected] ?? {};
      for (const actual of Object.keys(actuals)) {
        const count = actuals[actual] ?? 0;
        if (expected === label && actual === label) {
          tp += count;
        } else if (expected === label && actual !== label) {
          fn += count;
        } else if (expected !== label && actual === label) {
          fp += count;
        }
      }
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    precisionByLabel[label] = Number(precision.toFixed(3));
    recallByLabel[label] = Number(recall.toFixed(3));
    f1ByLabel[label] = Number(f1.toFixed(3));
  }

  return { precisionByLabel, recallByLabel, f1ByLabel };
}

function binaryMetrics(
  confusion: Record<string, Record<string, number>>,
  positiveLabels: Set<string>,
): { precision: number; recall: number; tpr: number; fpr: number } {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const expected of Object.keys(confusion)) {
    const actuals = confusion[expected] ?? {};
    for (const actual of Object.keys(actuals)) {
      const count = actuals[actual] ?? 0;
      const expectedPositive = positiveLabels.has(expected);
      const actualPositive = positiveLabels.has(actual);

      if (expectedPositive && actualPositive) tp += count;
      if (!expectedPositive && actualPositive) fp += count;
      if (expectedPositive && !actualPositive) fn += count;
      if (!expectedPositive && !actualPositive) tn += count;
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;

  return {
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    tpr: Number(recall.toFixed(3)),
    fpr: Number(fpr.toFixed(3)),
  };
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

    const inputUrl = entry.inputUrl ?? entry.url;
    const fixtureSignals = buildFixtureSignals(entry);
    const extraSignals = {
      ...(scanOptions.extraSignals ?? {}),
      ...fixtureSignals,
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
      result = await scanFn(inputUrl, scanOptionsForEntry);
    } catch {
      bucket.skipped += 1;
      continue;
    }
    bucket.scoreSum += result.verdict.score;
    if (result.verdict.level === "benign") bucket.benign += 1;
    if (result.verdict.level === "suspicious") bucket.suspicious += 1;
    if (result.verdict.level === "malicious") bucket.malicious += 1;

    const normalizedLabel = normalizeLabel(entry.label);
    if (normalizedLabel === "tricky") {
      bucket.trickyExpected += 1;
      if (result.verdict.level !== "benign") {
        bucket.trickyFlagged += 1;
      }
      if (result.verdict.level === "malicious") {
        bucket.trickyBlocked += 1;
      }
    }

    const expected = resolveExpectedLabel(entry.label);
    if (expected) {
      bucket.labeled += 1;
      bucket.expectedByLabel[expected] =
        (bucket.expectedByLabel[expected] ?? 0) + 1;
      incrementConfusion(bucket, expected, result.verdict.level);
      if (result.verdict.level === expected) {
        bucket.correct += 1;
      } else {
        bucket.missed += 1;
        if (reportLimit && reportEntries.length < reportLimit) {
          reportEntries.push({
            url: entry.url,
            inputUrl,
            finalUrl: entry.finalUrl ?? entry.redirectChain?.at(-1),
            expected,
            actual: result.verdict.level,
            score: result.verdict.score,
            reasons: result.verdict.reasons,
            source: entry.source ?? options.sourceOverride,
            label: normalizedLabel,
            tags: entry.tags,
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
