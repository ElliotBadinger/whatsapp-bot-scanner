import { httpFingerprinting } from "../../src/reputation/http-fingerprint";
import { request } from "undici";

jest.mock("undici", () => ({
  request: jest.fn(),
}));

const requestMock = request as jest.MockedFunction<typeof request>;

describe("HTTP Fingerprinting", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  describe("httpFingerprinting", () => {
    it("should analyze HTTP response", async () => {
      requestMock.mockResolvedValue({
        statusCode: 200,
        headers: {
          "strict-transport-security": "max-age=31536000",
          "content-security-policy": "default-src 'self'",
          "x-frame-options": "DENY",
          "x-content-type-options": "nosniff",
          server: "nginx/1.20.0",
          "content-type": "text/html",
        },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const result = await httpFingerprinting("https://example.com/", {
        timeoutMs: 3000,
        enableSSRFGuard: true,
      });

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
      expect(result.securityHeaders).toBeDefined();
    });

    it("should handle connection timeout", async () => {
      requestMock.mockRejectedValue({
        code: "ENOTFOUND",
        message: "not found",
      });

      const result = await httpFingerprinting(
        "https://nonexistent-domain-12345.invalid/",
        {
          timeoutMs: 100,
          enableSSRFGuard: true,
        },
      );

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(0);
      expect(result.reasons).toContain("Domain not found");
    });

    it("should detect missing security headers", async () => {
      requestMock.mockResolvedValue({
        statusCode: 200,
        headers: {
          server: "apache/1.3",
          "content-type": "text/html",
        },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const result = await httpFingerprinting("http://example.com/", {
        timeoutMs: 3000,
        enableSSRFGuard: false,
      });

      expect(result).toBeDefined();
      expect(result.securityHeaders).toBeDefined();
      expect(result.reasons).toContain("Multiple security headers missing");
    });

    it("should cache results", async () => {
      const url = "https://example.com/";
      requestMock.mockResolvedValue({
        statusCode: 200,
        headers: {},
      } as unknown as Awaited<ReturnType<typeof request>>);

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
      expect(requestMock).toHaveBeenCalledTimes(2);
    });

    it("should detect suspicious redirects", async () => {
      requestMock.mockResolvedValue({
        statusCode: 302,
        headers: {
          location: "http://127.0.0.1/login",
        },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const result = await httpFingerprinting("https://example.com/", {
        timeoutMs: 3000,
        enableSSRFGuard: false,
      });

      expect(result).toBeDefined();
      expect(result.suspiciousRedirects).toBe(true);
    });

    it("should handle SSRF guard", async () => {
      const result = await httpFingerprinting("https://127.0.0.1/", {
        timeoutMs: 3000,
        enableSSRFGuard: true,
      });

      expect(result).toBeDefined();
      expect(result.reasons).toContain("URL points to private IP address");
      expect(requestMock).not.toHaveBeenCalled();
    });

    it("should flag binary content types", async () => {
      requestMock.mockResolvedValue({
        statusCode: 200,
        headers: {
          "content-type": "application/octet-stream",
        },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const result = await httpFingerprinting("https://example.com/file", {
        timeoutMs: 3000,
        enableSSRFGuard: false,
      });

      expect(result.reasons).toContain("Binary content type detected");
    });
  });
});
