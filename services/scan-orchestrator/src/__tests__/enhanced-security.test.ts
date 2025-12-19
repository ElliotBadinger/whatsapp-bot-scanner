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
});
