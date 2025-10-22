import dotenv from 'dotenv';
dotenv.config();

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
    scanRequest: process.env.SCAN_REQUEST_QUEUE || 'scan:request',
    scanVerdict: process.env.SCAN_VERDICT_QUEUE || 'scan:verdict',
  },
  vt: {
    apiKey: process.env.VT_API_KEY || '',
    timeoutMs: parseInt(process.env.VT_REQUEST_TIMEOUT_MS || '8000', 10),
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
  orchestrator: {
    concurrency: parseInt(process.env.SCAN_CONCURRENCY || '10', 10),
    expansion: {
      maxRedirects: parseInt(process.env.URL_EXPANSION_MAX_REDIRECTS || '5', 10),
      timeoutMs: parseInt(process.env.URL_EXPANSION_TIMEOUT_MS || '5000', 10),
      maxContentLength: parseInt(process.env.URL_MAX_CONTENT_LENGTH || '1048576', 10),
    },
    cacheTtl: {
      negative: parseInt(process.env.NEGATIVE_CACHE_TTL_SECONDS || '604800', 10),
      positive: parseInt(process.env.POSITIVE_CACHE_TTL_SECONDS || '259200', 10)
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
