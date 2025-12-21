import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: string | false;
  strictTransportSecurity?: string | false;
  trustForwardedProto?: boolean;
  xContentTypeOptions?: string | false;
  xFrameOptions?: string | false;
  xXssProtection?: string | false;
  referrerPolicy?: string | false;
  permissionsPolicy?: string | false;
}

const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
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
  trustForwardedProto: false,
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
 *
 * The default Content Security Policy disallows inline styles. If an
 * application needs inline styles, provide an explicit CSP via
 * `options.contentSecurityPolicy`.
 */
export function registerSecurityHeaders(
  app: FastifyInstance,
  options: SecurityHeadersOptions = {},
): void {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const isSecureRequest = (request: FastifyRequest): boolean => {
    if (request.protocol === "https") {
      return true;
    }

    if (mergedOptions.trustForwardedProto) {
      const forwardedProto = request.headers["x-forwarded-proto"];
      // When behind proxies, this may be a comma-separated list. We treat the
      // first value as the originating protocol.
      const proto = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto;
      if (typeof proto === "string") {
        return proto.split(",")[0]?.trim().toLowerCase() === "https";
      }
    }

    const socket = request.raw.socket as { encrypted?: boolean } | undefined;
    return socket?.encrypted === true;
  };

  app.addHook(
    "onSend",
    async (request: FastifyRequest, reply: FastifyReply, _payload: unknown) => {
      if (mergedOptions.contentSecurityPolicy !== false) {
        reply.header(
          "Content-Security-Policy",
          mergedOptions.contentSecurityPolicy,
        );
      }

      if (
        mergedOptions.strictTransportSecurity !== false &&
        isSecureRequest(request)
      ) {
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
