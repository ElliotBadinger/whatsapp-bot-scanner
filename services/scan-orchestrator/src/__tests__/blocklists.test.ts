import { checkBlocklistsWithRedundancy } from "../blocklists";

jest.mock("@wbscanner/shared", () => ({
  logger: {
    info: jest.fn(),
  },
  metrics: {
    phishtankSecondaryChecks: { inc: jest.fn() },
    phishtankSecondaryHits: { labels: jest.fn(() => ({ inc: jest.fn() })) },
  },
}));

describe("blocklists redundancy", () => {
  it("queries Phishtank when GSB is clean", async () => {
    const fetchGsbAnalysis = jest.fn().mockResolvedValue({
      matches: [],
      fromCache: false,
      durationMs: 50,
      error: null,
    });
    const fetchPhishtank = jest.fn().mockResolvedValue({
      result: { inDatabase: true, verified: true },
      fromCache: false,
      error: null,
    });

    const result = await checkBlocklistsWithRedundancy({
      finalUrl: "https://example.com",
      hash: "hash",
      fallbackLatencyMs: 500,
      gsbApiKeyPresent: true,
      phishtankEnabled: true,
      fetchGsbAnalysis,
      fetchPhishtank,
    });

    expect(result.phishtankNeeded).toBe(true);
    expect(fetchPhishtank).toHaveBeenCalled();
    expect(result.phishtankResult?.inDatabase).toBe(true);
  });

  it("skips Phishtank when disabled and GSB hits", async () => {
    const fetchGsbAnalysis = jest.fn().mockResolvedValue({
      matches: [
        {
          threatType: "MALWARE",
          platformType: "ANY_PLATFORM",
          threatEntryType: "URL",
          threat: { url: "https://example.com" },
        },
      ],
      fromCache: true,
      durationMs: 10,
      error: null,
    });
    const fetchPhishtank = jest.fn();

    const result = await checkBlocklistsWithRedundancy({
      finalUrl: "https://example.com",
      hash: "hash",
      fallbackLatencyMs: 500,
      gsbApiKeyPresent: true,
      phishtankEnabled: false,
      fetchGsbAnalysis,
      fetchPhishtank,
    });

    expect(result.phishtankNeeded).toBe(false);
    expect(fetchPhishtank).not.toHaveBeenCalled();
  });

  it("queries Phishtank on GSB fallback scenarios", async () => {
    const fetchGsbAnalysis = jest.fn().mockResolvedValue({
      matches: [
        {
          threatType: "SOCIAL_ENGINEERING",
          platformType: "ANY_PLATFORM",
          threatEntryType: "URL",
          threat: { url: "https://example.com" },
        },
      ],
      fromCache: false,
      durationMs: 700,
      error: new Error("timeout"),
    });
    const fetchPhishtank = jest.fn().mockResolvedValue({
      result: { inDatabase: false, verified: false },
      fromCache: false,
      error: null,
    });

    const result = await checkBlocklistsWithRedundancy({
      finalUrl: "https://example.com",
      hash: "hash",
      fallbackLatencyMs: 500,
      gsbApiKeyPresent: false,
      phishtankEnabled: true,
      fetchGsbAnalysis,
      fetchPhishtank,
    });

    expect(result.phishtankNeeded).toBe(true);
    expect(fetchPhishtank).toHaveBeenCalled();
  });
});
