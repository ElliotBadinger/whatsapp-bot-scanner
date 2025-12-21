import Fastify, { FastifyInstance } from "fastify";
import {
  registerSecurityHeaders,
  getDefaultSecurityHeaders,
} from "../src/fastify/security-headers";

describe("Security Headers", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("registerSecurityHeaders", () => {
    it("should add default security headers to responses", async () => {
      registerSecurityHeaders(app);
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.headers["content-security-policy"]).toBeDefined();
      expect(response.headers["strict-transport-security"]).toBeUndefined();
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
      expect(response.headers["referrer-policy"]).toBeDefined();
      expect(response.headers["permissions-policy"]).toBeDefined();
    });

    it("should only set HSTS for secure requests", async () => {
      registerSecurityHeaders(app, { trustForwardedProto: true });
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
        headers: {
          "x-forwarded-proto": "https",
        },
      });

      expect(response.headers["strict-transport-security"]).toBeDefined();
    });

    it("should treat the first x-forwarded-proto value as authoritative", async () => {
      registerSecurityHeaders(app, { trustForwardedProto: true });
      app.get("/test", () => ({ ok: true }));

      const httpsFirst = await app.inject({
        method: "GET",
        url: "/test",
        headers: {
          "x-forwarded-proto": "https, http",
        },
      });

      expect(httpsFirst.headers["strict-transport-security"]).toBeDefined();

      const httpFirst = await app.inject({
        method: "GET",
        url: "/test",
        headers: {
          "x-forwarded-proto": "http, https",
        },
      });

      expect(httpFirst.headers["strict-transport-security"]).toBeUndefined();
    });

    it("should handle array-valued x-forwarded-proto headers", async () => {
      registerSecurityHeaders(app, { trustForwardedProto: true });
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
        headers: {
          "x-forwarded-proto": ["https", "http"],
        },
      });

      expect(response.headers["strict-transport-security"]).toBeDefined();
    });

    it("should not trust x-forwarded-proto when using getDefaultSecurityHeaders", async () => {
      registerSecurityHeaders(app, getDefaultSecurityHeaders());
      app.get("/test", () => ({ ok: true }));

      const httpResponse = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(httpResponse.headers["strict-transport-security"]).toBeUndefined();

      const httpsResponse = await app.inject({
        method: "GET",
        url: "/test",
        headers: {
          "x-forwarded-proto": "https",
        },
      });

      expect(
        httpsResponse.headers["strict-transport-security"],
      ).toBeUndefined();
    });

    it("should not trust x-forwarded-proto by default", async () => {
      registerSecurityHeaders(app);
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
        headers: {
          "x-forwarded-proto": "https",
        },
      });

      expect(response.headers["strict-transport-security"]).toBeUndefined();
    });

    it("should remove X-Powered-By header", async () => {
      registerSecurityHeaders(app);
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.headers["x-powered-by"]).toBeUndefined();
    });

    it("should allow disabling specific headers", async () => {
      registerSecurityHeaders(app, {
        xFrameOptions: false,
        xXssProtection: false,
      });
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.headers["x-frame-options"]).toBeUndefined();
      expect(response.headers["x-xss-protection"]).toBeUndefined();
      expect(response.headers["content-security-policy"]).toBeDefined();
    });

    it("should allow custom header values", async () => {
      registerSecurityHeaders(app, {
        xFrameOptions: "SAMEORIGIN",
        referrerPolicy: "no-referrer",
      });
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
    });

    it("should include frame-ancestors in CSP", async () => {
      registerSecurityHeaders(app);
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      const csp = response.headers["content-security-policy"];
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("should include base-uri in CSP", async () => {
      registerSecurityHeaders(app);
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      const csp = response.headers["content-security-policy"];
      expect(csp).toContain("base-uri 'self'");
    });

    it("should not include unsafe-inline in CSP", async () => {
      registerSecurityHeaders(app);
      app.get("/test", () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      const csp = response.headers["content-security-policy"];
      expect(csp).not.toContain("unsafe-inline");
    });
  });

  describe("getDefaultSecurityHeaders", () => {
    it("should return all default header values", () => {
      const defaults = getDefaultSecurityHeaders();

      expect(defaults.contentSecurityPolicy).toBeDefined();
      expect(defaults.strictTransportSecurity).toBeDefined();
      expect(defaults.trustForwardedProto).toBe(false);
      expect(defaults.xContentTypeOptions).toBe("nosniff");
      expect(defaults.xFrameOptions).toBe("DENY");
      expect(defaults.xXssProtection).toBe("1; mode=block");
      expect(defaults.referrerPolicy).toBeDefined();
      expect(defaults.permissionsPolicy).toBeDefined();
    });

    it("should include HSTS with includeSubDomains", () => {
      const defaults = getDefaultSecurityHeaders();
      expect(defaults.strictTransportSecurity).toContain("includeSubDomains");
    });

    it("should disable dangerous permissions by default", () => {
      const defaults = getDefaultSecurityHeaders();
      expect(defaults.permissionsPolicy).toContain("camera=()");
      expect(defaults.permissionsPolicy).toContain("microphone=()");
      expect(defaults.permissionsPolicy).toContain("geolocation=()");
    });
  });
});
