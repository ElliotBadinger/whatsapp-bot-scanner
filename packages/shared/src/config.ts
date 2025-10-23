import dotenv from 'dotenv';

dotenv.config();

const urlscanEnabled = (process.env.URLSCAN_ENABLED || 'true') === 'true';
const urlscanCallbackSecret = (process.env.URLSCAN_CALLBACK_SECRET || '').trim();

if (urlscanEnabled && !urlscanCallbackSecret) {
  throw new Error('URLSCAN_CALLBACK_SECRET must be provided when URLSCAN_ENABLED=true');
}

function ensureNonEmpty(raw: string | undefined, envVar: string): string {
  const value = (raw ?? '').trim();
  if (!value) {
    throw new Error(`${envVar} must not be empty`);
  }
  return value;
}

function ensureQueueName(raw: string, envVar: string): string {
  const value = ensureNonEmpty(raw, envVar);
  if (value.includes(':')) {
    throw new Error(`${envVar} must not contain ':' characters. Use hyphen-separated names (e.g., scan-request).`);
  }
  return value;
}

let cachedControlPlaneToken: string | undefined;

function getControlPlaneToken(): string {
  if (!cachedControlPlaneToken) {
    cachedControlPlaneToken = ensureNonEmpty(process.env.CONTROL_PLANE_API_TOKEN, 'CONTROL_PLANE_API_TOKEN');
  }
  return cachedControlPlaneToken;
}

function parsePositiveInt(value: string | undefined, fallback: number, { minimum = 1 }: { minimum?: number } = {}): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isFinite(parsed) && parsed >= minimum) {
    return parsed;
  }
  return fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
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
    requestJitterMs: parseNonNegativeInt(process.env.VT_REQUEST_JITTER_MS, 0),
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
    enabled: urlscanEnabled,
    apiKey: process.env.URLSCAN_API_KEY || '',
    baseUrl: process.env.URLSCAN_BASE_URL || 'https://urlscan.io',
    visibility: process.env.URLSCAN_VISIBILITY || 'private',
    tags: (process.env.URLSCAN_TAGS || 'wbscanner').split(',').map(t => t.trim()).filter(Boolean),
    callbackUrl: process.env.URLSCAN_CALLBACK_URL || '',
    callbackSecret: urlscanCallbackSecret,
    submitTimeoutMs: parseInt(process.env.URLSCAN_SUBMIT_TIMEOUT_MS || '10000', 10),
    resultPollTimeoutMs: parseInt(process.env.URLSCAN_RESULT_TIMEOUT_MS || '30000', 10),
    uuidTtlSeconds: parseInt(process.env.URLSCAN_UUID_TTL_SECONDS || '86400', 10),
    resultTtlSeconds: parseInt(process.env.URLSCAN_RESULT_TTL_SECONDS || '86400', 10),
    concurrency: parseInt(process.env.URLSCAN_CONCURRENCY || '2', 10),
  },
  whoisxml: {
    enabled: ((process.env.WHOISXML_ENABLE ?? process.env.WHOISXML_ENABLED) || 'true') === 'true',
    apiKey: process.env.WHOISXML_API_KEY || '',
    timeoutMs: parseInt(process.env.WHOISXML_TIMEOUT_MS || '5000', 10),
    monthlyQuota: parsePositiveInt(process.env.WHOISXML_MONTHLY_QUOTA, 500),
    quotaAlertThreshold: parsePositiveInt(process.env.WHOISXML_QUOTA_ALERT_THRESHOLD, 100, { minimum: 1 }),
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
    get token(): string {
      return getControlPlaneToken();
    },
    enableUi: (process.env.CONTROL_PLANE_ENABLE_UI || 'true') === 'true',
  },
  wa: {
    headless: (process.env.WA_HEADLESS || 'true') === 'true',
    qrTerminal: (process.env.WA_QR_TERMINAL || 'true') === 'true',
    consentOnJoin: (process.env.WA_CONSENT_ON_JOIN || 'true') === 'true',
    quietHours: process.env.WA_QUIET_HOURS || '22-07',
    perGroupCooldownSeconds: parseInt(process.env.WA_PER_GROUP_REPLY_COOLDOWN_SECONDS || '60', 10),
    globalRatePerHour: parsePositiveInt(process.env.WA_GLOBAL_REPLY_RATE_PER_HOUR, 1000),
    perGroupHourlyLimit: parsePositiveInt(process.env.WA_PER_GROUP_HOURLY_LIMIT, 60),
    verdictAckTimeoutSeconds: parseInt(process.env.WA_VERDICT_ACK_TIMEOUT_SECONDS || '30', 10),
    verdictAckMaxRetries: parseInt(process.env.WA_VERDICT_ACK_MAX_RETRIES || '3', 10),
  },
  features: {
    attachMediaToVerdicts: (process.env.FEATURE_ATTACH_MEDIA_TO_VERDICTS || 'false') === 'true',
  }
};

export function assertControlPlaneToken(): string {
  return getControlPlaneToken();
}


export function assertControlPlaneToken(): string {
  return getControlPlaneToken();
}


  return getControlPlaneToken();
}

