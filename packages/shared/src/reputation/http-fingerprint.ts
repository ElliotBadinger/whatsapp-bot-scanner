import * as https from 'https';
import { logger } from '../log';
import { metrics } from '../metrics';
import { Counter, Histogram } from 'prom-client';
import { assertSafeUrl } from '../ssrf';

const httpFingerprintTotal = new Counter({
  name: 'http_fingerprint_total',
  help: 'Total number of HTTP fingerprinting operations',
  labelNames: ['result'],
  registers: [metrics],
});

const httpFingerprintSuspiciousTotal = new Counter({
  name: 'http_fingerprint_suspicious_total',
  help: 'Total number of suspicious HTTP fingerprints detected',
  labelNames: ['reason'],
  registers: [metrics],
});

const httpFingerprintLatencySeconds = new Histogram({
  name: 'http_fingerprint_latency_seconds',
  help: 'HTTP fingerprinting latency in seconds',
  buckets: [0.5, 1, 2, 3, 5],
  registers: [metrics],
});

interface SecurityHeaders {
  hsts: boolean;
  csp: boolean;
  xFrameOptions: boolean;
  xContentTypeOptions: boolean;
}

interface HTTPFingerprint {
  statusCode: number;
  serverHeader?: string;
  contentType?: string;
  securityHeaders: SecurityHeaders;
  suspiciousRedirects: boolean;
  suspicionScore: number;
  reasons: string[];
}

const fingerprintCache = new Map<string, { result: HTTPFingerprint; expiry: number }>();

function getCached(url: string): HTTPFingerprint | null {
  const cached = fingerprintCache.get(url);
  if (cached && cached.expiry > Date.now()) {
    return cached.result;
  }
  if (cached) {
    fingerprintCache.delete(url);
  }
  return null;
}

function setCache(url: string, result: HTTPFingerprint, ttlMs: number): void {
  fingerprintCache.set(url, {
    result,
    expiry: Date.now() + ttlMs,
  });
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function humanDelay(): Promise<void> {
  const delayMs = 100 + Math.random() * 400;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 3000,
  rejectUnauthorized: false,
});

async function performHeadRequest(url: string, timeoutMs: number): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  redirectUrl?: string;
}> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'HEAD',
      timeout: timeoutMs,
      agent: httpsAgent,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    };

    const req = https.request(options, (res) => {
      const headers: Record<string, string | string[] | undefined> = {};
      for (const [key, value] of Object.entries(res.headers)) {
        headers[key.toLowerCase()] = value;
      }

      let redirectUrl: string | undefined;
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        redirectUrl = headers['location'] as string;
      }

      resolve({
        statusCode: res.statusCode || 0,
        headers,
        redirectUrl,
      });

      req.destroy();
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function analyzeSecurityHeaders(headers: Record<string, string | string[] | undefined>): SecurityHeaders {
  return {
    hsts: !!headers['strict-transport-security'],
    csp: !!headers['content-security-policy'],
    xFrameOptions: !!headers['x-frame-options'],
    xContentTypeOptions: !!headers['x-content-type-options'],
  };
}

function isCompromisedCMS(serverHeader: string): boolean {
  const compromisedPatterns = [
    /apache.*\(ubuntu\)/i,
    /nginx\/1\.[0-9]+\.[0-9]+/i,
    /microsoft-iis\/[5-7]\./i,
  ];

  return compromisedPatterns.some((pattern) => pattern.test(serverHeader));
}

export async function httpFingerprinting(
  url: string,
  config: {
    timeoutMs?: number;
    enableSSRFGuard?: boolean;
  } = {}
): Promise<HTTPFingerprint> {
  const startTime = Date.now();
  const { timeoutMs = 2000, enableSSRFGuard = true } = config;

  const cached = getCached(url);
  if (cached) {
    return cached;
  }

  const reasons: string[] = [];
  let suspicionScore = 0;

  try {
    if (enableSSRFGuard) {
      assertSafeUrl(url);
    }

    await humanDelay();

    const response = await performHeadRequest(url, timeoutMs);
    const securityHeaders = analyzeSecurityHeaders(response.headers);

    const serverHeader = response.headers['server'] as string | undefined;
    const contentType = response.headers['content-type'] as string | undefined;

    const missingHeadersCount = Object.values(securityHeaders).filter((v) => !v).length;
    if (missingHeadersCount === 4) {
      suspicionScore += 0.2;
      reasons.push('All security headers missing');
      httpFingerprintSuspiciousTotal.labels('no_security_headers').inc();
    }

    if (serverHeader && isCompromisedCMS(serverHeader)) {
      suspicionScore += 0.3;
      reasons.push(`Potentially compromised CMS: ${serverHeader}`);
      httpFingerprintSuspiciousTotal.labels('compromised_cms').inc();
    }

    let suspiciousRedirects = false;
    if (response.redirectUrl) {
      try {
        const originalDomain = new URL(url).hostname;
        const redirectDomain = new URL(response.redirectUrl, url).hostname;

        if (originalDomain !== redirectDomain) {
          suspicionScore += 0.4;
          reasons.push(`Redirect to different domain: ${redirectDomain}`);
          suspiciousRedirects = true;
          httpFingerprintSuspiciousTotal.labels('cross_domain_redirect').inc();
        }
      } catch {
        // Invalid redirect URL
      }
    }

    if (response.statusCode === 404 && response.redirectUrl) {
      suspicionScore += 0.5;
      reasons.push('404 status with redirect');
      httpFingerprintSuspiciousTotal.labels('404_with_redirect').inc();
    }

    const result: HTTPFingerprint = {
      statusCode: response.statusCode,
      serverHeader,
      contentType,
      securityHeaders,
      suspiciousRedirects,
      suspicionScore,
      reasons,
    };

    httpFingerprintTotal.labels('success').inc();

    const cacheTtl = suspicionScore > 0.3 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    setCache(url, result, cacheTtl);

    const latency = (Date.now() - startTime) / 1000;
    httpFingerprintLatencySeconds.observe(latency);

    if (suspicionScore > 0) {
      logger.info({ url, suspicionScore, reasons }, 'Suspicious HTTP fingerprint detected');
    }

    return result;
  } catch (err: any) {
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
      reasons: [`HTTP fingerprinting error: ${err.message}`],
    };

    httpFingerprintTotal.labels('error').inc();
    setCache(url, result, 60 * 60 * 1000);

    const latency = (Date.now() - startTime) / 1000;
    httpFingerprintLatencySeconds.observe(latency);

    logger.debug({ url, error: err.message }, 'HTTP fingerprinting failed');

    return result;
  }
}

export type { HTTPFingerprint, SecurityHeaders };
