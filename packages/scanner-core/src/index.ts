import {
  config,
  domainAgeDaysFromRdap,
  gsbLookup,
  logger,
  phishtankLookup,
  normalizeUrl,
  extractUrls as sharedExtractUrls,
  expandUrl,
  extraHeuristics,
  isShortener,
  scoreFromSignals,
  type RiskVerdict,
  type GsbThreatMatch,
  type Signals,
  vtAnalyzeUrl,
  vtVerdictStats,
  urlhausLookup,
  urlHash,
} from "@wbscanner/shared";
import { lookupLocalFeedSignals } from "./local-feeds";
import {
  analyzeLocalEnhancedSecurity,
  recordLocalThreatVerdict,
} from "./local-enhanced";

export type ExternalEnricherProvider =
  | "gsb"
  | "vt"
  | "urlhaus"
  | "phishtank"
  | "rdap";

export interface ScanOptions {
  followRedirects?: boolean;
  maxRedirects?: number;
  timeoutMs?: number;
  maxContentLength?: number;
  enableExternalEnrichers?: boolean;
  enableEnhancedSecurity?: boolean;
  extraSignals?: Partial<Signals>;
  /**
   * Optional hook invoked when an external enricher lookup fails.
   * Only used when `enableExternalEnrichers` is enabled.
   *
   * Failures do not stop a scan; they only reduce the set of available signals.
   * Callbacks should avoid throwing.
   */
  onExternalEnricherError?: (
    provider: ExternalEnricherProvider,
    err: unknown,
  ) => void;
}

export interface ScanResult {
  inputUrl: string;
  normalizedUrl: string;
  finalUrl: string;
  redirectChain: string[];
  verdict: RiskVerdict;
  signals: Partial<Signals> & {
    enhancedSecurityScore?: number;
    enhancedSecurityReasons?: string[];
  };
}

export function extractUrls(text: string): string[] {
  return sharedExtractUrls(text);
}

function buildHeuristicSignals(
  targetUrl: string,
  redirectCount: number,
  heuristicsOnly: boolean,
  wasShortened: boolean,
  finalUrlMismatch: boolean,
): Partial<Signals> {
  const parsed = new URL(targetUrl);
  const heuristicSignals = extraHeuristics(parsed);
  return {
    ...heuristicSignals,
    redirectCount,
    heuristicsOnly,
    wasShortened,
    finalUrlMismatch,
  };
}

function gsbThreatTypes(matches: GsbThreatMatch[]): string[] {
  return matches.map((match) => match.threatType);
}

// Rate-limit external enricher failure logs in long-lived MVP runtimes.
// This state is process-wide across all scans.
const externalErrorLogIntervalMs = 5 * 60_000;
const lastExternalErrorLogAtMs = new Map<ExternalEnricherProvider, number>();

function reportExternalEnricherError(
  provider: ExternalEnricherProvider,
  err: unknown,
  onExternalEnricherError?: ScanOptions["onExternalEnricherError"],
): void {
  if (onExternalEnricherError) {
    try {
      onExternalEnricherError(provider, err);
      return;
    } catch (callbackErr) {
      logger.warn(
        { err, provider, callbackErr },
        "External enricher error handler threw; falling back to logging",
      );
    }
  }

  const now = Date.now();
  const lastLogged = lastExternalErrorLogAtMs.get(provider) ?? 0;
  if (now - lastLogged < externalErrorLogIntervalMs) {
    return;
  }
  lastExternalErrorLogAtMs.set(provider, now);

  logger.warn({ err, provider }, "External enricher lookup failed");
}

