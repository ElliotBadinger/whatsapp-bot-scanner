import dotenv from 'dotenv';
dotenv.config();

function ensureQueueName(raw: string, envVar: string): string {
  const value = raw.trim();
  if (!value) {
    throw new Error(`${envVar} must not be empty`);
  }
  if (value.includes(':')) {
    throw new Error(`${envVar} must not contain ':' characters. Use hyphen-separated names (e.g., scan-request).`);
  }
  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number, { minimum = 1 }: { minimum?: number } = {}): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isFinite(parsed) && parsed >= minimum) {
    return parsed;
  }
  return fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    db: process.env.POSTGRES_DB || 'wbscanner',
    user: process.env.POSTGRES_USER || 'wbscanner',
    password: process.env.POSTGRES_PASSWORD || 'wbscanner',
  },
  queues: {
    scanRequest: ensureQueueName(process.env.SCAN_REQUEST_QUEUE || 'scan-request', 'SCAN_REQUEST_QUEUE'),
    scanVerdict: ensureQueueName(process.env.SCAN_VERDICT_QUEUE || 'scan-verdict', 'SCAN_VERDICT_QUEUE'),
    urlscan: ensureQueueName(process.env.SCAN_URLSCAN_QUEUE || 'scan-urlscan', 'SCAN_URLSCAN_QUEUE'),
  },
  vt: {
    apiKey: process.env.VT_API_KEY || '',
    timeoutMs: parseInt(process.env.VT_REQUEST_TIMEOUT_MS || '8000', 10),
    requestsPerMinute: parsePositiveInt(process.env.VT_REQUESTS_PER_MINUTE, 4),
    requestJitterMs: parsePositiveInt(process.env.VT_REQUEST_JITTER_MS, 500, { minimum: 0 }),
  },
  gsb: {
    apiKey: process.env.GSB_API_KEY || '',
    timeoutMs: parseInt(process.env.GSB_REQUEST_TIMEOUT_MS || '5000', 10),
    fallbackLatencyMs: parseInt(process.env.GSB_FALLBACK_LATENCY_MS || '500', 10),
  },
  urlhaus: {
    enabled: (process.env.URLHAUS_ENABLED || 'true') === 'true',
    timeoutMs: parseInt(process.env.URLHAUS_TIMEOUT_MS || '5000', 10),
  },
  phishtank: {
    enabled: (process.env.PHISHTANK_ENABLED || 'true') === 'true',
    appKey: process.env.PHISHTANK_APP_KEY || '',
    userAgent: process.env.PHISHTANK_USER_AGENT || 'wbscanner-bot/1.0',
    timeoutMs: parseInt(process.env.PHISHTANK_TIMEOUT_MS || '5000', 10),
  },
  rdap: {
    timeoutMs: parseInt(process.env.RDAP_TIMEOUT_MS || '5000', 10),
  },
  urlscan: {
    enabled: (process.env.URLSCAN_ENABLED || 'true') === 'true',
    apiKey: process.env.URLSCAN_API_KEY || '',
    baseUrl: process.env.URLSCAN_BASE_URL || 'https://urlscan.io',
    visibility: process.env.URLSCAN_VISIBILITY || 'private',
    tags: (process.env.URLSCAN_TAGS || 'wbscanner').split(',').map(t => t.trim()).filter(Boolean),
    callbackUrl: process.env.URLSCAN_CALLBACK_URL || '',
    callbackSecret: process.env.URLSCAN_CALLBACK_SECRET || '',
    submitTimeoutMs: parseInt(process.env.URLSCAN_SUBMIT_TIMEOUT_MS || '10000', 10),
    resultPollTimeoutMs: parseInt(process.env.URLSCAN_RESULT_TIMEOUT_MS || '30000', 10),
    uuidTtlSeconds: parseInt(process.env.URLSCAN_UUID_TTL_SECONDS || '86400', 10),
    resultTtlSeconds: parseInt(process.env.URLSCAN_RESULT_TTL_SECONDS || '86400', 10),
    concurrency: parseInt(process.env.URLSCAN_CONCURRENCY || '2', 10),
  },
  whoisxml: {
    enabled: (process.env.WHOISXML_ENABLED || 'true') === 'true',
    apiKey: process.env.WHOISXML_API_KEY || '',
    timeoutMs: parseInt(process.env.WHOISXML_TIMEOUT_MS || '5000', 10),
  },
  shortener: {
    unshortenEndpoint: process.env.UNSHORTEN_ENDPOINT || 'https://unshorten.me/json/',
    unshortenRetries: parseInt(process.env.UNSHORTEN_RETRIES || '1', 10),
    cacheTtlSeconds: parseInt(process.env.SHORTENER_CACHE_TTL_SECONDS || '86400', 10),
  },
  orchestrator: {
    concurrency: parseInt(process.env.SCAN_CONCURRENCY || '10', 10),
    expansion: {
      maxRedirects: parseInt(process.env.URL_EXPANSION_MAX_REDIRECTS || '5', 10),
      timeoutMs: parseInt(process.env.URL_EXPANSION_TIMEOUT_MS || '5000', 10),
      maxContentLength: parseInt(process.env.URL_MAX_CONTENT_LENGTH || '1048576', 10),
    },
    cacheTtl: {
      benign: parseInt(process.env.CACHE_TTL_BENIGN_SECONDS || '86400', 10),
      suspicious: parseInt(process.env.CACHE_TTL_SUSPICIOUS_SECONDS || '3600', 10),
      malicious: parseInt(process.env.CACHE_TTL_MALICIOUS_SECONDS || '900', 10),
    }
  },
  controlPlane: {
    port: parseInt(process.env.CONTROL_PLANE_PORT || '8080', 10),
    token: process.env.CONTROL_PLANE_API_TOKEN || '',
    enableUi: (process.env.CONTROL_PLANE_ENABLE_UI || 'true') === 'true',
  },
  wa: {
    headless: (process.env.WA_HEADLESS || 'true') === 'true',
    qrTerminal: (process.env.WA_QR_TERMINAL || 'true') === 'true',
    consentOnJoin: (process.env.WA_CONSENT_ON_JOIN || 'true') === 'true',
    quietHours: process.env.WA_QUIET_HOURS || '22-07',
    perGroupCooldownSeconds: parseInt(process.env.WA_PER_GROUP_REPLY_COOLDOWN_SECONDS || '60', 10),
    globalRatePerMinute: parseInt(process.env.WA_GLOBAL_REPLY_RATE_PER_MINUTE || '60', 10)
  }
};
