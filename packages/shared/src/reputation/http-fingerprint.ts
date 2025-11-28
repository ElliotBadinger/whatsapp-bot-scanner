import { request } from 'undici';
import { logger } from '../log';

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
  options: HTTPFingerprintOptions = {}
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
    // SSRF protection
    if (enableSSRFGuard && isPrivateIP(new URL(url).hostname)) {
      result.suspicionScore += 1.0;
      result.reasons.push('URL points to private IP address');
      return result;
    }

    const response = await request(url, {
      method: 'HEAD', // Use HEAD to minimize data transfer
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      maxRedirections: 5,
    });

    result.statusCode = response.statusCode;
    const headers = response.headers;

    // Analyze response headers
    analyzeSecurityHeaders(headers, result);
    analyzeStatusCode(result.statusCode, result);
    analyzeServerHeader(headers.server as string, result);
    analyzeRedirects(url, headers.location as string, result);
    analyzeContentType(headers['content-type'] as string, result);

    return result;
  } catch (err: unknown) {
    return handleHttpError(err as { message?: string; code?: string }, url, result);
  }
}

function analyzeSecurityHeaders(headers: Record<string, unknown>, result: HTTPFingerprint): void {
  // Check security headers
  result.securityHeaders.hsts = !!(headers['strict-transport-security']);
  result.securityHeaders.csp = !!(headers['content-security-policy']);
  result.securityHeaders.xFrameOptions = !!(headers['x-frame-options']);
  result.securityHeaders.xContentTypeOptions = !!(headers['x-content-type-options']);

  // Score based on missing security headers
  const missingHeaders = Object.values(result.securityHeaders).filter(present => !present).length;
  if (missingHeaders >= 3) {
    result.suspicionScore += 0.4;
    result.reasons.push('Multiple security headers missing');
  }
}

function analyzeStatusCode(statusCode: number, result: HTTPFingerprint): void {
  // Check for suspicious status codes
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
  
  const suspiciousServers = ['apache/1.', 'nginx/0.', 'test', 'localhost'];
  if (suspiciousServers.some(sus => server.toLowerCase().includes(sus))) {
    result.suspicionScore += 0.3;
    result.reasons.push('Suspicious server header');
  }
}

function analyzeRedirects(originalUrl: string, location: string, result: HTTPFingerprint): void {
  if (!location) return;
  
  try {
    const originalHost = new URL(originalUrl).hostname;
    const redirectHost = new URL(location).hostname;

    if (originalHost !== redirectHost) {
      // Cross-domain redirect - check if suspicious
      if (isPrivateIP(redirectHost) || redirectHost.includes('localhost')) {
        result.suspiciousRedirects = true;
        result.suspicionScore += 0.6;
        result.reasons.push('Suspicious redirect to private/local address');
      }
    }
  } catch (_err) {
    // Invalid redirect URL
    result.suspiciousRedirects = true;
    result.suspicionScore += 0.4;
    result.reasons.push('Invalid redirect URL');
  }
}

function analyzeContentType(contentType: string, result: HTTPFingerprint): void {
  if (contentType && contentType.includes('application/octet-stream')) {
    result.suspicionScore += 0.3;
    result.reasons.push('Binary content type detected');
  }
}

function handleHttpError(
  error: { message?: string; code?: string }, 
  url: string, 
  result: HTTPFingerprint
): HTTPFingerprint {
  logger.warn({ url, err: error.message }, 'HTTP fingerprinting failed');

  // Analyze the error for additional insights
  if (error.code === 'ENOTFOUND') {
    result.suspicionScore += 0.5;
    result.reasons.push('Domain not found');
  } else if (error.code === 'ECONNREFUSED') {
    result.suspicionScore += 0.4;
    result.reasons.push('Connection refused');
  } else if (error.code === 'CERT_AUTHORITY_INVALID') {
    result.suspicionScore += 0.6;
    result.reasons.push('Invalid certificate authority');
  }

  return result;
}

function isPrivateIP(hostname: string): boolean {
  // Check for private IP ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./, // Link-local
    /^::1$/, // IPv6 localhost
    /^fc00:/, // IPv6 private
    /^fe80:/, // IPv6 link-local
  ];

  // Check for localhost variations
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    return true;
  }

  return privateRanges.some(range => range.test(hostname));
}