async function buildExternalSignals(
  finalUrl: string,
  parsed: URL,
  enableExternalEnrichers: boolean,
  onExternalEnricherError?: ScanOptions["onExternalEnricherError"],
): Promise<{ signals: Partial<Signals>; usedExternalSignals: boolean }> {
  const signals: Partial<Signals> = {};
  let usedExternalSignals = false;

  if (!enableExternalEnrichers) {
    return { signals, usedExternalSignals: false };
  }

  const externalTasks: Promise<void>[] = [];

  if (config.gsb.enabled) {
    externalTasks.push(
      gsbLookup([finalUrl], config.gsb.timeoutMs)
        .then((res) => {
          usedExternalSignals = true;
          const threatTypes = gsbThreatTypes(res.matches);
          if (threatTypes.length > 0) {
            signals.gsbThreatTypes = threatTypes;
          }
        })
        .catch((err) => {
          reportExternalEnricherError("gsb", err, onExternalEnricherError);
        }),
    );
  }

  if (config.vt.enabled) {
    externalTasks.push(
      vtAnalyzeUrl(finalUrl)
        .then((analysis) => {
          usedExternalSignals = true;
          const stats = vtVerdictStats(analysis);
          if (!stats) {
            return;
          }
          signals.vtMalicious = stats.malicious;
          signals.vtSuspicious = stats.suspicious;
          signals.vtHarmless = stats.harmless;
        })
        .catch((err) => {
          reportExternalEnricherError("vt", err, onExternalEnricherError);
        }),
    );
  }

  if (config.urlhaus.enabled) {
    externalTasks.push(
      urlhausLookup(finalUrl, config.urlhaus.timeoutMs)
        .then((res) => {
          usedExternalSignals = true;
          if (res.listed) {
            signals.urlhausListed = true;
          }
        })
        .catch((err) => {
          reportExternalEnricherError("urlhaus", err, onExternalEnricherError);
        }),
    );
  }

  if (config.phishtank.enabled) {
    externalTasks.push(
      phishtankLookup(finalUrl, config.phishtank.timeoutMs)
        .then((res) => {
          usedExternalSignals = true;
          if (res.verified) {
            signals.phishtankVerified = true;
          }
        })
        .catch((err) => {
          reportExternalEnricherError(
            "phishtank",
            err,
            onExternalEnricherError,
          );
        }),
    );
  }

  if (config.rdap.enabled) {
    externalTasks.push(
      domainAgeDaysFromRdap(parsed.hostname, config.rdap.timeoutMs)
        .then((ageDays) => {
          usedExternalSignals = true;
          if (ageDays !== undefined) {
            signals.domainAgeDays = ageDays;
          }
        })
        .catch((err) => {
          reportExternalEnricherError("rdap", err, onExternalEnricherError);
        }),
    );
  }

  await Promise.all(externalTasks);

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
  const enableEnhancedSecurity =
    options.enableEnhancedSecurity ?? config.enhancedSecurity.enabled;
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
  const urlHashValue = urlHash(normalized);
  const wasShortened = isShortener(new URL(normalized).hostname);
  const finalUrlMismatch =
    wasShortened && new URL(normalized).hostname !== parsedFinal.hostname;

  const enhancedSecurityResult = enableEnhancedSecurity
    ? await analyzeLocalEnhancedSecurity(finalUrl, urlHashValue)
    : { score: 0, reasons: [], skipExternalAPIs: false };

  const external = await buildExternalSignals(
    finalUrl,
    parsedFinal,
    enableExternalEnrichers && !enhancedSecurityResult.skipExternalAPIs,
    options.onExternalEnricherError,
  );

  const localSignals = lookupLocalFeedSignals(finalUrl);

  const heuristicsOnly =
    !enableExternalEnrichers ||
    enhancedSecurityResult.skipExternalAPIs ||
    !external.usedExternalSignals;

  const signals: Signals = {
    ...buildHeuristicSignals(
      finalUrl,
      redirectChain.length,
      heuristicsOnly,
      wasShortened,
      finalUrlMismatch,
    ),
    ...external.signals,
    ...localSignals,
    ...(options.extraSignals ?? {}),
  };
  let verdict = scoreFromSignals(signals);
  if (enhancedSecurityResult.reasons.length > 0) {
    verdict = {
      ...verdict,
      reasons: Array.from(
        new Set([...verdict.reasons, ...enhancedSecurityResult.reasons]),
      ),
    };
  }
  if (
    enhancedSecurityResult.verdict === "malicious" &&
    enhancedSecurityResult.skipExternalAPIs
  ) {
    verdict = {
      ...verdict,
      level: "malicious",
    };
  }

  if (enableEnhancedSecurity) {
    const confidence = Math.min(
      1,
      (enhancedSecurityResult.score || 0) / 3.0,
    );
    await recordLocalThreatVerdict(finalUrl, verdict.level, confidence).catch(
      () => undefined,
    );
  }

  return {
    inputUrl: rawUrl,
    normalizedUrl: normalized,
    finalUrl,
    redirectChain,
    verdict,
    signals: {
      ...signals,
      enhancedSecurityScore: enhancedSecurityResult.score,
      enhancedSecurityReasons: enhancedSecurityResult.reasons,
    },
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
