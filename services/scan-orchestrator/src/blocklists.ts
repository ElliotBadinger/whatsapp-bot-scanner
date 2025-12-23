import { logger, metrics } from "@wbscanner/shared";
import type { GsbThreatMatch, PhishtankLookupResult } from "@wbscanner/shared";

export interface GsbFetchResult {
  matches: GsbThreatMatch[];
  fromCache: boolean;
  durationMs: number;
  error: Error | null;
}

export interface PhishtankFetchResult {
  result: PhishtankLookupResult | null;
  fromCache: boolean;
  error: Error | null;
}

export interface PhishtankDecisionInput {
  gsbHit: boolean;
  gsbError: Error | null;
  gsbDurationMs: number;
  gsbFromCache: boolean;
  fallbackLatencyMs: number;
  gsbApiKeyPresent: boolean;
  phishtankEnabled: boolean;
}

/**
* Decide whether to query Phishtank as a redundancy fallback.
*
* Policy:
* - If Phishtank is disabled -> never query.
* - If GSB has no matches -> query.
* - If GSB matched but errored -> query (treat as a fallback scenario).
* - If the GSB API key is missing -> query.
* - If GSB wasn't cached and exceeded the latency budget -> query.
*/
export function shouldQueryPhishtank({
  gsbHit,
  gsbError,
  gsbDurationMs,
  gsbFromCache,
  fallbackLatencyMs,
  gsbApiKeyPresent,
  phishtankEnabled,
}: PhishtankDecisionInput): boolean {
  if (!phishtankEnabled) return false;
  if (!gsbHit) return true;
  // If GSB errored while returning a hit, run Phishtank as a redundancy fallback.
  if (gsbError) return true;
  if (!gsbApiKeyPresent) return true;
  if (!gsbFromCache && gsbDurationMs > fallbackLatencyMs) return true;
  return false;
}

export interface BlocklistCheckOptions {
  finalUrl: string;
  hash: string;
  fallbackLatencyMs: number;
  gsbApiKeyPresent: boolean;
  phishtankEnabled: boolean;
  fetchGsbAnalysis(finalUrl: string, hash: string): Promise<GsbFetchResult>;
  fetchPhishtank(finalUrl: string, hash: string): Promise<PhishtankFetchResult>;
}

export interface BlocklistCheckResult {
  gsbMatches: GsbThreatMatch[];
  gsbResult: GsbFetchResult;
  phishtankResult: PhishtankLookupResult | null;
  phishtankNeeded: boolean;
  phishtankError: Error | null;
}

export async function checkBlocklistsWithRedundancy({
  finalUrl,
  hash,
  fallbackLatencyMs,
  gsbApiKeyPresent,
  phishtankEnabled,
  fetchGsbAnalysis,
  fetchPhishtank,
}: BlocklistCheckOptions): Promise<BlocklistCheckResult> {
  const gsbResult = await fetchGsbAnalysis(finalUrl, hash);
  const gsbMatches = gsbResult.matches;
  const gsbHit = gsbMatches.length > 0;

  // Guarantee a Phishtank lookup whenever GSB returns clean and the
  // integration is enabled. The helper still handles fallback scenarios
  // (timeouts, missing API key, latency) when GSB did return a match.
  const phishtankNeeded = !gsbHit
    ? phishtankEnabled
    : shouldQueryPhishtank({
        gsbHit,
        gsbError: gsbResult.error,
        gsbDurationMs: gsbResult.durationMs,
        gsbFromCache: gsbResult.fromCache,
        fallbackLatencyMs,
        gsbApiKeyPresent,
        phishtankEnabled,
      });

  let phishtankResult: PhishtankLookupResult | null = null;
  let phishtankError: Error | null = null;

  if (phishtankNeeded) {
    const logContext = {
      urlHash: hash,
      url: finalUrl,
      gsbMatches: gsbMatches.length,
      gsbLatencyMs: gsbResult.durationMs,
      gsbFromCache: gsbResult.fromCache,
    };
    if (!gsbHit) {
      logger.info(
        logContext,
        "GSB clean -> running Phishtank redundancy check",
      );
    } else {
      logger.info(
        {
          ...logContext,
          gsbError: gsbResult.error ? gsbResult.error.message : undefined,
        },
        "GSB fallback -> running Phishtank redundancy check",
      );
    }

    metrics.phishtankSecondaryChecks.inc();
    const phishResponse = await fetchPhishtank(finalUrl, hash);
    phishtankResult = phishResponse.result;
    phishtankError = phishResponse.error ?? null;

    if (phishResponse.result?.inDatabase) {
      metrics.phishtankSecondaryHits
        .labels(phishResponse.result.verified ? "true" : "false")
        .inc();
    }
  } else if (gsbHit) {
    logger.info(
      { urlHash: hash, url: finalUrl, gsbMatches: gsbMatches.length },
      "GSB found threats -> skipping Phishtank redundancy check",
    );
  } else if (!phishtankEnabled) {
    logger.info(
      { urlHash: hash, url: finalUrl },
      "Phishtank disabled -> skipping redundancy check for clean GSB result",
    );
  }

  return {
    gsbMatches,
    gsbResult,
    phishtankResult,
    phishtankNeeded,
    phishtankError,
  };
}
