const localThreatDbMock = {
  start: jest.fn(async () => undefined),
  stop: jest.fn(async () => undefined),
  check: jest.fn(async () => ({ score: 0, reasons: [] as string[] })),
  recordVerdict: jest.fn(async () => undefined),
  getStats: jest.fn(async () => ({ openphishCount: 2, collaborativeCount: 3 })),
  updateOpenPhishFeed: jest.fn(async () => undefined),
};

jest.mock("@wbscanner/shared", () => {
  const actual = jest.requireActual("@wbscanner/shared");
  return {
    ...actual,
    config: {
      ...actual.config,
      enhancedSecurity: {
        enabled: true,
        dnsbl: { enabled: true, timeoutMs: 50 },
        localThreatDb: {
          enabled: true,
          feedUrl: "https://example.com/feed",
          updateIntervalMs: 1000,
        },
        certIntel: { enabled: true, timeoutMs: 50, ctCheckEnabled: false },
        httpFingerprint: { enabled: true, timeoutMs: 50 },
      },
    },
    dnsIntelligence: jest.fn(),
    certificateIntelligence: jest.fn(),
    advancedHeuristics: jest.fn(),
    httpFingerprinting: jest.fn(),
    LocalThreatDatabase: class {
      start = localThreatDbMock.start;
      stop = localThreatDbMock.stop;
      check = localThreatDbMock.check;
      recordVerdict = localThreatDbMock.recordVerdict;
      getStats = localThreatDbMock.getStats;
      updateOpenPhishFeed = localThreatDbMock.updateOpenPhishFeed;
    },
  };
});

import {
  config,
  dnsIntelligence,
  certificateIntelligence,
  advancedHeuristics,
  httpFingerprinting,
} from "@wbscanner/shared";
import { EnhancedSecurityAnalyzer } from "../enhanced-security";

