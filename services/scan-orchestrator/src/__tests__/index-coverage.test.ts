import { __testables } from "../index";
import { InMemoryRedis, config } from "@wbscanner/shared";

jest.mock("../blocklists", () => ({
  __esModule: true,
  checkBlocklistsWithRedundancy: jest.fn(),
  shouldQueryPhishtank: jest.fn(),
}));

jest.setTimeout(15000);

const {
  getCachedVerdict,
  handleCachedVerdict,
  performBlocklistChecks,
  generateVerdict,
  recordQueueMetrics,
  recordVerdictMetrics,
  setRedisForTests,
} = __testables;

describe("scan-orchestrator index coverage", () => {
  beforeEach(() => {
    setRedisForTests(new InMemoryRedis() as any);
    config.urlscan.enabled = false;
    config.urlscan.apiKey = "";
    config.urlhaus.enabled = false;
  });

  it("reads cached verdicts and handles cache misses", async () => {
    const redis = new InMemoryRedis() as any;
    setRedisForTests(redis);

    const miss = await getCachedVerdict("scan:missing");
    expect(miss).toBeNull();

    await redis.set(
      "scan:hit",
      JSON.stringify({
        verdict: "benign",
        score: 1,
        reasons: ["reason-a"],
        cacheTtl: 300,
        decidedAt: 123,
      }),
      "EX",
      300,
    );

    const hit = await getCachedVerdict("scan:hit");
    expect(hit?.verdict).toBe("benign");
  });

  it("handles cached verdicts without chat context", async () => {
    await handleCachedVerdict(
      {
        verdict: "benign",
        score: 1,
        reasons: [],
      },
      undefined,
      undefined,
      false,
      Date.now(),
      "scan-request",
      Date.now(),
      1,
      "https://example.com",
      false,
      "job-1",
    );
  });

  it("performs blocklist checks with overrides and urlhaus consult", async () => {
    const { checkBlocklistsWithRedundancy } = await import("../blocklists");
    (checkBlocklistsWithRedundancy as jest.Mock).mockResolvedValue({
      gsbMatches: [],
      gsbResult: { error: null },
      phishtankResult: { verified: false },
      phishtankNeeded: true,
      phishtankError: null,
    });

    const dbClient = {
      query: jest.fn(async () => ({ rows: [{ status: "deny" }] })),
    };

    const result = await performBlocklistChecks(
      "https://example.com",
      new URL("https://example.com"),
      "hash1",
      dbClient as any,
    );

    expect(result.manualOverride).toBe("deny");
    expect(result.urlhausConsulted).toBe(true);
  });

  it("generates verdicts with degraded mode and metrics coverage", async () => {
    const externalResults = {
      blocklistResult: {
        gsbMatches: [],
        gsbResult: { error: new Error("gsb down") },
        phishtankResult: { verified: false },
        phishtankNeeded: true,
        phishtankError: new Error("phishtank down"),
      },
      domainIntel: { source: "none" as const },
      manualOverride: "deny",
      vtStats: undefined,
      vtQuotaExceeded: true,
      vtError: new Error("vt down"),
      urlhausResult: null,
      urlhausError: new Error("urlhaus down"),
      urlhausConsulted: true,
    };

    const verdictResult = await generateVerdict(
      externalResults as any,
      "https://example.com",
      "hash1",
      ["https://example.com"],
      false,
      false,
      { detected: false, riskLevel: "low", confusableChars: [] } as any,
      { suspiciousTld: true },
      {
        verdict: "benign",
        confidence: "low",
        score: 1,
        reasons: ["heuristic"],
        skipExternalAPIs: false,
      },
      null,
    );

    expect(verdictResult.degradedMode?.providers.length).toBeGreaterThan(0);
    expect(verdictResult.enqueuedUrlscan).toBe(false);

    recordVerdictMetrics(
      verdictResult.score,
      verdictResult.reasons,
      "benign",
      verdictResult.verdict,
      [],
      false,
      { listed: true } as any,
      { malicious: 1, suspicious: 0, harmless: 1 } as any,
      true,
      true,
      ["https://example.com"],
      { detected: true, riskLevel: "high", confusableChars: [] } as any,
      5,
      "deny",
    );
  });

  it("records queue metrics for retries", () => {
    recordQueueMetrics("scan-request", Date.now() - 2000, 2);
  });
});
