import { advancedHeuristics } from "../../src/reputation/advanced-heuristics";

describe("Advanced Heuristics", () => {
  describe("advancedHeuristics", () => {
    it("should return zero score for benign URL", async () => {
      const result = await advancedHeuristics(
        "https://www.google.com/search?q=test",
      );

      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
      expect(result.entropy).toBeGreaterThan(0);
    });

    it("should detect high entropy in hostname", async () => {
      // Use a hostname with entropy > 4.5 (36 unique alphanumeric characters)
      const result = await advancedHeuristics(
        "https://abcdefghijklmnopqrstuvwxyz0123456789.example.com/",
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes("entropy"))).toBe(true);
    });

    it("should detect suspicious patterns (multiple hyphens)", async () => {
      // The implementation detects multiple consecutive hyphens as suspicious
      const result = await advancedHeuristics("https://example--test.com/path");

      expect(result.score).toBeGreaterThan(0);
      expect(result.suspiciousPatterns).toContain("multiple_hyphens");
    });

    it("should detect excessive subdomains", async () => {
      const result = await advancedHeuristics(
        "https://a.b.c.d.e.f.example.com/",
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.subdomainAnalysis.count).toBeGreaterThan(5);
    });

    it("should detect numeric subdomains", async () => {
      const result = await advancedHeuristics("https://123.456.example.com/");

      expect(result.score).toBeGreaterThan(0);
      expect(result.subdomainAnalysis.hasNumericSubdomains).toBe(true);
    });

    it("should detect excessive dots in URL", async () => {
      // The implementation detects excessive dots (>8) as suspicious
      const result = await advancedHeuristics(
        "https://a.b.c.d.e.f.g.h.i.example.com/",
      );

      expect(result.suspiciousPatterns).toContain("excessive_dots");
    });

    it("should detect suspicious TLDs", async () => {
      // The implementation flags suspicious TLDs like .tk, .ml, .ga, .cf, .click, .download
      const result = await advancedHeuristics("https://example.tk/path");

      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes("Suspicious TLD"))).toBe(
        true,
      );
    });

    it("should handle invalid URLs gracefully", async () => {
      const result = await advancedHeuristics("not-a-valid-url");

      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it("should detect keyboard walks", async () => {
      const result = await advancedHeuristics(
        "https://qwertyasdfgh.example.com/",
      );

      expect(result.score).toBeGreaterThan(0);
    });

    it("should analyze path entropy", async () => {
      const result = await advancedHeuristics(
        "https://example.com/xk7j9m2n4p8q1r5s3t6u9v2w5x8y1z4",
      );

      expect(result.entropy).toBeGreaterThan(0);
    });
  });
});
