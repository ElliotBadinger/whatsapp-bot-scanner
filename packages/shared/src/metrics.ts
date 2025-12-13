import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const metrics = {
  ingestionRate: new client.Counter({
    name: "wbscanner_messages_ingested_total",
    help: "Total messages ingested",
    registers: [register],
  }),
  urlsPerMessage: new client.Histogram({
    name: "wbscanner_urls_per_message",
    help: "URLs extracted per message",
    buckets: [0, 1, 2, 3, 5, 8, 13],
    registers: [register],
  }),
  scanLatency: new client.Histogram({
    name: "wbscanner_scan_latency_seconds",
    help: "End-to-end scan latency",
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [register],
  }),
  cacheHit: new client.Counter({
    name: "wbscanner_cache_hits_total",
    help: "Cache hits",
    registers: [register],
  }),
  cacheMiss: new client.Counter({
    name: "wbscanner_cache_misses_total",
    help: "Cache misses",
    registers: [register],
  }),
  vtSubmissions: new client.Counter({
    name: "wbscanner_vt_submissions_total",
    help: "VirusTotal submissions",
    registers: [register],
  }),
  gsbHits: new client.Counter({
    name: "wbscanner_gsb_hits_total",
    help: "Google Safe Browsing hits",
    registers: [register],
  }),
  phishtankSecondaryChecks: new client.Counter({
    name: "wbscanner_phishtank_secondary_checks_total",
    help: "Phishtank secondary checks executed when GSB is inconclusive",
    registers: [register],
  }),
  phishtankSecondaryHits: new client.Counter({
    name: "wbscanner_phishtank_secondary_hits_total",
    help: "Phishtank hits observed during secondary checks, partitioned by verification status",
    labelNames: ["verified"],
    registers: [register],
  }),
  shortenerExpansion: new client.Counter({
    name: "wbscanner_shortener_expansions_total",
    help: "URL shortener expansion attempts by method and result",
    labelNames: ["method", "result"],
    registers: [register],
  }),
  manualOverrideApplied: new client.Counter({
    name: "wbscanner_manual_overrides_total",
    help: "Manual overrides applied during scoring",
    labelNames: ["status"],
    registers: [register],
  }),
  rescanRequests: new client.Counter({
    name: "wbscanner_rescan_requests_total",
    help: "Rescan requests received by source",
    labelNames: ["source"],
    registers: [register],
  }),
  artifactDownloadFailures: new client.Counter({
    name: "wbscanner_artifact_download_failures_total",
    help: "Failures when downloading urlscan artifacts",
    labelNames: ["type", "reason"],
    registers: [register],
  }),
  homoglyphDetections: new client.Counter({
    name: "wbscanner_homoglyph_detections_total",
    help: "Homoglyph detections by risk level",
    labelNames: ["risk_level"],
    registers: [register],
  }),
  whoisRequests: new client.Counter({
    name: "wbscanner_whois_requests_total",
    help: "WhoisXML lookups executed",
    registers: [register],
  }),
  whoisResults: new client.Counter({
    name: "wbscanner_whois_results_total",
    help: "WhoisXML lookup outcomes by result",
    labelNames: ["result"],
    registers: [register],
  }),
  whoisDisabled: new client.Counter({
    name: "wbscanner_whois_disabled_total",
    help: "WhoisXML disabled events by reason",
    labelNames: ["reason"],
    registers: [register],
  }),
  verdictCounter: new client.Counter({
    name: "wbscanner_verdicts_total",
    help: "Verdicts issued by level",
    labelNames: ["level"],
    registers: [register],
  }),
  degradedModeEvents: new client.Counter({
    name: "wbscanner_degraded_mode_events_total",
    help: "Scans processed while operating in degraded mode",
    registers: [register],
  }),
  externalScannersDegraded: new client.Gauge({
    name: "wbscanner_external_scanners_degraded",
    help: "Indicates if all external scanners are degraded (1) or operational (0)",
    registers: [register],
  }),
  cacheLookupDuration: new client.Histogram({
    name: "wbscanner_cache_lookup_duration_seconds",
    help: "Latency of cache lookups by cache type",
    labelNames: ["cache_type"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    registers: [register],
  }),
  cacheWriteDuration: new client.Histogram({
    name: "wbscanner_cache_write_duration_seconds",
    help: "Latency of cache writes by cache type",
    labelNames: ["cache_type"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    registers: [register],
  }),
  cacheEntryBytes: new client.Gauge({
    name: "wbscanner_cache_entry_bytes",
    help: "Serialized cache entry size by cache type",
    labelNames: ["cache_type"],
    registers: [register],
  }),
  cacheRefreshTotal: new client.Counter({
    name: "wbscanner_cache_refresh_total",
    help: "Cache refresh operations by cache type",
    labelNames: ["cache_type"],
    registers: [register],
  }),
  cacheStaleTotal: new client.Counter({
    name: "wbscanner_cache_stale_total",
    help: "Cache hits considered stale by cache type",
    labelNames: ["cache_type"],
    registers: [register],
  }),
  cacheEntryTtl: new client.Gauge({
    name: "wbscanner_cache_entry_ttl_seconds",
    help: "Remaining TTL for cache entries by cache type",
    labelNames: ["cache_type"],
    registers: [register],
  }),
  verdictScore: new client.Histogram({
    name: "wbscanner_verdict_score",
    help: "Distribution of computed risk scores",
    buckets: [0, 2, 4, 6, 8, 10, 12, 15, 20],
    registers: [register],
  }),
  verdictReasons: new client.Counter({
    name: "wbscanner_verdict_reasons_total",
    help: "Reasons contributing to final verdicts",
    labelNames: ["reason"],
    registers: [register],
  }),
  verdictSignals: new client.Counter({
    name: "wbscanner_verdict_signals_total",
    help: "Signals observed while composing verdicts",
    labelNames: ["signal"],
    registers: [register],
  }),
  verdictLatency: new client.Histogram({
    name: "wbscanner_verdict_latency_seconds",
    help: "Latency from ingestion to verdict emission",
    buckets: [0.5, 1, 2, 5, 10, 20, 40, 80],
    registers: [register],
  }),
  verdictCacheTtl: new client.Histogram({
    name: "wbscanner_verdict_cache_ttl_seconds",
    help: "Cache TTL assigned to verdict responses",
    buckets: [300, 900, 1800, 3600, 7200, 14400, 28800, 86400],

    registers: [register],
  }),
  scanPathCounter: new client.Counter({
    name: "wbscanner_scan_path_total",
    help: "Scans processed by path type (fast vs deep)",
    labelNames: ["path", "verdict"],
    registers: [register],
  }),
  verdictCorrections: new client.Counter({
    name: "wbscanner_verdict_corrections_total",
    help: "Verdict corrections issued",
    labelNames: ["from", "to"],
    registers: [register],
  }),
  fastPathLatency: new client.Histogram({
    name: "wbscanner_fast_path_latency_seconds",
    help: "Latency of Fast Path scans",
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [register],
  }),
  deepScanLatency: new client.Histogram({
    name: "wbscanner_deep_scan_latency_seconds",
    help: "Latency of Deep Scan analysis",
    buckets: [1, 2, 5, 10, 20, 40, 60],
    registers: [register],
  }),
  verdictEscalations: new client.Counter({
    name: "wbscanner_verdict_escalations_total",
    help: "Verdict transitions compared to cached decision",
    labelNames: ["from", "to"],
    registers: [register],
  }),
  queueJobWait: new client.Histogram({
    name: "wbscanner_queue_job_wait_seconds",
    help: "Time jobs spend waiting in queue before execution",
    labelNames: ["queue"],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
    registers: [register],
  }),
  queueProcessingDuration: new client.Histogram({
    name: "wbscanner_queue_processing_duration_seconds",
    help: "Job processing duration per queue",
    labelNames: ["queue"],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 40, 80],
    registers: [register],
  }),
  queueCompleted: new client.Counter({
    name: "wbscanner_queue_completed_total",
    help: "Jobs completed by queue",
    labelNames: ["queue"],
    registers: [register],
  }),
  queueRetries: new client.Counter({
    name: "wbscanner_queue_retries_total",
    help: "Retry attempts by queue",
    labelNames: ["queue"],
    registers: [register],
  }),
  queueFailures: new client.Counter({
    name: "wbscanner_queue_failures_total",
    help: "Failed jobs by queue",
    labelNames: ["queue"],
    registers: [register],
  }),
  queueActive: new client.Gauge({
    name: "wbscanner_queue_active_jobs",
    help: "Active jobs per queue",
    labelNames: ["queue"],
    registers: [register],
  }),
  queueDelayed: new client.Gauge({
    name: "wbscanner_queue_delayed_jobs",
    help: "Delayed jobs per queue",
    labelNames: ["queue"],
    registers: [register],
  }),
  queueFailedGauge: new client.Gauge({
    name: "wbscanner_queue_failed_jobs",
    help: "Failed job backlog per queue",
    labelNames: ["queue"],
    registers: [register],
  }),
  waMessagesReceived: new client.Counter({
    name: "wbscanner_wa_messages_received_total",
    help: "WhatsApp messages received by chat type",
    labelNames: ["chat_type"],
    registers: [register],
  }),
  waMessagesWithUrls: new client.Counter({
    name: "wbscanner_wa_messages_with_urls_total",
    help: "WhatsApp messages containing URLs",
    labelNames: ["chat_type"],
    registers: [register],
  }),
  waMessagesDropped: new client.Counter({
    name: "wbscanner_wa_messages_dropped_total",
    help: "WhatsApp messages dropped before scanning by reason",
    labelNames: ["reason"],
    registers: [register],
  }),
  waSessionReconnects: new client.Counter({
    name: "wbscanner_wa_session_events_total",
    help: "WhatsApp client session lifecycle events",
    labelNames: ["event"],
    registers: [register],
  }),
  waQrCodesGenerated: new client.Counter({
    name: "wbscanner_wa_qr_generated_total",
    help: "QR codes generated for WhatsApp reauthentication",
    registers: [register],
  }),
  waVerdictsSent: new client.Counter({
    name: "wbscanner_wa_verdict_messages_sent_total",
    help: "Verdict messages sent back to WhatsApp groups",
    registers: [register],
  }),
  waVerdictFailures: new client.Counter({
    name: "wbscanner_wa_verdict_messages_failed_total",
    help: "Failed attempts to send verdict messages",
    registers: [register],
  }),
  waVerdictLatency: new client.Histogram({
    name: "wbscanner_wa_verdict_delivery_latency_seconds",
    help: "Latency between verdict availability and WhatsApp delivery",
    buckets: [0.5, 1, 2, 5, 10, 20, 40],
    registers: [register],
  }),
  waResponseLatency: new client.Histogram({
    name: "wbscanner_wa_response_latency_seconds",
    help: "End-to-end latency between receiving a WhatsApp message and sending a bot response",
    buckets: [0.5, 1, 2, 5, 10, 20, 40, 80],
    registers: [register],
  }),
  waMessageEdits: new client.Counter({
    name: "wbscanner_wa_message_edits_total",
    help: "WhatsApp message edit events handled by cause",
    labelNames: ["cause"],
    registers: [register],
  }),
  waMessageRevocations: new client.Counter({
    name: "wbscanner_wa_message_revocations_total",
    help: "WhatsApp message revocation events by scope",
    labelNames: ["scope"],
    registers: [register],
  }),
  waMessageReactions: new client.Counter({
    name: "wbscanner_wa_message_reactions_total",
    help: "WhatsApp message reaction events grouped by reaction emoji",
    labelNames: ["reaction"],
    registers: [register],
  }),
  waVerdictAckTransitions: new client.Counter({
    name: "wbscanner_wa_verdict_ack_transitions_total",
    help: "Ack transitions observed for verdict messages",
    labelNames: ["from", "to"],
    registers: [register],
  }),
  waVerdictAckTimeouts: new client.Counter({
    name: "wbscanner_wa_verdict_ack_timeouts_total",
    help: "Verdict delivery attempts that exceeded ack thresholds",
    labelNames: ["reason"],
    registers: [register],
  }),
  waVerdictRetryAttempts: new client.Counter({
    name: "wbscanner_wa_verdict_retries_total",
    help: "Verdict resend attempts by outcome",
    labelNames: ["outcome"],
    registers: [register],
  }),
  waVerdictDelivery: new client.Counter({
    name: "wbscanner_wa_verdict_delivery_total",
    help: "Verdict delivery outcomes recorded by result",
    labelNames: ["outcome"],
    registers: [register],
  }),
  waVerdictDeliveryRetries: new client.Counter({
    name: "wbscanner_wa_verdict_delivery_retries_total",
    help: "Verdict resend attempts triggered by ack workflows",
    labelNames: ["reason"],
    registers: [register],
  }),
  waVerdictAttachmentsSent: new client.Counter({
    name: "wbscanner_wa_verdict_attachments_total",
    help: "Media attachments delivered alongside verdicts by type",
    labelNames: ["type"],
    registers: [register],
  }),
  waGroupEvents: new client.Counter({
    name: "wbscanner_wa_group_events_total",
    help: "Group lifecycle and governance events observed",
    labelNames: ["event"],
    registers: [register],
  }),
  waGovernanceActions: new client.Counter({
    name: "wbscanner_wa_governance_actions_total",
    help: "Group governance interventions executed by action",
    labelNames: ["action"],
    registers: [register],
  }),
  waGovernanceRateLimited: new client.Counter({
    name: "wbscanner_wa_governance_rate_limited_total",
    help: "Governance actions skipped due to rate limiting by action",
    labelNames: ["action"],
    registers: [register],
  }),
  waMembershipApprovals: new client.Counter({
    name: "wbscanner_wa_membership_approvals_total",
    help: "Membership approvals handled by mode",
    labelNames: ["mode"],
    registers: [register],
  }),
  waConsentGauge: new client.Gauge({
    name: "wbscanner_wa_group_consent_pending",
    help: "Number of WhatsApp groups awaiting consent acknowledgment",
    registers: [register],
  }),
  waSessionState: new client.Gauge({
    name: "wbscanner_wa_session_state",
    help: "Current WhatsApp client state indicator (1 for current state, 0 otherwise)",
    labelNames: ["state"],
    registers: [register],
  }),
  waStateChanges: new client.Counter({
    name: "wbscanner_wa_state_changes_total",
    help: "WhatsApp state transition events emitted by wa-client",
    labelNames: ["event", "state"],
    registers: [register],
  }),
  waConsecutiveAuthFailures: new client.Gauge({
    name: "wbscanner_wa_auth_consecutive_failures",
    help: "Count of consecutive authentication failures per client instance",
    labelNames: ["client"],
    registers: [register],
  }),
  waIncomingCalls: new client.Counter({
    name: "wbscanner_wa_incoming_calls_total",
    help: "Incoming WhatsApp calls handled by action",
    labelNames: ["action"],
    registers: [register],
  }),
  apiQuotaConsumption: new client.Counter({
    name: "wbscanner_api_quota_consumption_total",
    help: "API quota tokens consumed by service",
    labelNames: ["service"],
    registers: [register],
  }),
  apiQuotaResets: new client.Counter({
    name: "wbscanner_api_quota_resets_total",
    help: "API quota reset events by service",
    labelNames: ["service"],
    registers: [register],
  }),
  apiQuotaProjectedDepletion: new client.Gauge({
    name: "wbscanner_api_quota_projected_depletion_seconds",
    help: "Projected seconds until quota depletion by service",
    labelNames: ["service"],
    registers: [register],
  }),
  apiQuotaUtilization: new client.Gauge({
    name: "wbscanner_api_quota_utilization_ratio",
    help: "Fraction of quota consumed by service",
    labelNames: ["service"],
    registers: [register],
  }),
  inputValidationFailures: new client.Counter({
    name: "wbscanner_input_validation_failures_total",
    help: "Input validation failures by service and schema type",
    labelNames: ["service", "schema"],
    registers: [register],
  }),
};

export const externalLatency = new client.Histogram({
  name: "wbscanner_external_api_latency_seconds",
  help: "External API latency by service",
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  labelNames: ["service"],
  registers: [register],
});

export const externalErrors = new client.Counter({
  name: "wbscanner_external_api_errors_total",
  help: "External API errors by service and type",
  labelNames: ["service", "reason"],
  registers: [register],
});

export const circuitStates = new client.Gauge({
  name: "wbscanner_circuit_breaker_state",
  help: "Circuit breaker state per external service (0=closed,1=open,2=half-open)",
  labelNames: ["service"],
  registers: [register],
});

export const rateLimiterDelay = new client.Histogram({
  name: "wbscanner_rate_limiter_delay_seconds",
  help: "Delay introduced by rate limiters before external API calls",
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  labelNames: ["service"],
  registers: [register],
});

export const apiQuotaRemainingGauge = new client.Gauge({
  name: "wbscanner_api_quota_remaining",
  help: "Remaining API quota tokens for external services",
  labelNames: ["service"],
  registers: [register],
});

export const apiQuotaStatusGauge = new client.Gauge({
  name: "wbscanner_api_quota_status",
  help: "API quota status (1=available,0=exhausted)",
  labelNames: ["service"],
  registers: [register],
});

export const apiQuotaDepletedCounter = new client.Counter({
  name: "wbscanner_api_quota_depleted_total",
  help: "Total number of times an external service quota was depleted",
  labelNames: ["service"],
  registers: [register],
});

export const cacheHitRatioGauge = new client.Gauge({
  name: "wbscanner_cache_hit_ratio",
  help: "Cache hit ratio by cache type",
  labelNames: ["cache_type"],
  registers: [register],
});

export const queueDepthGauge = new client.Gauge({
  name: "wbscanner_queue_depth",
  help: "Queue depth for BullMQ queues",
  labelNames: ["queue"],
  registers: [register],
});

export const circuitBreakerTransitionCounter = new client.Counter({
  name: "wbscanner_circuit_breaker_transitions_total",
  help: "Circuit breaker state transitions by service",
  labelNames: ["service", "from", "to"],
  registers: [register],
});

export const waSessionStatusGauge = new client.Gauge({
  name: "wbscanner_wa_session_status",
  help: "WhatsApp session status (1=ready,0=disconnected)",
  labelNames: ["state"],
  registers: [register],
});

export const circuitBreakerRejections = new client.Counter({
  name: "wbscanner_circuit_breaker_rejections_total",
  help: "Requests rejected due to open circuit breakers by service",
  labelNames: ["service"],
  registers: [register],
});

export const circuitBreakerOpenDuration = new client.Histogram({
  name: "wbscanner_circuit_breaker_open_duration_seconds",
  help: "Duration circuits remain open before recovery",
  labelNames: ["service"],
  buckets: [5, 10, 30, 60, 120, 300, 600, 1200],
  registers: [register],
});

export const rateLimiterQueueDepth = new client.Gauge({
  name: "wbscanner_rate_limiter_queue_depth",
  help: "Jobs queued inside external API rate limiters",
  labelNames: ["service"],
  registers: [register],
});

export function metricsRoute() {
  // Using minimal types to avoid Express dependency in shared package
  return async (
    _req: { header?: unknown },
    res: {
      header: (name: string, value: string) => void;
      send: (data: string) => void;
    },
  ) => {
    res.header("Content-Type", register.contentType);
    res.send(await register.metrics());
  };
}
