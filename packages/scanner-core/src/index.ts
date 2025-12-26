import {
  normalizeUrl,
  extractUrls as sharedExtractUrls,
  expandUrl,
  extraHeuristics,
  scoreFromSignals,
  type RiskVerdict,
  type Signals,
} from "@wbscanner/shared";

export interface ScanOptions {
  followRedirects?: boolean;
  maxRedirects?: number;
  timeoutMs?: number;
  maxContentLength?: number;
  enableExternalEnrichers?: boolean;
}

export interface ScanResult {
  inputUrl: string;
  normalizedUrl: string;
  finalUrl: string;
  redirectChain: string[];
  verdict: RiskVerdict;
  signals: Partial<Signals>;
}

export function extractUrls(text: string): string[] {
  return sharedExtractUrls(text);
}

function buildHeuristicSignals(
  targetUrl: string,
  redirectCount: number,
  heuristicsOnly: boolean,
): Partial<Signals> {
  const parsed = new URL(targetUrl);
  const heuristicSignals = extraHeuristics(parsed);
  return {
    ...heuristicSignals,
    redirectCount,
    heuristicsOnly,
  };
}

export async function scanUrl(
  rawUrl: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    throw new Error("Invalid URL provided to scanUrl");
  }

  const followRedirects = options.followRedirects ?? false;
  const heuristicsOnly = !(options.enableExternalEnrichers ?? false);
  let finalUrl = normalized;
  let redirectChain: string[] = [];

  if (followRedirects) {
    const expanded = await expandUrl(normalized, {
      maxRedirects: options.maxRedirects ?? 3,
      timeoutMs: options.timeoutMs ?? 4000,
      maxContentLength: options.maxContentLength ?? 0,
    });
    finalUrl = expanded.finalUrl;
    redirectChain = expanded.chain;
  }

  const signals = buildHeuristicSignals(
    finalUrl,
    redirectChain.length,
    heuristicsOnly,
  );
  const verdict = scoreFromSignals(signals as Signals);

  return {
    inputUrl: rawUrl,
    normalizedUrl: normalized,
    finalUrl,
    redirectChain,
    verdict,
    signals,
  };
}

export interface ScanTextMessageInput {
  text: string;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  if (concurrency <= 0) {
    throw new Error("concurrency must be at least 1");
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);

  return results;
}

export async function scanTextMessage(
  payload: ScanTextMessageInput,
  options?: ScanOptions,
): Promise<ScanResult[]> {
  const urls = extractUrls(payload.text);
  const normalized = urls
    .map((url) => normalizeUrl(url))
    .filter((url): url is string => !!url);
  const deduped = Array.from(new Set(normalized));

  return await mapWithConcurrency(
    deduped,
    Math.min(deduped.length, 4),
    async (url) => await scanUrl(url, options),
  );
}