describe("EnhancedSecurityAnalyzer", () => {
  beforeEach(() => {
    localThreatDbMock.start.mockClear();
    localThreatDbMock.stop.mockClear();
    localThreatDbMock.check.mockClear();
    localThreatDbMock.recordVerdict.mockClear();
    localThreatDbMock.getStats.mockClear();
    localThreatDbMock.updateOpenPhishFeed.mockClear();
    (dnsIntelligence as jest.Mock).mockReset();
    (certificateIntelligence as jest.Mock).mockReset();
    (advancedHeuristics as jest.Mock).mockReset();
    (httpFingerprinting as jest.Mock).mockReset();
    config.enhancedSecurity.enabled = true;
    config.enhancedSecurity.localThreatDb.enabled = true;
  });

  it("returns early when enhanced security disabled", async () => {
    config.enhancedSecurity.enabled = false;
    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");
    expect(result).toEqual({
      skipExternalAPIs: false,
      score: 0,
      reasons: [],
    });
  });

  it("returns malicious verdict on tier1 high score", async () => {
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 2.1,
      reasons: ["heuristics"],
    });
    (dnsIntelligence as jest.Mock).mockResolvedValue({
      score: 0.2,
      reasons: ["dns"],
      dnsblResults: [],
    });
    localThreatDbMock.check.mockResolvedValueOnce({
      score: 0.2,
      reasons: ["local"] as string[],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");
    expect(result.verdict).toBe("malicious");
    expect(result.skipExternalAPIs).toBe(true);
    expect(result.reasons).toContain("heuristics");
  });

  it("returns suspicious verdict on tier2 score", async () => {
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 0.3,
      reasons: ["heuristics"],
    });
    (dnsIntelligence as jest.Mock).mockResolvedValue({
      score: 0.2,
      reasons: [],
      dnsblResults: [],
    });
    localThreatDbMock.check.mockResolvedValueOnce({
      score: 0.2,
      reasons: [] as string[],
    });
    (certificateIntelligence as jest.Mock).mockResolvedValue({
      suspicionScore: 0.6,
      reasons: ["cert"],
    });
    (httpFingerprinting as jest.Mock).mockResolvedValue({
      suspicionScore: 0.6,
      reasons: ["http"],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");
    expect(result.verdict).toBe("suspicious");
    expect(result.reasons).toContain("cert");
  });

  it("handles invalid urls gracefully", async () => {
    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("not-a-url", "hash");
    expect(result).toEqual({
      skipExternalAPIs: false,
      score: 0,
      reasons: [],
    });
  });

  it("falls back when tier1 providers reject", async () => {
    (advancedHeuristics as jest.Mock).mockRejectedValue(new Error("boom"));
    (dnsIntelligence as jest.Mock).mockRejectedValue(new Error("dns"));
    localThreatDbMock.check.mockRejectedValueOnce(new Error("local"));
    (certificateIntelligence as jest.Mock).mockRejectedValue(new Error("cert"));
    (httpFingerprinting as jest.Mock).mockResolvedValue({
      suspicionScore: 0.2,
      reasons: ["http"],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");
    expect(result.verdict).toBeUndefined();
    expect(result.reasons).toContain("http");
  });

  it("returns benign result when tier2 score is below threshold", async () => {
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
    });
    (dnsIntelligence as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
      dnsblResults: [],
    });
    localThreatDbMock.check.mockResolvedValueOnce({
      score: 0.1,
      reasons: [] as string[],
    });
    (certificateIntelligence as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: ["cert"],
    });
    (httpFingerprinting as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: ["http"],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");
    expect(result.verdict).toBeUndefined();
    expect(result.tier2Results).toBeDefined();
  });

  it("records verdicts and stats when local threat db enabled", async () => {
    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    await analyzer.start();
    expect(localThreatDbMock.start).toHaveBeenCalled();

    await analyzer.recordVerdict("https://example.com", "benign", 0.2);
    expect(localThreatDbMock.recordVerdict).toHaveBeenCalled();

    const stats = await analyzer.getStats();
    expect(stats).toEqual({ openphishCount: 2, collaborativeCount: 3 });

    await analyzer.updateFeeds();
    expect(localThreatDbMock.updateOpenPhishFeed).toHaveBeenCalled();

    await analyzer.stop();
    expect(localThreatDbMock.stop).toHaveBeenCalled();
  });

  it("skips local threat db interactions when disabled", async () => {
    config.enhancedSecurity.localThreatDb.enabled = false;
    const analyzer = new EnhancedSecurityAnalyzer({} as any);

    await analyzer.recordVerdict("https://example.com", "benign", 0.2);
    expect(localThreatDbMock.recordVerdict).not.toHaveBeenCalled();

    const stats = await analyzer.getStats();
    expect(stats).toEqual({ openphishCount: 0, collaborativeCount: 0 });

    await analyzer.updateFeeds();
    expect(localThreatDbMock.updateOpenPhishFeed).not.toHaveBeenCalled();
  });

  it("skips cert intel for non-HTTPS URLs", async () => {
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
    });
    (dnsIntelligence as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
      dnsblResults: [],
    });
    localThreatDbMock.check.mockResolvedValueOnce({
      score: 0.1,
      reasons: [] as string[],
    });
    (httpFingerprinting as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: [],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("http://example.com", "hash");

    expect(certificateIntelligence).not.toHaveBeenCalled();
    expect(result.tier2Results?.certIntel).toBeDefined();
    expect(result.tier2Results?.certIntel.isValid).toBe(true);
  });

  it("uses fallback values when dnsbl is disabled", async () => {
    config.enhancedSecurity.dnsbl.enabled = false;
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
    });
    localThreatDbMock.check.mockResolvedValueOnce({
      score: 0.1,
      reasons: [] as string[],
    });
    (certificateIntelligence as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: [],
    });
    (httpFingerprinting as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: [],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");

    expect(dnsIntelligence).not.toHaveBeenCalled();
    expect(result.tier1Results?.dnsIntel).toBeDefined();
  });

  it("uses fallback values when certIntel is disabled", async () => {
    config.enhancedSecurity.certIntel.enabled = false;
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
    });
    (dnsIntelligence as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
      dnsblResults: [],
    });
    localThreatDbMock.check.mockResolvedValueOnce({
      score: 0.1,
      reasons: [] as string[],
    });
    (httpFingerprinting as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: [],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");

    expect(certificateIntelligence).not.toHaveBeenCalled();
    expect(result.tier2Results?.certIntel.issuer).toBe("unknown");
  });

  it("uses fallback values when httpFingerprint is disabled", async () => {
    config.enhancedSecurity.httpFingerprint.enabled = false;
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
    });
    (dnsIntelligence as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
      dnsblResults: [],
    });
    localThreatDbMock.check.mockResolvedValueOnce({
      score: 0.1,
      reasons: [] as string[],
    });
    (certificateIntelligence as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: [],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");

    expect(httpFingerprinting).not.toHaveBeenCalled();
    expect(result.tier2Results?.httpFingerprint.statusCode).toBe(0);
  });

  it("handles tier2 provider rejections with fallback data", async () => {
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
    });
    (dnsIntelligence as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
      dnsblResults: [],
    });
    localThreatDbMock.check.mockResolvedValueOnce({
      score: 0.1,
      reasons: [] as string[],
    });
    (certificateIntelligence as jest.Mock).mockRejectedValue(
      new Error("cert error"),
    );
    (httpFingerprinting as jest.Mock).mockRejectedValue(
      new Error("http error"),
    );

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");

    expect(result.tier2Results?.certIntel.isValid).toBe(true);
    expect(result.tier2Results?.httpFingerprint.statusCode).toBe(0);
  });

  it("does not start local threat db when enhanced security disabled", async () => {
    config.enhancedSecurity.enabled = false;
    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    await analyzer.start();
    expect(localThreatDbMock.start).not.toHaveBeenCalled();
  });

  it("uses fallback values when localThreatDb is disabled during analyze", async () => {
    config.enhancedSecurity.localThreatDb.enabled = false;
    (advancedHeuristics as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
    });
    (dnsIntelligence as jest.Mock).mockResolvedValue({
      score: 0.1,
      reasons: [],
      dnsblResults: [],
    });
    (certificateIntelligence as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: [],
    });
    (httpFingerprinting as jest.Mock).mockResolvedValue({
      suspicionScore: 0.1,
      reasons: [],
    });

    const analyzer = new EnhancedSecurityAnalyzer({} as any);
    const result = await analyzer.analyze("https://example.com", "hash");

    expect(localThreatDbMock.check).not.toHaveBeenCalled();
    expect(result.tier1Results?.localThreats).toEqual({
      score: 0,
      reasons: [],
    });
  });

  describe("Tier 1 threshold boundary tests (mutation testing)", () => {
    it("tier1Score exactly 2.0 should NOT trigger malicious verdict (> boundary)", async () => {
      (advancedHeuristics as jest.Mock).mockResolvedValue({
        score: 2.0,
        reasons: ["heuristics"],
        entropy: 0,
        subdomainAnalysis: {
          count: 0,
          maxDepth: 0,
          hasNumericSubdomains: false,
          suspicionScore: 0,
        },
        suspiciousPatterns: [],
      });
      (dnsIntelligence as jest.Mock).mockResolvedValue({
        score: 0,
        reasons: [],
        dnsblResults: [],
      });
      localThreatDbMock.check.mockResolvedValueOnce({
        score: 0,
        reasons: [] as string[],
      });
      (certificateIntelligence as jest.Mock).mockResolvedValue({
        suspicionScore: 0.0,
        reasons: [],
      });
      (httpFingerprinting as jest.Mock).mockResolvedValue({
        suspicionScore: 0.0,
        reasons: [],
      });

      const analyzer = new EnhancedSecurityAnalyzer({} as any);
      const result = await analyzer.analyze("https://example.com", "hash");

      expect(result.score).toBe(2.0);
      expect(result.verdict).not.toBe("malicious");
      expect(result.skipExternalAPIs).toBe(false);
    });

    it("tier1Score exactly 2.01 should trigger malicious verdict (> boundary)", async () => {
      (advancedHeuristics as jest.Mock).mockResolvedValue({
        score: 2.01,
        reasons: ["heuristics"],
        entropy: 0,
        subdomainAnalysis: {
          count: 0,
          maxDepth: 0,
          hasNumericSubdomains: false,
          suspicionScore: 0,
        },
        suspiciousPatterns: [],
      });
      (dnsIntelligence as jest.Mock).mockResolvedValue({
        score: 0,
        reasons: [],
        dnsblResults: [],
      });
      localThreatDbMock.check.mockResolvedValueOnce({
        score: 0,
        reasons: [] as string[],
      });

      const analyzer = new EnhancedSecurityAnalyzer({} as any);
      const result = await analyzer.analyze("https://example.com", "hash");

      expect(result.score).toBeGreaterThan(2.0);
      expect(result.verdict).toBe("malicious");
      expect(result.confidence).toBe("high");
      expect(result.skipExternalAPIs).toBe(true);
    });

    it("tier1Score 2.1 triggers malicious with high confidence", async () => {
      (advancedHeuristics as jest.Mock).mockResolvedValue({
        score: 2.1,
        reasons: ["entropy"],
        entropy: 0,
        subdomainAnalysis: {
          count: 0,
          maxDepth: 0,
          hasNumericSubdomains: false,
          suspicionScore: 0,
        },
        suspiciousPatterns: [],
      });
      (dnsIntelligence as jest.Mock).mockResolvedValue({
        score: 0,
        reasons: [],
        dnsblResults: [],
      });
      localThreatDbMock.check.mockResolvedValueOnce({
        score: 0,
        reasons: [] as string[],
      });

      const analyzer = new EnhancedSecurityAnalyzer({} as any);
      const result = await analyzer.analyze("https://example.com", "hash");

      expect(result.verdict).toBe("malicious");
      expect(result.confidence).toBe("high");
      expect(result.skipExternalAPIs).toBe(true);
      expect(result.score).toBeGreaterThan(2.0);
    });

    it("tier1Score 2.5 triggers malicious (mutation boundary for 2.0 vs 2.5)", async () => {
      (advancedHeuristics as jest.Mock).mockResolvedValue({
        score: 2.5,
        reasons: ["high entropy"],
        entropy: 0,
        subdomainAnalysis: {
          count: 0,
          maxDepth: 0,
          hasNumericSubdomains: false,
          suspicionScore: 0,
        },
        suspiciousPatterns: [],
      });
      (dnsIntelligence as jest.Mock).mockResolvedValue({
        score: 0,
        reasons: [],
        dnsblResults: [],
      });
      localThreatDbMock.check.mockResolvedValueOnce({
        score: 0,
        reasons: [] as string[],
      });

      const analyzer = new EnhancedSecurityAnalyzer({} as any);
      const result = await analyzer.analyze("https://example.com", "hash");

      expect(result.verdict).toBe("malicious");
      expect(result.score).toBe(2.5);
    });
  });
});
