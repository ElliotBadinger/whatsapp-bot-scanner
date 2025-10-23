import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const metrics = {
  ingestionRate: new client.Counter({
    name: 'wbscanner_messages_ingested_total',
    help: 'Total messages ingested',
    registers: [register],
  }),
  urlsPerMessage: new client.Histogram({
    name: 'wbscanner_urls_per_message',
    help: 'URLs extracted per message',
    buckets: [0,1,2,3,5,8,13],
    registers: [register],
  }),
  scanLatency: new client.Histogram({
    name: 'wbscanner_scan_latency_seconds',
    help: 'End-to-end scan latency',
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [register],
  }),
  cacheHit: new client.Counter({
    name: 'wbscanner_cache_hits_total',
    help: 'Cache hits',
    registers: [register],
  }),
  cacheMiss: new client.Counter({
    name: 'wbscanner_cache_misses_total',
    help: 'Cache misses',
    registers: [register],
  }),
  vtSubmissions: new client.Counter({
    name: 'wbscanner_vt_submissions_total',
    help: 'VirusTotal submissions',
    registers: [register],
  }),
  gsbHits: new client.Counter({
    name: 'wbscanner_gsb_hits_total',
    help: 'Google Safe Browsing hits',
    registers: [register],
  }),
  phishtankSecondaryChecks: new client.Counter({
    name: 'wbscanner_phishtank_secondary_checks_total',
    help: 'Phishtank secondary checks executed when GSB is inconclusive',
    registers: [register],
  }),
  phishtankSecondaryHits: new client.Counter({
    name: 'wbscanner_phishtank_secondary_hits_total',
    help: 'Phishtank hits observed during secondary checks, partitioned by verification status',
    labelNames: ['verified'],
    registers: [register],
  }),
  shortenerExpansion: new client.Counter({
    name: 'wbscanner_shortener_expansions_total',
    help: 'URL shortener expansion attempts by method and result',
    labelNames: ['method', 'result'],
    registers: [register],
  }),
  manualOverrideApplied: new client.Counter({
    name: 'wbscanner_manual_overrides_total',
    help: 'Manual overrides applied during scoring',
    labelNames: ['status'],
    registers: [register],
  }),
  rescanRequests: new client.Counter({
    name: 'wbscanner_rescan_requests_total',
    help: 'Rescan requests received by source',
    labelNames: ['source'],
    registers: [register],
  }),
  artifactDownloadFailures: new client.Counter({
    name: 'wbscanner_artifact_download_failures_total',
    help: 'Failures when downloading urlscan artifacts',
    labelNames: ['type', 'reason'],
    registers: [register],
  }),
  homoglyphDetections: new client.Counter({
    name: 'wbscanner_homoglyph_detections_total',
    help: 'Homoglyph detections by risk level',
    labelNames: ['risk_level'],
    registers: [register],
  }),
  whoisRequests: new client.Counter({
    name: 'wbscanner_whois_requests_total',
    help: 'WhoisXML lookups executed',
    registers: [register],
  }),
  whoisDisabled: new client.Counter({
    name: 'wbscanner_whois_disabled_total',
    help: 'WhoisXML disabled events by reason',
    labelNames: ['reason'],
    registers: [register],
  }),
  verdictCounter: new client.Counter({
    name: 'wbscanner_verdicts_total',
    help: 'Verdicts issued by level',
    labelNames: ['level'],
    registers: [register],
  }),
};

export const externalLatency = new client.Histogram({
  name: 'wbscanner_external_api_latency_seconds',
  help: 'External API latency by service',
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  labelNames: ['service'],
  registers: [register],
});

export const externalErrors = new client.Counter({
  name: 'wbscanner_external_api_errors_total',
  help: 'External API errors by service and type',
  labelNames: ['service', 'reason'],
  registers: [register],
});

export const circuitStates = new client.Gauge({
  name: 'wbscanner_circuit_breaker_state',
  help: 'Circuit breaker state per external service (0=closed,1=open,2=half-open)',
  labelNames: ['service'],
  registers: [register],
});

export const rateLimiterDelay = new client.Histogram({
  name: 'wbscanner_rate_limiter_delay_seconds',
  help: 'Delay introduced by rate limiters before external API calls',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  labelNames: ['service'],
  registers: [register],
});

export const apiQuotaRemainingGauge = new client.Gauge({
  name: 'wbscanner_api_quota_remaining',
  help: 'Remaining API quota tokens for external services',
  labelNames: ['service'],
  registers: [register],
});

export const apiQuotaStatusGauge = new client.Gauge({
  name: 'wbscanner_api_quota_status',
  help: 'API quota status (1=available,0=exhausted)',
  labelNames: ['service'],
  registers: [register],
});

export const apiQuotaDepletedCounter = new client.Counter({
  name: 'wbscanner_api_quota_depleted_total',
  help: 'Total number of times an external service quota was depleted',
  labelNames: ['service'],
  registers: [register],
});

export const cacheHitRatioGauge = new client.Gauge({
  name: 'wbscanner_cache_hit_ratio',
  help: 'Cache hit ratio by cache type',
  labelNames: ['cache_type'],
  registers: [register],
});

export const queueDepthGauge = new client.Gauge({
  name: 'wbscanner_queue_depth',
  help: 'Queue depth for BullMQ queues',
  labelNames: ['queue'],
  registers: [register],
});

export const circuitBreakerTransitionCounter = new client.Counter({
  name: 'wbscanner_circuit_breaker_transitions_total',
  help: 'Circuit breaker state transitions by service',
  labelNames: ['service', 'from', 'to'],
  registers: [register],
});

export const waSessionStatusGauge = new client.Gauge({
  name: 'wbscanner_wa_session_status',
  help: 'WhatsApp session status (1=ready,0=disconnected)',
  labelNames: ['state'],
  registers: [register],
});

export function metricsRoute() {
  return async (_req: any, res: any) => {
    res.header('Content-Type', register.contentType);
    res.send(await register.metrics());
  };
}
