import { describe, expect, it, vi } from "vitest";
import {
  checkBlocklistsWithRedundancy,
  type BlocklistCheckOptions,
  type GsbFetchResult,
  type PhishtankFetchResult,
} from "../../services/scan-orchestrator/src/blocklists";
import type { GsbThreatMatch, PhishtankLookupResult } from "@wbscanner/shared";

const baseOptions = {
  finalUrl: "https://example.test/suspicious",
  hash: "abc123",
  fallbackLatencyMs: 500,
  gsbApiKeyPresent: true,
  phishtankEnabled: true,
} as const;

type FetchGsbAnalysis = BlocklistCheckOptions["fetchGsbAnalysis"];
type FetchPhishtank = BlocklistCheckOptions["fetchPhishtank"];

describe("checkBlocklistsWithRedundancy integration", () => {
  it("runs Phishtank redundancy when GSB is clean", async () => {
    const gsbResult: GsbFetchResult = {
      matches: [],
      fromCache: false,
      durationMs: 120,
      error: null,
    };
    const phishtankPayload: PhishtankFetchResult = {
      result: { inDatabase: false, verified: false, latencyMs: 40 },
      fromCache: false,
      error: null,
    };

    const fetchGsbAnalysis = vi
      .fn<Parameters<FetchGsbAnalysis>, ReturnType<FetchGsbAnalysis>>()
      .mockResolvedValue(gsbResult);
    const fetchPhishtank = vi
      .fn<Parameters<FetchPhishtank>, ReturnType<FetchPhishtank>>()
      .mockResolvedValue(phishtankPayload);

    const result = await checkBlocklistsWithRedundancy({
      ...baseOptions,
      fetchGsbAnalysis,
      fetchPhishtank,
    });

    expect(fetchGsbAnalysis).toHaveBeenCalledTimes(1);
    expect(fetchGsbAnalysis).toHaveBeenCalledWith(
      baseOptions.finalUrl,
      baseOptions.hash,
    );
    expect(fetchPhishtank).toHaveBeenCalledTimes(1);
    expect(fetchPhishtank).toHaveBeenCalledWith(
      baseOptions.finalUrl,
      baseOptions.hash,
    );

    expect(result.phishtankNeeded).toBe(true);
    expect(result.gsbMatches).toHaveLength(0);
    expect(result.gsbResult).toBe(gsbResult);
    expect(result.phishtankResult).toEqual(phishtankPayload.result);
  });

  it("skips Phishtank when GSB finds a threat", async () => {
    const threatMatch: GsbThreatMatch = {
      threatType: "MALWARE",
      platformType: "ANY_PLATFORM",
      threatEntryType: "URL",
      threat: baseOptions.finalUrl,
    };
    const gsbResult: GsbFetchResult = {
      matches: [threatMatch],
      fromCache: false,
      durationMs: 110,
      error: null,
    };

    const fetchGsbAnalysis = vi
      .fn<Parameters<FetchGsbAnalysis>, ReturnType<FetchGsbAnalysis>>()
      .mockResolvedValue(gsbResult);
    const fetchPhishtank = vi.fn<
      Parameters<FetchPhishtank>,
      ReturnType<FetchPhishtank>
    >();

    const result = await checkBlocklistsWithRedundancy({
      ...baseOptions,
      fetchGsbAnalysis,
      fetchPhishtank,
    });

    expect(fetchGsbAnalysis).toHaveBeenCalledTimes(1);
    expect(fetchPhishtank).not.toHaveBeenCalled();

    expect(result.phishtankNeeded).toBe(false);
    expect(result.gsbMatches).toEqual([threatMatch]);
    expect(result.phishtankResult).toBeNull();
  });

  it("falls back to Phishtank when GSB errors", async () => {
    const gsbError = new Error("GSB timeout");
    const gsbResult: GsbFetchResult = {
      matches: [],
      fromCache: false,
      durationMs: 800,
      error: gsbError,
    };
    const phishResult: PhishtankLookupResult = {
      inDatabase: true,
      verified: false,
      latencyMs: 90,
    };
    const phishtankPayload: PhishtankFetchResult = {
      result: phishResult,
      fromCache: false,
      error: null,
    };

    const fetchGsbAnalysis = vi
      .fn<Parameters<FetchGsbAnalysis>, ReturnType<FetchGsbAnalysis>>()
      .mockResolvedValue(gsbResult);
    const fetchPhishtank = vi
      .fn<Parameters<FetchPhishtank>, ReturnType<FetchPhishtank>>()
      .mockResolvedValue(phishtankPayload);

    const result = await checkBlocklistsWithRedundancy({
      ...baseOptions,
      fetchGsbAnalysis,
      fetchPhishtank,
    });

    expect(fetchGsbAnalysis).toHaveBeenCalledTimes(1);
    expect(fetchPhishtank).toHaveBeenCalledTimes(1);

    expect(result.phishtankNeeded).toBe(true);
    expect(result.gsbMatches).toEqual([]);
    expect(result.gsbResult.error).toBe(gsbError);
    expect(result.phishtankResult).toEqual(phishResult);
  });
});
