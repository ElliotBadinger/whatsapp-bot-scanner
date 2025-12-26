import {
  config,
  domainAgeDaysFromRdap,
  getGsbProvider,
  getPhishtankProvider,
  getUrlhausProvider,
  getVirusTotalProvider,
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

function extractGsbThreatTypes(matches: unknown[]): string[] {
  return matches
    .map((match) => {
      const threatType = (match as { threatType?: unknown })?.threatType;
      return typeof threatType === "string" ? threatType : undefined;
    })
    .filter((threatType): threatType is string => !!threatType);
}

async function buildExternalSignals(
  finalUrl: string,
  parsed: URL,
  enableExternalEnrichers: boolean,
): Promise<{ signals: Partial<Signals>; usedExternalSignals: boolean }> {
  const signals: Partial<Signals> = {};

  if (!enableExternalEnrichers) {
    return { signals, usedExternalSignals: false };
  }

  const [gsbProvider, vtProvider, urlhausProvider, phishtankProvider] =
    await Promise.all([
      getGsbProvider(),
      getVirusTotalProvider(),
      getUrlhausProvider(),
      getPhishtankProvider(),
    ]);

  const externalTasks: Promise<void>[] = [];

  if (gsbProvider) {
    externalTasks.push(
      gsbProvider
        .gsbLookup([finalUrl])
        .then((res) => {
          const threatTypes = extractGsbThreatTypes(res.matches ?? []);
          if (threatTypes.length > 0) {
            signals.gsbThreatTypes = threatTypes;
          }
        })
        .catch(() => {
          // ignore provider failures; upstream can decide how to treat partial results
        }),
    );
  }

  if (vtProvider) {
    externalTasks.push(
      vtProvider
        .vtAnalyzeUrl(finalUrl)
        .then((analysis) => {
          const stats = vtProvider.vtVerdictStats(analysis);
          if (!stats) {
            return;
          }
          signals.vtMalicious = stats.malicious;
          signals.vtSuspicious = stats.suspicious;
          signals.vtHarmless = stats.harmless;
        })
        .catch(() => {
          // ignore provider failures; upstream can decide how to treat partial results
        }),
    );
  }

  if (urlhausProvider) {
    externalTasks.push(
      urlhausProvider
        .urlhausLookup(finalUrl)
        .then((res) => {
          if (res.listed) {
            signals.urlhausListed = true;
          }
        })
        .catch(() => {
          // ignore provider failures; upstream can decide how to treat partial results
        }),
    );
  }

  if (phishtankProvider) {
    externalTasks.push(
      phishtankProvider
        .phishtankLookup(finalUrl)
        .then((res) => {
          if (res.verified) {
            signals.phishtankVerified = true;
          }
        })
        .catch(() => {
          // ignore provider failures; upstream can decide how to treat partial results
        }),
    );
  }

  if (config.rdap.enabled) {
    externalTasks.push(
      domainAgeDaysFromRdap(parsed.hostname, config.rdap.timeoutMs)
        .then((ageDays) => {
          if (ageDays !== undefined) {
            signals.domainAgeDays = ageDays;
          }
        })
        .catch(() => {
          // ignore provider failures; upstream can decide how to treat partial results
        }),
    );
  }

  await Promise.all(externalTasks);

  const usedExternalSignals = Object.keys(signals).length > 0;
  return { signals, usedExternalSignals };
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
  const enableExternalEnrichers = options.enableExternalEnrichers ?? false;
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

  const parsedFinal = new URL(finalUrl);

  const external = await buildExternalSignals(
    finalUrl,
    parsedFinal,
    enableExternalEnrichers,
  );

  const heuristicsOnly =
    !enableExternalEnrichers || !external.usedExternalSignals;

  const signals: Signals = {
    ...buildHeuristicSignals(finalUrl, redirectChain.length, heuristicsOnly),
    ...external.signals,
  };
  const verdict = scoreFromSignals(signals);

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
      const index = nextIndex++;
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
