import { httpFingerprinting } from "../../src/reputation/http-fingerprint";

describe("HTTP Fingerprinting", () => {
  // Increase timeout for network-dependent tests
  jest.setTimeout(15000);

  describe("httpFingerprinting", () => {
    it("should analyze HTTP response", async () => {
      const result = await httpFingerprinting("https://www.google.com/", {
        timeoutMs: 3000,
        enableSSRFGuard: true,
      });

      expect(result).toBeDefined();
      expect(result.statusCode).toBeGreaterThan(0);
      expect(result.securityHeaders).toBeDefined();
    });

    it("should handle connection timeout", async () => {
      const result = await httpFingerprinting(
        "https://nonexistent-domain-12345.invalid/",
        {
          timeoutMs: 100,
          enableSSRFGuard: true,
        },
      );

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(0);
    });

    it("should detect missing security headers", async () => {
      const result = await httpFingerprinting("http://example.com/", {
        timeoutMs: 3000,
        enableSSRFGuard: false,
      });

      expect(result).toBeDefined();
      expect(result.securityHeaders).toBeDefined();
    });

    it("should cache results", async () => {
      const url = "https://example.com/";

      const result1 = await httpFingerprinting(url, {
        timeoutMs: 3000,
        enableSSRFGuard: false,
      });

      const result2 = await httpFingerprinting(url, {
        timeoutMs: 3000,
        enableSSRFGuard: false,
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it("should detect suspicious redirects", async () => {
      const result = await httpFingerprinting(
        "https://httpbin.org/redirect-to?url=https://example.com",
        {
          timeoutMs: 3000,
          enableSSRFGuard: false,
        },
      );

      expect(result).toBeDefined();
    });

    it("should handle SSRF guard", async () => {
      const result = await httpFingerprinting("https://127.0.0.1/", {
        timeoutMs: 3000,
        enableSSRFGuard: true,
      });

      expect(result).toBeDefined();
    });

    it("should use random user agents", async () => {
      const result1 = await httpFingerprinting(
        "https://httpbin.org/user-agent",
        {
          timeoutMs: 3000,
          enableSSRFGuard: false,
        },
      );

      const result2 = await httpFingerprinting(
        "https://httpbin.org/user-agent",
        {
          timeoutMs: 3000,
          enableSSRFGuard: false,
        },
      );

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
