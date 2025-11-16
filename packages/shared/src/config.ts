import dotenv from 'dotenv';
import { logger } from './log';

dotenv.config();

const urlscanEnabled = (process.env.URLSCAN_ENABLED || 'true') === 'true';
const urlscanCallbackSecret = (process.env.URLSCAN_CALLBACK_SECRET || '').trim();

if (urlscanEnabled && !urlscanCallbackSecret) {
  throw new Error('URLSCAN_CALLBACK_SECRET must be provided when URLSCAN_ENABLED=true');
}

function parseStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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

const featureFlags = {
  attachMediaToVerdicts: (process.env.FEATURE_ATTACH_MEDIA_TO_VERDICTS || 'false') === 'true',
};

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
    get allowedArtifactHosts(): string[] {
      const configuredHosts = parseStringList(process.env.URLSCAN_ALLOWED_HOSTS);
      const baseHosts = [] as string[];
      try {
        const host = new URL(process.env.URLSCAN_BASE_URL || 'https://urlscan.io').hostname.toLowerCase();
        baseHosts.push(host);
      } catch {
        // ignore invalid base URL overrides; validation happens elsewhere
      }
      const combined = [...baseHosts, ...configuredHosts].map((host) => host.toLowerCase());
      return Array.from(new Set(combined.filter((host) => host.length > 0)));
    },
  },
  whoisxml: {
    enabled: ((process.env.WHOISXML_ENABLE ?? process.env.WHOISXML_ENABLED) || 'false') === 'true',
    apiKey: process.env.WHOISXML_API_KEY || '',
    timeoutMs: parseInt(process.env.WHOISXML_TIMEOUT_MS || '5000', 10),
    monthlyQuota: parsePositiveInt(process.env.WHOISXML_MONTHLY_QUOTA, 500),
    quotaAlertThreshold: parsePositiveInt(process.env.WHOISXML_QUOTA_ALERT_THRESHOLD, 100, { minimum: 1 }),
  },
  whodat: {
    enabled: (process.env.WHODAT_ENABLED || 'true') === 'true',
    baseUrl: process.env.WHODAT_BASE_URL || 'http://who-dat:8080',
    timeoutMs: parseInt(process.env.WHODAT_TIMEOUT_MS || '5000', 10),
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
  enhancedSecurity: {
    enabled: (process.env.ENHANCED_SECURITY_ENABLED || 'true') === 'true',
    dnsbl: {
      enabled: (process.env.DNSBL_ENABLED || 'true') === 'true',
      timeoutMs: parseInt(process.env.DNSBL_TIMEOUT_MS || '2000', 10),
    },
    certIntel: {
      enabled: (process.env.CERT_INTEL_ENABLED || 'true') === 'true',
      timeoutMs: parseInt(process.env.CERT_INTEL_TIMEOUT_MS || '3000', 10),
      ctCheckEnabled: (process.env.CERT_INTEL_CT_CHECK_ENABLED || 'true') === 'true',
    },
    localThreatDb: {
      enabled: (process.env.LOCAL_THREAT_DB_ENABLED || 'true') === 'true',
      feedUrl: process.env.OPENPHISH_FEED_URL || 'https://openphish.com/feed.txt',
      updateIntervalMs: parseInt(process.env.OPENPHISH_UPDATE_INTERVAL_MS || '7200000', 10),
    },
    httpFingerprint: {
      enabled: (process.env.HTTP_FINGERPRINT_ENABLED || 'true') === 'true',
      timeoutMs: parseInt(process.env.HTTP_FINGERPRINT_TIMEOUT_MS || '2000', 10),
    },
    heuristics: {
      entropyThreshold: parseFloat(process.env.ENHANCED_HEURISTICS_ENTROPY_THRESHOLD || '4.5'),
    },
  },
  controlPlane: {
    port: parseInt(process.env.CONTROL_PLANE_PORT || '8080', 10),
    get token(): string {
      return getControlPlaneToken();
    },
    enableUi: (process.env.CONTROL_PLANE_ENABLE_UI || 'true') === 'true',
    get csrfToken(): string {
      return (process.env.CONTROL_PLANE_CSRF_TOKEN || getControlPlaneToken()).trim();
    },
    get allowedOrigins(): string[] {
      return parseStringList(process.env.CONTROL_PLANE_ALLOWED_ORIGINS).map((origin) => origin.toLowerCase());
    },
  },
  features: featureFlags,
  wa: {
    headless: (process.env.WA_HEADLESS || 'true') === 'true',
    qrTerminal: (process.env.WA_QR_TERMINAL || 'true') === 'true',
    consentOnJoin: (process.env.WA_CONSENT_ON_JOIN || 'true') === 'true',
    quietHours: process.env.WA_QUIET_HOURS || '22-07',
    perGroupCooldownSeconds: parseInt(process.env.WA_PER_GROUP_REPLY_COOLDOWN_SECONDS || '60', 10),
    globalRatePerHour: parsePositiveInt(process.env.WA_GLOBAL_REPLY_RATE_PER_HOUR, 1000),
    globalTokenBucketKey: process.env.WA_GLOBAL_TOKEN_BUCKET_KEY || 'wa_global_token_bucket',
    perGroupHourlyLimit: parsePositiveInt(process.env.WA_PER_GROUP_HOURLY_LIMIT, 60),
    remoteAuth: {
      store: (process.env.WA_REMOTE_AUTH_STORE || 'redis').toLowerCase(),
      clientId: process.env.WA_AUTH_CLIENT_ID || 'default',
      autoPair: (process.env.WA_REMOTE_AUTH_AUTO_PAIR || 'false') === 'true',
      pairingDelayMs: parsePositiveInt(process.env.WA_REMOTE_AUTH_AUTO_PAIR_DELAY_MS, 0, { minimum: 0 }),
      pairingRetryDelayMs: parsePositiveInt(process.env.WA_REMOTE_AUTH_RETRY_DELAY_MS, 15000, { minimum: 1000 }),
      maxPairingRetries: parsePositiveInt(process.env.WA_REMOTE_AUTH_MAX_RETRIES, 5, { minimum: 1 }),
      disableQrFallback: (process.env.WA_REMOTE_AUTH_DISABLE_QR_FALLBACK || 'false') === 'true',
      kmsKeyId: (process.env.WA_REMOTE_AUTH_KMS_KEY_ID || '').trim() || undefined,
      encryptedDataKey: (process.env.WA_REMOTE_AUTH_ENCRYPTED_DATA_KEY || '').trim() || undefined,
      dataKey: (process.env.WA_REMOTE_AUTH_DATA_KEY || '').trim() || undefined,
      vaultTransitPath: (process.env.WA_REMOTE_AUTH_VAULT_PATH || '').trim() || undefined,
      vaultToken: (process.env.WA_REMOTE_AUTH_VAULT_TOKEN || '').trim() || undefined,
      vaultAddress: (process.env.WA_REMOTE_AUTH_VAULT_ADDRESS || '').trim() || undefined,
      alertThreshold: parsePositiveInt(process.env.WA_AUTH_FAILURE_ALERT_THRESHOLD, 3, { minimum: 1 }),
      alertCooldownSeconds: parsePositiveInt(process.env.WA_AUTH_FAILURE_ALERT_COOLDOWN_SECONDS, 1800, { minimum: 60 }),
      failureWindowSeconds: parsePositiveInt(process.env.WA_AUTH_FAILURE_WINDOW_SECONDS, 900, { minimum: 60 }),
      resetDebounceSeconds: parsePositiveInt(process.env.WA_RESET_DEBOUNCE_SECONDS, 60, { minimum: 15 }),
      backupIntervalMs: parsePositiveInt(process.env.WA_REMOTE_AUTH_BACKUP_INTERVAL_MS, 300000, { minimum: 60000 }),
      dataPath: process.env.WA_REMOTE_AUTH_DATA_PATH || './data/remote-session',
      forceNewSession: (process.env.WA_REMOTE_AUTH_FORCE_NEW_SESSION || 'false') === 'true',
      phoneNumber: (() => {
        const raw = (process.env.WA_REMOTE_AUTH_PHONE_NUMBER || '').replace(/\D/g, '');
        return raw.length > 4 ? raw : undefined;
      })(),
    },
    authStrategy: (() => {
      const raw = (process.env.WA_AUTH_STRATEGY || 'remote').toLowerCase();
      return raw === 'local' ? 'local' : 'remote';
    })() as 'local' | 'remote',
    puppeteerArgs: (() => {
      const raw = process.env.WA_PUPPETEER_ARGS;
      if (!raw || raw.trim() === '') {
        return ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
      }
      return raw.split(',').map((segment) => segment.trim()).filter((segment) => segment.length > 0);
    })(),
    verdictAckTimeoutSeconds: parsePositiveInt(process.env.WA_VERDICT_ACK_TIMEOUT_SECONDS, 30),
    verdictAckMaxRetries: parsePositiveInt(process.env.WA_VERDICT_ACK_MAX_RETRIES, 5),
    verdictMaxRetries: parsePositiveInt(process.env.WA_VERDICT_MAX_RETRIES, 3),
    membershipAutoApprovePerHour: parsePositiveInt(process.env.WA_MEMBERSHIP_AUTO_APPROVE_PER_HOUR, 10),
    membershipGlobalHourlyLimit: parsePositiveInt(process.env.WA_MEMBERSHIP_GLOBAL_HOURLY_LIMIT, 100),
    governanceInterventionsPerHour: parsePositiveInt(process.env.WA_GOVERNANCE_INTERVENTIONS_PER_HOUR, 12),
    messageLineageTtlSeconds: parsePositiveInt(process.env.WA_MESSAGE_LINEAGE_TTL_SECONDS, 60 * 60 * 24 * 30),
  }
};

export function assertControlPlaneToken(): string {
  return getControlPlaneToken();
}

export function assertEssentialConfig(serviceName: string): void {
  const missing: string[] = [];

  if (!config.vt.apiKey?.trim()) missing.push('VT_API_KEY');
  if (!config.gsb.apiKey?.trim()) missing.push('GSB_API_KEY');
  if (!config.redisUrl?.trim()) missing.push('REDIS_URL');
  if (!config.postgres.host?.trim()) missing.push('POSTGRES_HOST');

  if (missing.length > 0) {
    logger.error({ service: serviceName, missing }, 'Missing required environment variables');
    process.exit(1);
  }
}
