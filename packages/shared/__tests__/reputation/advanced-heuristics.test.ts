import { advancedHeuristics } from "../../src/reputation/advanced-heuristics";

describe("Advanced Heuristics", () => {
  describe("advancedHeuristics", () => {
    it("should return zero score for benign URL", () => {
      const result = advancedHeuristics("https://www.google.com/search?q=test");

      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
      expect(result.entropy).toBeGreaterThan(0);
    });

    it("should detect high entropy in hostname", () => {
      const result = advancedHeuristics(
        "https://xk7j9m2n4p8q1r5s.example.com/",
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes("entropy"))).toBe(true);
    });

    it("should detect suspicious patterns", () => {
      const result = advancedHeuristics(
        "https://example.com/wp-admin/abcdefghijklmnopqrstuvwxyz123456",
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.suspiciousPatterns.length).toBeGreaterThan(0);
    });

    it("should detect excessive subdomains", () => {
      const result = advancedHeuristics("https://a.b.c.d.e.f.example.com/");

      expect(result.score).toBeGreaterThan(0);
      expect(result.subdomainAnalysis.count).toBeGreaterThan(5);
    });

    it("should detect numeric subdomains", () => {
      const result = advancedHeuristics("https://123.456.example.com/");

      expect(result.score).toBeGreaterThan(0);
      expect(result.subdomainAnalysis.hasNumericSubdomains).toBe(true);
    });

    it("should detect IP addresses in URL", () => {
      const result = advancedHeuristics(
        "https://example.com/redirect?url=192.168.1.1",
      );

      expect(
        result.suspiciousPatterns.some((p) => p.includes("IP address")),
      ).toBe(true);
    });

    it("should detect phishing patterns", () => {
      const result = advancedHeuristics(
        "https://example.com/verify-account-abcdefghijklmnopqrstuvwxyz123456",
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.suspiciousPatterns.length).toBeGreaterThan(0);
    });

    it("should handle invalid URLs gracefully", () => {
      const result = advancedHeuristics("not-a-valid-url");

      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it("should detect keyboard walks", () => {
      const result = advancedHeuristics("https://qwertyasdfgh.example.com/");

      expect(result.score).toBeGreaterThan(0);
    });

    it("should analyze path entropy", () => {
      const result = advancedHeuristics(
        "https://example.com/xk7j9m2n4p8q1r5s3t6u9v2w5x8y1z4",
      );

      expect(result.entropy).toBeGreaterThan(0);
    });
  });
});
