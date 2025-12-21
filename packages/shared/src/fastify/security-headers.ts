import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: string | false;
  strictTransportSecurity?: string | false;
  xContentTypeOptions?: string | false;
  xFrameOptions?: string | false;
  xXssProtection?: string | false;
  referrerPolicy?: string | false;
  permissionsPolicy?: string | false;
}

const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const DEFAULT_OPTIONS: Required<SecurityHeadersOptions> = {
  contentSecurityPolicy: DEFAULT_CSP,
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  xXssProtection: "1; mode=block",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy:
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
};

/**
 * Adds security headers to all responses.
 * Call this during Fastify app setup.
 */
export function registerSecurityHeaders(
  app: FastifyInstance,
  options: SecurityHeadersOptions = {},
): void {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  app.addHook(
    "onSend",
    async (
      _request: FastifyRequest,
      reply: FastifyReply,
      _payload: unknown,
    ) => {
      if (mergedOptions.contentSecurityPolicy !== false) {
        reply.header(
          "Content-Security-Policy",
          mergedOptions.contentSecurityPolicy,
        );
      }

      if (mergedOptions.strictTransportSecurity !== false) {
        reply.header(
          "Strict-Transport-Security",
          mergedOptions.strictTransportSecurity,
        );
      }

      if (mergedOptions.xContentTypeOptions !== false) {
        reply.header(
          "X-Content-Type-Options",
          mergedOptions.xContentTypeOptions,
        );
      }

      if (mergedOptions.xFrameOptions !== false) {
        reply.header("X-Frame-Options", mergedOptions.xFrameOptions);
      }

      if (mergedOptions.xXssProtection !== false) {
        reply.header("X-XSS-Protection", mergedOptions.xXssProtection);
      }

      if (mergedOptions.referrerPolicy !== false) {
        reply.header("Referrer-Policy", mergedOptions.referrerPolicy);
      }

      if (mergedOptions.permissionsPolicy !== false) {
        reply.header("Permissions-Policy", mergedOptions.permissionsPolicy);
      }

      // Remove potentially dangerous headers
      reply.removeHeader("X-Powered-By");
    },
  );
}

/**
 * Returns the default security header values.
 */
export function getDefaultSecurityHeaders(): Required<SecurityHeadersOptions> {
  return { ...DEFAULT_OPTIONS };
}
