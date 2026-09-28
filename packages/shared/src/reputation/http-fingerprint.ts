import { request } from "undici";
import { logger } from "../log";
import { isPrivateIp } from "../ssrf";

export interface SecurityHeaders {
  hsts: boolean;
  csp: boolean;
  xFrameOptions: boolean;
  xContentTypeOptions: boolean;
}

export interface HTTPFingerprint {
  statusCode: number;
  securityHeaders: SecurityHeaders;
  suspiciousRedirects: boolean;
  suspicionScore: number;
  reasons: string[];
}

interface HTTPFingerprintOptions {
  timeoutMs?: number;
  enableSSRFGuard?: boolean;
}

export async function httpFingerprinting(
  url: string,
  options: HTTPFingerprintOptions = {},
): Promise<HTTPFingerprint> {
  const { timeoutMs = 2000, enableSSRFGuard = true } = options;

  const result: HTTPFingerprint = {
    statusCode: 0,
    securityHeaders: {
      hsts: false,
      csp: false,
      xFrameOptions: false,
      xContentTypeOptions: false,
    },
    suspiciousRedirects: false,
    suspicionScore: 0,
    reasons: [],
  };

  try {
    if (enableSSRFGuard) {
      const hostname = new URL(url).hostname;
      const isIpv4Literal = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
      const isBracketedIpv6 =
        hostname.startsWith("[") && hostname.endsWith("]");
      const ipCandidate = isBracketedIpv6 ? hostname.slice(1, -1) : hostname;

      if (
        hostname === "localhost" ||
        (isIpv4Literal && isPrivateIp(ipCandidate)) ||
        (isBracketedIpv6 && isPrivateIp(ipCandidate))
      ) {
        result.suspicionScore += 1.0;
        result.reasons.push("URL points to private IP address");
        return result;
      }
    }

    const response = await request(url, {
      method: "HEAD",
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      maxRedirections: 5,
    });

    result.statusCode = response.statusCode;
    const headers = response.headers;

    analyzeSecurityHeaders(headers as Record<string, unknown>, result);
    analyzeStatusCode(result.statusCode, result);
    analyzeServerHeader(headers.server as string, result);
    analyzeRedirects(url, headers.location as string, result);
    analyzeContentType(headers["content-type"] as string, result);

    return result;
  } catch (err: unknown) {
    return handleHttpError(
      err as { message?: string; code?: string },
      url,
      result,
    );
  }
}

function analyzeSecurityHeaders(
  headers: Record<string, unknown>,
  result: HTTPFingerprint,
): void {
  result.securityHeaders.hsts = !!headers["strict-transport-security"];
  result.securityHeaders.csp = !!headers["content-security-policy"];
  result.securityHeaders.xFrameOptions = !!headers["x-frame-options"];
  result.securityHeaders.xContentTypeOptions =
    !!headers["x-content-type-options"];

  const missingHeaders = Object.values(result.securityHeaders).filter(
    (present) => !present,
  ).length;
  if (missingHeaders >= 3) {
    result.suspicionScore += 0.4;
    result.reasons.push("Multiple security headers missing");
  }
}

function analyzeStatusCode(statusCode: number, result: HTTPFingerprint): void {
  if (statusCode >= 400 && statusCode < 500) {
    result.suspicionScore += 0.2;
    result.reasons.push(`Client error status: ${statusCode}`);
  } else if (statusCode >= 500) {
    result.suspicionScore += 0.3;
    result.reasons.push(`Server error status: ${statusCode}`);
  }
}

function analyzeServerHeader(server: string, result: HTTPFingerprint): void {
  if (!server) return;

  const suspiciousServers = ["apache/1.", "nginx/0.", "test", "localhost"];
  if (suspiciousServers.some((sus) => server.toLowerCase().includes(sus))) {
    result.suspicionScore += 0.3;
    result.reasons.push("Suspicious server header");
  }
}

function analyzeRedirects(
  originalUrl: string,
  location: string,
  result: HTTPFingerprint,
): void {
  if (!location) return;

  try {
    const originalHost = new URL(originalUrl).hostname;
    const redirectUrl = new URL(location, originalUrl);
    const redirectHost = redirectUrl.hostname;

    if (originalHost !== redirectHost) {
      if (redirectHost === "localhost" || redirectHost.includes("localhost")) {
        result.suspiciousRedirects = true;
        result.suspicionScore += 0.6;
        result.reasons.push("Suspicious redirect to local address");
        return;
      }

      if (
        /^\d+\.\d+\.\d+\.\d+$/.test(redirectHost) &&
        isPrivateIp(redirectHost)
      ) {
        result.suspiciousRedirects = true;
        result.suspicionScore += 0.6;
        result.reasons.push("Suspicious redirect to private/local address");
      }
    }
  } catch {
    result.suspiciousRedirects = true;
    result.suspicionScore += 0.4;
    result.reasons.push("Invalid redirect URL");
  }
}

function analyzeContentType(
  contentType: string,
  result: HTTPFingerprint,
): void {
  if (contentType && contentType.includes("application/octet-stream")) {
    result.suspicionScore += 0.3;
    result.reasons.push("Binary content type detected");
  }
}

function handleHttpError(
  error: { message?: string; code?: string },
  url: string,
  result: HTTPFingerprint,
): HTTPFingerprint {
  logger.warn({ url, err: error.message }, "HTTP fingerprinting failed");

  if (error.code === "ENOTFOUND") {
    result.suspicionScore += 0.5;
    result.reasons.push("Domain not found");
  } else if (error.code === "ECONNREFUSED") {
    result.suspicionScore += 0.4;
    result.reasons.push("Connection refused");
  } else if (error.code === "CERT_AUTHORITY_INVALID") {
    result.suspicionScore += 0.6;
    result.reasons.push("Invalid certificate authority");
  }

  return result;
}
