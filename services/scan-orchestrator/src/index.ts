import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import Redis from "ioredis";
import { Queue, Worker } from "bullmq";
import {
  config,
  logger,
  register,
  metrics,
  externalLatency,
  externalErrors,
  circuitStates,
  circuitBreakerTransitionCounter,
  circuitBreakerRejections,
  circuitBreakerOpenDuration,
  queueDepthGauge,
  cacheHitRatioGauge,
  normalizeUrl,
  expandUrl,
  urlHash,
  gsbLookup,
  vtAnalyzeUrl,
  vtVerdictStats,
  domainAgeDaysFromRdap,
  extraHeuristics,
  scoreFromSignals,
  urlhausLookup,
  phishtankLookup,
  submitUrlscan,
  resolveShortener,
  whoisXmlLookup,
  disableWhoisXmlForMonth,
  whoDatLookup,
  CircuitBreaker,
  CircuitState,
  withRetry,
  QuotaExceededError,
  detectHomoglyphs,
  assertEssentialConfig,
  GsbLocalDatabase,
  ScanRequestSchema,
  createRedisConnection,
  connectRedis,
  TEST_REDIS_KEY,
  TEST_QUEUE_FACTORY_KEY,
  InMemoryRedis,
} from "@wbscanner/shared";
import { EnhancedSecurityAnalyzer } from "./enhanced-security";
import {
  checkBlocklistsWithRedundancy,
  shouldQueryPhishtank,
  type GsbFetchResult,
  type PhishtankFetchResult,
} from "./blocklists";
import type {
  GsbThreatMatch,
  UrlhausLookupResult,
  PhishtankLookupResult,
  VirusTotalAnalysis,
  UrlscanSubmissionResponse,
  HomoglyphResult,
} from "@wbscanner/shared";
import { downloadUrlscanArtifacts } from "./urlscan-artifacts";
import { getSharedConnection, type IDatabaseConnection } from "./database";

// Global GSB Local instance (initialized in main())
let gsbLocal: GsbLocalDatabase | null = null;

class InMemoryQueue {
  constructor(private readonly name: string) {}
  async add(jobName: string, data: unknown) {
    return { id: `${this.name}:${jobName}:${Date.now()}`, data };
  }
  async getJobCounts() {
    return { waiting: 0, active: 0, delayed: 0, failed: 0 };
  }
  async getWaitingCount() {
    return 0;
  }
  on(): void {
    // intentionally no-op: event hooks are not required for in-memory queue used in tests
    // NOSONAR
  }
  async close(): Promise<void> {
    return Promise.resolve();
  }
}

let redis!: Redis;
let scanRequestQueue!: Queue;
let scanVerdictQueue!: Queue;
let urlscanQueue!: Queue;
let deepScanQueue!: Queue;

function createQueue(name: string, options: { connection: Redis }): Queue {
  if (typeof globalThis !== "undefined") {
    const factory = (globalThis as unknown as Record<string, unknown>)[
      TEST_QUEUE_FACTORY_KEY
    ];
    if (typeof factory === "function") {
      return factory(name, options) as Queue;
    }
  }
  if (process.env.NODE_ENV === "test") {
    return new InMemoryQueue(name) as unknown as Queue;
  }
  return new Queue(name, options);
}

const ANALYSIS_TTLS = {
  gsb: 60 * 60,
  phishtank: 60 * 60,
  vt: 60 * 60,
  urlhaus: 60 * 60,
  urlscan: 60 * 60,
  whois: 7 * 24 * 60 * 60,
};

const URLSCAN_UUID_PREFIX = "urlscan:uuid:";
const URLSCAN_QUEUED_PREFIX = "urlscan:queued:";
const URLSCAN_SUBMITTED_PREFIX = "urlscan:submitted:";
const URLSCAN_RESULT_PREFIX = "urlscan:result:";
const SHORTENER_CACHE_PREFIX = "url:shortener:";

const CACHE_LABELS = {
  gsb: "gsb_analysis",
  phishtank: "phishtank_analysis",
  vt: "virustotal_analysis",
  urlhaus: "urlhaus_analysis",
  shortener: "shortener_resolution",
  whois: "whois_analysis",
  verdict: "scan_result",
} as const;

const CIRCUIT_DEFAULTS = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 30_000,
  windowMs: 60_000,
} as const;

const CIRCUIT_LABELS = {
  gsb: "google_safe_browsing",
  phishtank: "phishtank",
  urlhaus: "urlhaus",
  vt: "virustotal",
  urlscan: "urlscan",
  whoisxml: "whoisxml",
  whodat: "whodat",
} as const;

const cacheRatios = new Map<string, { hits: number; misses: number }>();
const circuitOpenSince = new Map<string, number>();

const VERDICT_REASON_OTHER_LABEL = "other";

// Refactored normalizeVerdictReason function (complexity 28 -> 15)
function normalizeVerdictReason(reason: string): string {
  // Manual overrides
  if (reason === "Manually allowed") return "manual_allow";
  if (reason === "Manually blocked") return "manual_deny";

  // Google Safe Browsing threats
  if (reason.startsWith("Google Safe Browsing")) {
    if (reason.includes("MALWARE")) return "gsb_malware";
    if (reason.includes("SOCIAL_ENGINEERING")) return "gsb_social_engineering";
    return "gsb_threat";
  }

  // Blocklist threats
  if (reason === "Verified phishing (Phishtank)") return "phishtank_verified";
  if (reason === "Known malware distribution (URLhaus)")
    return "urlhaus_listed";

  // VirusTotal threats
  if (reason.includes("VT engine")) return "vt_malicious";

  // Domain age threats
  if (reason.startsWith("Domain registered")) {
    if (reason.includes("<7")) return "domain_age_lt7";
    if (reason.includes("<14")) return "domain_age_lt14";
    if (reason.includes("<30")) return "domain_age_lt30";
    return "domain_age";
  }

  // Homoglyph threats
  if (reason.startsWith("High-risk homoglyph attack detected"))
    return "homoglyph_high";
  if (
    reason.startsWith("Suspicious characters detected") ||
    reason === "Suspicious homoglyph characters detected"
  )
    return "homoglyph_medium";
  if (reason === "Punycode/IDN domain detected") return "homoglyph_low";

  // URL structure threats
  if (reason === "URL uses IP address") return "ip_literal";
  if (reason === "Suspicious TLD") return "suspicious_tld";
  if (reason.startsWith("Multiple redirects")) return "multiple_redirects";
  if (reason === "Uncommon port") return "uncommon_port";
  if (reason.startsWith("Long URL")) return "long_url";
  if (reason === "Executable file extension") return "executable_extension";
  if (reason === "Shortened URL expanded") return "shortener_expanded";
  if (reason === "Redirect leads to mismatched domain/brand")
    return "redirect_mismatch";

  return VERDICT_REASON_OTHER_LABEL;
}

function recordCacheOutcome(cacheType: string, outcome: "hit" | "miss"): void {
  const state = cacheRatios.get(cacheType) ?? { hits: 0, misses: 0 };
  if (outcome === "hit") {
    state.hits += 1;
  } else {
    state.misses += 1;
  }
  cacheRatios.set(cacheType, state);
  const total = state.hits + state.misses;
  if (total > 0) {
    cacheHitRatioGauge.labels(cacheType).set(state.hits / total);
  }
}

async function refreshQueueMetrics(queue: Queue, name: string): Promise<void> {
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "delayed",
    "failed",
  );
  queueDepthGauge.labels(name).set(counts.waiting ?? 0);
  metrics.queueActive.labels(name).set(counts.active ?? 0);
  metrics.queueDelayed.labels(name).set(counts.delayed ?? 0);
  metrics.queueFailedGauge.labels(name).set(counts.failed ?? 0);
}

function makeCircuit(name: string) {
  const breaker = new CircuitBreaker({
    ...CIRCUIT_DEFAULTS,
    name,
    onStateChange: (state, from) => {
      circuitStates.labels(name).set(state);
      circuitBreakerTransitionCounter
        .labels(name, String(from ?? ""), String(state))
        .inc();
      const now = Date.now();
      if (state === CircuitState.OPEN) {
        circuitOpenSince.set(name, now);
      } else if (from === CircuitState.OPEN) {
        const openedAt = circuitOpenSince.get(name);
        if (openedAt) {
          circuitBreakerOpenDuration
            .labels(name)
            .observe((now - openedAt) / 1000);
          circuitOpenSince.delete(name);
        }
      }
      logger.debug({ name, from, to: state }, "Circuit state change");
    },
  });
  circuitStates.labels(name).set(CircuitState.CLOSED);
  return breaker;
}

const gsbCircuit = makeCircuit(CIRCUIT_LABELS.gsb);
const phishtankCircuit = makeCircuit(CIRCUIT_LABELS.phishtank);
const urlhausCircuit = makeCircuit(CIRCUIT_LABELS.urlhaus);
const vtCircuit = makeCircuit(CIRCUIT_LABELS.vt);
const urlscanCircuit = makeCircuit(CIRCUIT_LABELS.urlscan);
const whoisCircuit = makeCircuit(CIRCUIT_LABELS.whoisxml);
const whodatCircuit = makeCircuit(CIRCUIT_LABELS.whodat);

function recordLatency(service: string, ms?: number) {
  if (typeof ms === "number" && ms >= 0) {
    externalLatency.labels(service).observe(ms / 1000);
  }
}

function classifyError(err: unknown): string {
  const rawCode =
    (err as { code?: string | number; statusCode?: string | number })?.code ??
    (err as { statusCode?: string | number })?.statusCode;
  if (
    rawCode === "UND_ERR_HEADERS_TIMEOUT" ||
    rawCode === "UND_ERR_CONNECT_TIMEOUT"
  )
    return "timeout";
  const codeNum = typeof rawCode === "string" ? Number(rawCode) : rawCode;
  if (codeNum === 429) return "rate_limited";
  if (codeNum === 408) return "timeout";
  if (typeof codeNum === "number" && codeNum >= 500) return "server_error";
  if (typeof codeNum === "number" && codeNum >= 400) return "client_error";
  const message = (err as Error)?.message || "";
  if (message.includes("Circuit") && message.includes("open"))
    return "circuit_open";
  return "unknown";
}

function recordError(service: string, err: unknown) {
  const reason = classifyError(err);
  if (reason === "circuit_open") {
    circuitBreakerRejections.labels(service).inc();
  }
  externalErrors.labels(service, reason).inc();
}

function shouldRetry(err: unknown): boolean {
  const rawCode =
    (err as { code?: string | number; statusCode?: string | number })?.code ??
    (err as { statusCode?: string | number })?.statusCode;
  if (
    rawCode === "UND_ERR_HEADERS_TIMEOUT" ||
    rawCode === "UND_ERR_CONNECT_TIMEOUT"
  )
    return true;
  const codeNum = typeof rawCode === "string" ? Number(rawCode) : rawCode;
  if (codeNum === 429) return false;
  if (codeNum === 408) return true;
  if (typeof codeNum === "number" && codeNum >= 500) return true;
  return !codeNum;
}

async function getJsonCache<T>(
  cacheType: string,
  key: string,
  ttlSeconds: number,
): Promise<T | null> {
  const stop = metrics.cacheLookupDuration.labels(cacheType).startTimer();
  const raw = await redis.get(key);
  stop();
  if (!raw) {
    recordCacheOutcome(cacheType, "miss");
    metrics.cacheEntryTtl.labels(cacheType).set(0);
    return null;
  }
  recordCacheOutcome(cacheType, "hit");
  metrics.cacheEntryBytes.labels(cacheType).set(Buffer.byteLength(raw));
  const ttlRemaining = await redis.ttl(key);
  if (ttlRemaining >= 0) {
    metrics.cacheEntryTtl.labels(cacheType).set(ttlRemaining);
    if (
      ttlSeconds > 0 &&
      ttlRemaining < Math.max(1, Math.floor(ttlSeconds * 0.2))
    ) {
      metrics.cacheStaleTotal.labels(cacheType).inc();
    }
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    metrics.cacheStaleTotal.labels(cacheType).inc();
    return null;
  }
}

async function setJsonCache(
  cacheType: string,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const payload = JSON.stringify(value);
  const stop = metrics.cacheWriteDuration.labels(cacheType).startTimer();
  await redis.set(key, payload, "EX", ttlSeconds);
  stop();
  metrics.cacheRefreshTotal.labels(cacheType).inc();
  metrics.cacheEntryBytes.labels(cacheType).set(Buffer.byteLength(payload));
  metrics.cacheEntryTtl.labels(cacheType).set(ttlSeconds);
}

type GsbMatch = GsbThreatMatch;
type VtStats = ReturnType<typeof vtVerdictStats>;
type UrlhausResult = UrlhausLookupResult;
type PhishtankResult = PhishtankLookupResult;

type ArtifactCandidate = {
  type: "screenshot" | "dom";
  url: string;
};

function normalizeUrlscanArtifactCandidate(
  candidate: unknown,
  baseUrl: string,
): { url?: string; invalid: boolean } {
  if (typeof candidate !== "string") return { invalid: false };
  const trimmed = candidate.trim();
  if (!trimmed) return { invalid: false };

  const sanitizedBase = baseUrl.replace(/\/+$/, "");
  let trustedHostname: string;
  try {
    trustedHostname = new URL(sanitizedBase).hostname.toLowerCase();
  } catch {
    return { invalid: true };
  }

  const rawUrl = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${sanitizedBase}/${trimmed.replace(/^\/+/, "")}`;

  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return { invalid: true };
  }

  const parsed = new URL(normalized);
  const candidateHostname = parsed.hostname.toLowerCase();
  const hostAllowed =
    candidateHostname === trustedHostname ||
    candidateHostname.endsWith(`.${trustedHostname}`);

  if (!hostAllowed) {
    return { invalid: true };
  }

  return { url: parsed.toString(), invalid: false };
}

function normaliseArtifactUrl(
  candidate: unknown,
  baseUrl: string,
): string | undefined {
  const result = normalizeUrlscanArtifactCandidate(candidate, baseUrl);
  return result.url;
}

function extractUrlscanArtifactCandidates(
  uuid: string,
  payload: unknown,
): ArtifactCandidate[] {
  const baseUrl = (config.urlscan.baseUrl || "https://urlscan.io").replace(
    /\/+$/,
    "",
  );
  const candidates: ArtifactCandidate[] = [];
  const seen = new Set<string>();

  const p = payload as {
    screenshotURL?: string;
    domURL?: string;
    task?: { screenshotURL?: string; domURL?: string };
    visual?: { data?: { screenshotURL?: string } };
  };

  const screenshotSources = [
    p?.screenshotURL,
    p?.task?.screenshotURL,
    p?.visual?.data?.screenshotURL,
    `${baseUrl}/screenshots/${uuid}.png`,
  ];

  for (const source of screenshotSources) {
    const resolved = normaliseArtifactUrl(source, baseUrl);
    if (resolved && !seen.has(`screenshot:${resolved}`)) {
      seen.add(`screenshot:${resolved}`);
      candidates.push({ type: "screenshot", url: resolved });
    }
  }

  const domSources = [
    p?.domURL,
    p?.task?.domURL,
    `${baseUrl}/dom/${uuid}.json`,
  ];

  for (const source of domSources) {
    const resolved = normaliseArtifactUrl(source, baseUrl);
    if (resolved && !seen.has(`dom:${resolved}`)) {
      seen.add(`dom:${resolved}`);
      candidates.push({ type: "dom", url: resolved });
    }
  }

  return candidates;
}

async function fetchGsbAnalysis(
  finalUrl: string,
  hash: string,
): Promise<GsbFetchResult> {
  if (!config.gsb.enabled) {
    logger.warn({ url: finalUrl }, "Google Safe Browsing disabled by config");
    return { matches: [], fromCache: true, durationMs: 0, error: null };
  }
  const cacheKey = `url:analysis:${hash}:gsb`;
  const cached = await getJsonCache<{
    matches: GsbThreatMatch[];
    cached: true;
  }>(CACHE_LABELS.gsb, cacheKey, ANALYSIS_TTLS.gsb);
  if (cached) {
    recordCacheOutcome("gsb", "hit");
    return {
      matches: cached.matches,
      error: null,
      fromCache: true,
      durationMs: 0,
    };
  }
  recordCacheOutcome("gsb", "miss");
  try {
    const start = Date.now();

    // Use local GSB if available, fallback to remote API
    let result;
    const localGsb = gsbLocal;
    if (localGsb) {
      result = await localGsb.lookup([finalUrl]);
      recordLatency(CIRCUIT_LABELS.gsb, Date.now() - start);

      // Track whether we used local or remote
      if (result.source === "local") {
        logger.debug(
          { url: finalUrl, latency: result.latencyMs },
          "GSB local lookup (no API call)",
        );
      } else {
        logger.debug(
          { url: finalUrl, latency: result.latencyMs },
          "GSB local lookup with remote verification",
        );
      }
    } else {
      // Fallback to traditional API
      result = await gsbCircuit.execute(() =>
        withRetry(() => gsbLookup([finalUrl]), {
          retries: 2,
          baseDelayMs: 500,
          factor: 2,
          retryable: shouldRetry,
        }),
      );
      recordLatency(CIRCUIT_LABELS.gsb, Date.now() - start);
    }

    const rawMatches = result.matches || [];
    // Normalize GsbLocalThreatMatch to GsbThreatMatch format
    const matches: GsbThreatMatch[] = rawMatches.map((m: any) => {
      if ("platformType" in m) return m as GsbThreatMatch;
      return {
        threatType: m.threatType,
        platformType: "ANY_PLATFORM",
        threatEntryType: "URL",
        threat: finalUrl,
      } as GsbThreatMatch;
    });
    await setJsonCache(
      CACHE_LABELS.gsb,
      cacheKey,
      { matches, cached: true },
      ANALYSIS_TTLS.gsb,
    );
    return {
      matches,
      error: null,
      fromCache: false,
      durationMs: result.latencyMs ?? 0,
    };
  } catch (err) {
    recordError(CIRCUIT_LABELS.gsb, err);
    logger.warn({ err, url: finalUrl }, "GSB analysis failed");
    return {
      matches: [],
      error: err as Error,
      fromCache: false,
      durationMs: 0,
    };
  }
}

async function fetchPhishtank(
  finalUrl: string,
  hash: string,
): Promise<PhishtankFetchResult> {
  if (!config.phishtank.enabled) {
    return { result: null, fromCache: true, error: null };
  }
  const cacheKey = `url:analysis:${hash}:phishtank`;
  const cached = await getJsonCache<PhishtankResult>(
    CACHE_LABELS.phishtank,
    cacheKey,
    ANALYSIS_TTLS.phishtank,
  );
  if (cached) {
    return { result: cached, fromCache: true, error: null };
  }
  try {
    const result = await phishtankCircuit.execute(() =>
      withRetry(() => phishtankLookup(finalUrl), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      }),
    );
    recordLatency(CIRCUIT_LABELS.phishtank, result.latencyMs);
    await setJsonCache(
      CACHE_LABELS.phishtank,
      cacheKey,
      result,
      ANALYSIS_TTLS.phishtank,
    );
    return { result, fromCache: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.phishtank, err);
    logger.warn({ err, url: finalUrl }, "Phishtank lookup failed");
    return { result: null, fromCache: false, error: err as Error };
  }
}

interface VirusTotalFetchResult {
  stats?: VtStats;
  fromCache: boolean;
  quotaExceeded: boolean;
  error: Error | null;
}

async function fetchVirusTotal(
  finalUrl: string,
  hash: string,
): Promise<VirusTotalFetchResult> {
  if (!config.vt.enabled || !config.vt.apiKey) {
    if (!config.vt.enabled)
      logger.warn({ url: finalUrl }, "VirusTotal disabled by config");
    return {
      stats: undefined,
      fromCache: true,
      quotaExceeded: false,
      error: null,
    };
  }
  const cacheKey = `url:analysis:${hash}:vt`;
  const cached = await getJsonCache<VtStats>(
    CACHE_LABELS.vt,
    cacheKey,
    ANALYSIS_TTLS.vt,
  );
  if (cached) {
    return {
      stats: cached,
      fromCache: true,
      quotaExceeded: false,
      error: null,
    };
  }
  try {
    const analysis = await vtCircuit.execute(() =>
      withRetry(() => vtAnalyzeUrl(finalUrl), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      }),
    );
    recordLatency(CIRCUIT_LABELS.vt, analysis.latencyMs);
    const stats = vtVerdictStats(analysis as VirusTotalAnalysis);
    if (stats) {
      await setJsonCache(CACHE_LABELS.vt, cacheKey, stats, ANALYSIS_TTLS.vt);
    }
    return { stats, fromCache: false, quotaExceeded: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.vt, err);
    const quotaExceeded =
      err instanceof QuotaExceededError ||
      ((err as { code?: string | number; statusCode?: string | number })
        ?.code ?? (err as { statusCode?: string | number })?.statusCode) ===
        429;
    if (!quotaExceeded) {
      logger.warn({ err, url: finalUrl }, "VirusTotal lookup failed");
    }
    return {
      stats: undefined,
      fromCache: false,
      quotaExceeded,
      error: err as Error,
    };
  }
}

interface UrlhausFetchResult {
  result: UrlhausResult | null;
  fromCache: boolean;
  error: Error | null;
}

async function fetchUrlhaus(
  finalUrl: string,
  hash: string,
): Promise<UrlhausFetchResult> {
  if (!config.urlhaus.enabled) {
    return { result: null, fromCache: true, error: null };
  }
  const cacheKey = `url:analysis:${hash}:urlhaus`;
  const cached = await getJsonCache<UrlhausResult>(
    CACHE_LABELS.urlhaus,
    cacheKey,
    ANALYSIS_TTLS.urlhaus,
  );
  if (cached) {
    return { result: cached, fromCache: true, error: null };
  }
  try {
    const result = await urlhausCircuit.execute(() =>
      withRetry(() => urlhausLookup(finalUrl), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      }),
    );
    recordLatency(CIRCUIT_LABELS.urlhaus, result.latencyMs);
    await setJsonCache(
      CACHE_LABELS.urlhaus,
      cacheKey,
      result,
      ANALYSIS_TTLS.urlhaus,
    );
    return { result, fromCache: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.urlhaus, err);
    logger.warn({ err, url: finalUrl }, "URLhaus lookup failed");
    return { result: null, fromCache: false, error: err as Error };
  }
}

interface ShortenerCacheEntry {
  finalUrl: string;
  provider: string;
  chain: string[];
  wasShortened: boolean;
}

async function resolveShortenerWithCache(
  url: string,
  hash: string,
): Promise<ShortenerCacheEntry | null> {
  const cacheKey = `${SHORTENER_CACHE_PREFIX}${hash}`;
  const cached = await getJsonCache<ShortenerCacheEntry>(
    CACHE_LABELS.shortener,
    cacheKey,
    config.shortener.cacheTtlSeconds,
  );
  if (cached) return cached;
  try {
    const start = Date.now();
    const resolved = await resolveShortener(url);
    recordLatency("shortener", Date.now() - start);
    if (resolved.wasShortened) {
      const payload: ShortenerCacheEntry = {
        finalUrl: resolved.finalUrl,
        provider: resolved.provider,
        chain: resolved.chain,
        wasShortened: true,
      };
      await setJsonCache(
        CACHE_LABELS.shortener,
        cacheKey,
        payload,
        config.shortener.cacheTtlSeconds,
      );
      return payload;
    }
    return null;
  } catch (err) {
    recordError("shortener", err);
    logger.warn({ err, url }, "Shortener resolution failed");
    return null;
  }
}

interface DomainIntelResult {
  ageDays?: number;
  source: "rdap" | "whoisxml" | "whodat" | "none";
  registrar?: string;
}

async function fetchDomainIntel(
  hostname: string,
  hash: string,
): Promise<DomainIntelResult> {
  if (config.rdap.enabled) {
    const rdapAge = await domainAgeDaysFromRdap(
      hostname,
      config.rdap.timeoutMs,
    ).catch(() => undefined);
    if (rdapAge !== undefined) {
      return { ageDays: rdapAge, source: "rdap" };
    }
  } else {
    logger.warn({ hostname }, "RDAP disabled by config");
  }

  // Try who-dat first if enabled (self-hosted, no quota limits)
  if (config.whodat?.enabled) {
    const cacheKey = `url:analysis:${hash}:whodat`;
    const cached = await getJsonCache<{ ageDays?: number; registrar?: string }>(
      CACHE_LABELS.whois,
      cacheKey,
      ANALYSIS_TTLS.whois,
    );
    if (cached) {
      return {
        ageDays: cached.ageDays,
        registrar: cached.registrar,
        source: "whodat",
      };
    }
    try {
      const start = Date.now();
      const response = await whodatCircuit.execute(() =>
        withRetry(() => whoDatLookup(hostname), {
          retries: 2,
          baseDelayMs: 1000,
          factor: 2,
          retryable: shouldRetry,
        }),
      );
      recordLatency(CIRCUIT_LABELS.whodat, Date.now() - start);
      const record = (
        response as {
          record?: { estimatedDomainAgeDays?: number; registrarName?: string };
        }
      )?.record;
      const ageDays = record?.estimatedDomainAgeDays;
      const registrar = record?.registrarName;
      await setJsonCache(
        CACHE_LABELS.whois,
        cacheKey,
        { ageDays, registrar },
        ANALYSIS_TTLS.whois,
      );
      return { ageDays, registrar, source: "whodat" };
    } catch (err) {
      recordError(CIRCUIT_LABELS.whodat, err);
      logger.warn(
        { err, hostname },
        "Who-dat lookup failed, falling back to WhoisXML if available",
      );
    }
  }

  // Fallback to WhoisXML if who-dat failed or is disabled
  if (!config.whoisxml?.enabled || !config.whoisxml.apiKey) {
    return { ageDays: undefined, source: "none" };
  }
  const cacheKey = `url:analysis:${hash}:whois`;
  const cached = await getJsonCache<{ ageDays?: number; registrar?: string }>(
    CACHE_LABELS.whois,
    cacheKey,
    ANALYSIS_TTLS.whois,
  );
  if (cached) {
    return {
      ageDays: cached.ageDays,
      registrar: cached.registrar,
      source: "whoisxml",
    };
  }
  try {
    const start = Date.now();
    const response = await whoisCircuit.execute(() =>
      withRetry(() => whoisXmlLookup(hostname), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      }),
    );
    recordLatency(CIRCUIT_LABELS.whoisxml, Date.now() - start);
    const record = (
      response as {
        record?: { estimatedDomainAgeDays?: number; registrarName?: string };
      }
    )?.record;
    const ageDays = record?.estimatedDomainAgeDays;
    const registrar = record?.registrarName;
    await setJsonCache(
      CACHE_LABELS.whois,
      cacheKey,
      { ageDays, registrar },
      ANALYSIS_TTLS.whois,
    );
    return { ageDays, registrar, source: "whoisxml" };
  } catch (err) {
    recordError(CIRCUIT_LABELS.whoisxml, err);
    if (err instanceof QuotaExceededError) {
      logger.warn(
        { hostname },
        "WhoisXML quota exhausted, disabling for remainder of month",
      );
      disableWhoisXmlForMonth();
    } else {
      logger.warn({ err, hostname }, "WhoisXML lookup failed");
    }
    return { ageDays: undefined, source: "none" };
  }
}

async function loadManualOverride(
  dbClient: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  },
  urlHash: string,
  hostname: string,
): Promise<"allow" | "deny" | null> {
  try {
    const { rows } = await dbClient.query(
      `SELECT status FROM overrides
         WHERE (url_hash = ? OR pattern = ?)
           AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY created_at DESC
         LIMIT 1`,
      [urlHash, hostname],
    );
    const record = rows[0] as { status?: string } | undefined;
    const status = record?.status;
    return status === "allow" || status === "deny" ? status : null;
  } catch (err) {
    logger.warn({ err, urlHash, hostname }, "Failed to load manual override");
    return null;
  }
}

// Helper functions to reduce cognitive complexity

interface CachedVerdict {
  verdict: string;
  score: number;
  reasons: string[];
  cacheTtl?: number;
  decidedAt?: number;
  [key: string]: unknown;
}

async function getCachedVerdict(
  cacheKey: string,
): Promise<CachedVerdict | null> {
  let cachedVerdict: CachedVerdict | null = null;
  let cachedTtl = -1;
  const cacheStop = metrics.cacheLookupDuration
    .labels(CACHE_LABELS.verdict)
    .startTimer();
  const cachedRaw = await redis.get(cacheKey);
  cacheStop();

  if (cachedRaw) {
    recordCacheOutcome(CACHE_LABELS.verdict, "hit");
    metrics.cacheHit.inc();
    metrics.cacheEntryBytes
      .labels(CACHE_LABELS.verdict)
      .set(Buffer.byteLength(cachedRaw));
    cachedTtl = await redis.ttl(cacheKey);
    if (cachedTtl >= 0) {
      metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(cachedTtl);
    }
    try {
      cachedVerdict = JSON.parse(cachedRaw) as CachedVerdict;
    } catch {
      metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
    }
    if (
      cachedVerdict &&
      typeof cachedVerdict.cacheTtl === "number" &&
      cachedTtl >= 0 &&
      cachedTtl < Math.max(1, Math.floor(cachedVerdict.cacheTtl * 0.2))
    ) {
      metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
    }
  } else {
    recordCacheOutcome(CACHE_LABELS.verdict, "miss");
    metrics.cacheMiss.inc();
    metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(0);
  }

  return cachedVerdict;
}

async function handleCachedVerdict(
  cachedVerdict: CachedVerdict,
  chatId: string | undefined,
  messageId: string | undefined,
  hasChatContext: boolean,
  ingestionTimestamp: number,
  queueName: string,
  started: number,
  attemptsMade: number,
  url: string,
  rescan: boolean | undefined,
  jobId: string | undefined,
): Promise<void> {
  const verdictLatencySeconds = Math.max(
    0,
    (Date.now() - ingestionTimestamp) / 1000,
  );
  metrics.verdictLatency.observe(verdictLatencySeconds);
  recordQueueMetrics(queueName, started, attemptsMade);

  if (hasChatContext) {
    const resolvedMessageId = messageId ?? "";
    await scanVerdictQueue.add(
      "verdict",
      {
        chatId,
        messageId: resolvedMessageId,
        ...cachedVerdict,
        decidedAt: cachedVerdict.decidedAt ?? Date.now(),
      },
      { removeOnComplete: true },
    );
  } else {
    logger.info(
      { url, jobId, rescan: Boolean(rescan) },
      "Skipping verdict dispatch without chat context",
    );
  }
}

function recordQueueMetrics(
  queueName: string,
  started: number,
  attemptsMade: number,
): void {
  metrics.queueProcessingDuration
    .labels(queueName)
    .observe((Date.now() - started) / 1000);
  metrics.queueCompleted.labels(queueName).inc();
  if (attemptsMade > 0) {
    metrics.queueRetries.labels(queueName).inc(attemptsMade);
  }
}

interface UrlAnalysisResult {
  finalUrl: string;
  finalUrlObj: URL;
  redirectChain: string[];
  heurSignals: Record<string, unknown>;
  wasShortened: boolean;
  finalUrlMismatch: boolean;
  shortenerInfo: {
    finalUrl: string;
    provider: string;
    chain: string[];
    wasShortened: boolean;
  } | null;
}

async function analyzeUrl(norm: string, h: string): Promise<UrlAnalysisResult> {
  const shortenerInfo = await resolveShortenerWithCache(norm, h);
  const preExpansionUrl = shortenerInfo?.finalUrl ?? norm;
  const exp = await expandUrl(preExpansionUrl, config.orchestrator.expansion);
  const finalUrl = exp.finalUrl;
  const finalUrlObj = new URL(finalUrl);
  const redirectChain = [
    ...(shortenerInfo?.chain ?? []),
    ...exp.chain.filter(
      (item: string) => !(shortenerInfo?.chain ?? []).includes(item),
    ),
  ];
  const heurSignals = extraHeuristics(finalUrlObj);
  const wasShortened = Boolean(shortenerInfo?.wasShortened);
  const finalUrlMismatch =
    wasShortened && new URL(norm).hostname !== finalUrlObj.hostname;

  return {
    finalUrl,
    finalUrlObj,
    redirectChain,
    heurSignals,
    wasShortened,
    finalUrlMismatch,
    shortenerInfo,
  };
}

async function handleHighConfidenceThreat(
  norm: string,
  finalUrl: string,
  h: string,
  redirectChain: string[],
  wasShortened: boolean,
  finalUrlMismatch: boolean,
  homoglyphResult: HomoglyphResult,
  heurSignals: Record<string, unknown>,
  enhancedSecurityResult: {
    verdict: string;
    confidence: string;
    score: number;
    reasons: string[];
    skipExternalAPIs: boolean;
  },
  cacheKey: string,
  chatId: string | undefined,
  messageId: string | undefined,
  hasChatContext: boolean,
  queueName: string,
  started: number,
  attemptsMade: number,
  ingestionTimestamp: number,
  dbClient: IDatabaseConnection,
  enhancedSecurity: EnhancedSecurityAnalyzer,
): Promise<void> {
  logger.info(
    {
      url: finalUrl,
      score: enhancedSecurityResult.score,
      reasons: enhancedSecurityResult.reasons,
    },
    "Tier 1 high-confidence threat detected, skipping external APIs",
  );

  // Create a proper HomoglyphResult object with all required properties
  const fullHomoglyphResult: HomoglyphResult = {
    detected: homoglyphResult.detected,
    riskLevel: homoglyphResult.riskLevel,
    confusableChars: homoglyphResult.confusableChars,
    isPunycode: false, // Default values
    mixedScript: false,
    unicodeHostname: finalUrl,
    normalizedDomain: finalUrl,
    riskReasons: [],
  };

  const signals = {
    gsbThreatTypes: [],
    phishtankVerified: false,
    urlhausListed: false,
    vtMalicious: undefined,
    vtSuspicious: undefined,
    vtHarmless: undefined,
    domainAgeDays: undefined,
    redirectCount: redirectChain.length,
    wasShortened,
    finalUrlMismatch,
    manualOverride: null,
    homoglyph: fullHomoglyphResult,
    ...heurSignals,
    enhancedSecurityScore: enhancedSecurityResult.score,
    enhancedSecurityReasons: enhancedSecurityResult.reasons,
  };

  const verdictResult = scoreFromSignals(signals);
  const verdict = "malicious";
  const { score, reasons } = verdictResult;
  const enhancedReasons = [...reasons, ...enhancedSecurityResult.reasons];

  const cacheTtl = config.orchestrator.cacheTtl.malicious;
  const verdictPayload = {
    url: norm,
    finalUrl,
    verdict,
    score,
    reasons: enhancedReasons,
    cacheTtl,
    redirectChain,
    wasShortened,
    finalUrlMismatch,
    homoglyph: fullHomoglyphResult,
    enhancedSecurity: {
      tier1Score: enhancedSecurityResult.score,
      confidence: enhancedSecurityResult.confidence,
    },
    decidedAt: Date.now(),
  };

  await setJsonCache(CACHE_LABELS.verdict, cacheKey, verdictPayload, cacheTtl);

  try {
    await dbClient.transaction(async () => {
      const standardSql = `
        INSERT INTO scans (url_hash, url, final_url, verdict, score, reasons, cache_ttl, redirect_chain, was_shortened, final_url_mismatch, homoglyph_detected, homoglyph_risk_level, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(url_hash) DO UPDATE SET
          url=excluded.url,
          final_url=excluded.final_url,
          verdict=excluded.verdict,
          score=excluded.score,
          reasons=excluded.reasons,
          cache_ttl=excluded.cache_ttl,
          redirect_chain=excluded.redirect_chain,
          was_shortened=excluded.was_shortened,
          final_url_mismatch=excluded.final_url_mismatch,
          homoglyph_detected=excluded.homoglyph_detected,
          homoglyph_risk_level=excluded.homoglyph_risk_level,
          last_seen_at=CURRENT_TIMESTAMP
      `;

      await dbClient.query(standardSql, [
        h,
        norm,
        finalUrl,
        verdict,
        score,
        JSON.stringify(enhancedReasons),
        cacheTtl,
        JSON.stringify(redirectChain),
        wasShortened,
        finalUrlMismatch,
        homoglyphResult.detected,
        homoglyphResult.riskLevel,
      ]);
    });
  } catch (err) {
    logger.error(
      { err, url: norm },
      "failed to persist enhanced security verdict",
    );
  }

  metrics.verdictScore.observe(score);
  for (const reason of enhancedReasons) {
    metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
  }

  const verdictLatencySeconds = Math.max(
    0,
    (Date.now() - ingestionTimestamp) / 1000,
  );
  metrics.verdictLatency.observe(verdictLatencySeconds);
  recordQueueMetrics(queueName, started, attemptsMade);

  if (hasChatContext) {
    await scanVerdictQueue.add(
      "verdict",
      {
        chatId,
        messageId,
        ...verdictPayload,
      },
      { removeOnComplete: true },
    );
  }

  await enhancedSecurity.recordVerdict(
    finalUrl,
    "malicious",
    enhancedSecurityResult.score / 3.0,
  );
}

interface ExternalCheckResults {
  blocklistResult: {
    gsbMatches: GsbThreatMatch[];
    gsbResult: { error: Error | null };
    phishtankResult: PhishtankLookupResult | null;
    phishtankNeeded: boolean;
    phishtankError: Error | null;
  };
  domainIntel: {
    ageDays?: number;
    source: "rdap" | "whoisxml" | "whodat" | "none";
    registrar?: string;
  };
  manualOverride: "allow" | "deny" | null;
  vtStats?: VtStats;
  vtQuotaExceeded: boolean;
  vtError: Error | null;
  urlhausResult: UrlhausResult | null;
  urlhausError: Error | null;
  urlhausConsulted: boolean;
}

async function performBlocklistChecks(
  finalUrl: string,
  finalUrlObj: URL,
  h: string,
  dbClient: IDatabaseConnection,
): Promise<Partial<ExternalCheckResults>> {
  const [blocklistResult, manualOverride] = await Promise.all([
    checkBlocklistsWithRedundancy({
      finalUrl,
      hash: h,
      fallbackLatencyMs: config.gsb.fallbackLatencyMs,
      gsbApiKeyPresent: Boolean(config.gsb.apiKey),
      phishtankEnabled: config.phishtank.enabled,
      fetchGsbAnalysis,
      fetchPhishtank,
    }),
    loadManualOverride(dbClient, h, finalUrlObj.hostname),
  ]);

  if (manualOverride) {
    metrics.manualOverrideApplied.labels(manualOverride).inc();
  }

  const gsbMatches = blocklistResult.gsbMatches;
  const gsbHit = gsbMatches.length > 0;
  if (gsbHit) metrics.gsbHits.inc();

  let urlhausResult: UrlhausResult | null = null;
  let urlhausError: Error | null = null;
  let urlhausConsulted = false;

  // Check URLhaus in fast path if GSB/Phishtank missed
  const shouldQueryUrlhaus =
    !gsbHit && !blocklistResult.phishtankResult?.verified;

  if (shouldQueryUrlhaus) {
    urlhausConsulted = true;
    const urlhausResponse = await fetchUrlhaus(finalUrl, h);
    urlhausResult = urlhausResponse.result;
    urlhausError = urlhausResponse.error;
  }

  return {
    blocklistResult,
    manualOverride,
    urlhausResult,
    urlhausError,
    urlhausConsulted,
  };
}

async function performDeepAnalysis(
  finalUrl: string,
  finalUrlObj: URL,
  h: string,
): Promise<Partial<ExternalCheckResults>> {
  const [domainIntel, vtResponse] = await Promise.all([
    fetchDomainIntel(finalUrlObj.hostname, h),
    fetchVirusTotal(finalUrl, h),
  ]);

  let vtStats: VtStats | undefined = vtResponse.stats;
  let vtQuotaExceeded = vtResponse.quotaExceeded;
  let vtError = vtResponse.error;

  if (!vtResponse.fromCache && !vtResponse.error) {
    metrics.vtSubmissions.inc();
  }

  return {
    domainIntel,
    vtStats,
    vtQuotaExceeded,
    vtError,
  };
}

interface VerdictResult {
  level: string;
  score: number;
  reasons: string[];
  cacheTtl: number;
  verdict: string;
  ttl: number;
  enqueuedUrlscan: boolean;
  degradedMode?: { providers: Array<{ name: string; reason: string }> };
  isCorrection?: boolean;
  suppressMessage?: boolean;
}

type ProviderState = {
  key: string;
  name: string;
  consulted: boolean;
  available: boolean;
  reason?: string;
};

function buildProviderStates(
  blocklistResult: ExternalCheckResults["blocklistResult"],
  vtStats: VtStats | undefined,
  vtQuotaExceeded: boolean,
  vtError: Error | null,
  urlhausResult: UrlhausResult | null,
  urlhausError: Error | null,
  urlhausConsulted: boolean,
): ProviderState[] {
  const summarizeReason = (input?: string | null) => {
    if (!input) return "unavailable";
    const trimmed = input.trim();
    if (trimmed.length === 0) return "unavailable";
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
  };

  const providerStates: ProviderState[] = [
    {
      key: "gsb",
      name: "Google Safe Browsing",
      consulted: true,
      available: !blocklistResult.gsbResult.error,
      reason: blocklistResult.gsbResult.error
        ? summarizeReason(blocklistResult.gsbResult.error.message)
        : undefined,
    },
  ];

  if (blocklistResult.phishtankNeeded) {
    providerStates.push({
      key: "phishtank",
      name: "Phishtank",
      consulted: true,
      available: !blocklistResult.phishtankError,
      reason: blocklistResult.phishtankError
        ? summarizeReason(blocklistResult.phishtankError.message)
        : undefined,
    });
  }

  const gsbHit = blocklistResult.gsbMatches.length > 0;
  const phishtankHit = Boolean(blocklistResult.phishtankResult?.verified);
  const vtConsulted = !gsbHit && !phishtankHit && Boolean(config.vt.apiKey);

  if (vtConsulted) {
    let vtReason: string | undefined;
    if (!vtStats) {
      vtReason = vtQuotaExceeded
        ? "quota_exhausted"
        : summarizeReason(vtError?.message ?? null);
    }
    providerStates.push({
      key: "virustotal",
      name: "VirusTotal",
      consulted: true,
      available: Boolean(vtStats) || (!vtError && !vtQuotaExceeded),
      reason: vtStats ? undefined : vtReason,
    });
  }

  if (urlhausConsulted) {
    providerStates.push({
      key: "urlhaus",
      name: "URLhaus",
      consulted: true,
      available: !urlhausError,
      reason: urlhausError ? summarizeReason(urlhausError.message) : undefined,
    });
  }

  return providerStates;
}

function recordVerdictMetrics(
  score: number,
  reasons: string[],
  baselineVerdict: string,
  verdict: string,
  gsbMatches: GsbThreatMatch[],
  phishtankHit: boolean,
  urlhausResult: UrlhausResult | null,
  vtStats: VtStats | undefined,
  wasShortened: boolean,
  finalUrlMismatch: boolean,
  redirectChain: string[],
  homoglyphResult: HomoglyphResult,
  domainAgeDays: number | undefined,
  manualOverride: string | null,
): void {
  metrics.verdictScore.observe(score);
  for (const reason of reasons) {
    metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
  }
  if (baselineVerdict !== verdict) {
    metrics.verdictEscalations.labels(baselineVerdict, verdict).inc();
  }
  if (gsbMatches.length > 0) {
    metrics.verdictSignals.labels("gsb_match").inc(gsbMatches.length);
  }
  if (phishtankHit) {
    metrics.verdictSignals.labels("phishtank_verified").inc();
  }
  if (urlhausResult?.listed) {
    metrics.verdictSignals.labels("urlhaus_listed").inc();
  }
  if ((vtStats?.malicious ?? 0) > 0) {
    metrics.verdictSignals.labels("vt_malicious").inc(vtStats?.malicious ?? 0);
  }
  if ((vtStats?.suspicious ?? 0) > 0) {
    metrics.verdictSignals
      .labels("vt_suspicious")
      .inc(vtStats?.suspicious ?? 0);
  }
  if (wasShortened) {
    metrics.verdictSignals.labels("shortener").inc();
  }
  if (finalUrlMismatch) {
    metrics.verdictSignals.labels("redirect_mismatch").inc();
  }
  if (redirectChain.length > 0) {
    metrics.verdictSignals.labels("redirect_chain").inc(redirectChain.length);
  }
  if (homoglyphResult.detected) {
    metrics.verdictSignals
      .labels(`homoglyph_${homoglyphResult.riskLevel}`)
      .inc();
  }
  if (typeof domainAgeDays === "number") {
    metrics.verdictSignals.labels("domain_age").inc();
  }
  if (manualOverride) {
    metrics.verdictSignals.labels(`override_${manualOverride}`).inc();
  }
}

async function generateVerdict(
  externalResults: ExternalCheckResults,
  finalUrl: string,
  h: string,
  redirectChain: string[],
  wasShortened: boolean,
  finalUrlMismatch: boolean,
  homoglyphResult: HomoglyphResult,
  heurSignals: Record<string, unknown>,
  enhancedSecurityResult: {
    verdict: string;
    confidence: string;
    score: number;
    reasons: string[];
    skipExternalAPIs: boolean;
  },
  shortenerInfo: {
    finalUrl: string;
    provider: string;
    chain: string[];
    wasShortened: boolean;
  } | null,
): Promise<VerdictResult> {
  const {
    blocklistResult,
    domainIntel,
    manualOverride,
    vtStats,
    vtQuotaExceeded,
    vtError,
    urlhausResult,
    urlhausError,
    urlhausConsulted,
  } = externalResults;

  const domainAgeDays = domainIntel.ageDays;
  const gsbMatches = blocklistResult.gsbMatches;
  const phishtankResult = blocklistResult.phishtankResult;
  const phishtankHit = Boolean(phishtankResult?.verified);

  const providerStates = buildProviderStates(
    blocklistResult,
    vtStats,
    vtQuotaExceeded,
    vtError,
    urlhausResult,
    urlhausError,
    urlhausConsulted,
  );

  const consultedProviders = providerStates.filter((state) => state.consulted);
  const availableProviders = consultedProviders.filter(
    (state) => state.available,
  );
  const degradedProviders = consultedProviders.filter(
    (state) => !state.available,
  );
  const degradedMode =
    consultedProviders.length > 0 && availableProviders.length === 0
      ? {
          providers: degradedProviders.map((state) => ({
            name: state.name,
            reason: state.reason ?? "unavailable",
          })),
        }
      : undefined;

  if (degradedMode) {
    metrics.degradedModeEvents.inc();
    metrics.externalScannersDegraded.set(1);
    logger.warn(
      { url: finalUrl, urlHash: h, providers: degradedMode.providers },
      "Operating in degraded mode with no external providers available",
    );
  } else {
    metrics.externalScannersDegraded.set(0);
  }

  const heuristicsOnly = degradedMode !== undefined;
  const signals = {
    gsbThreatTypes: gsbMatches.map((m: GsbThreatMatch) => m.threatType),
    phishtankVerified: Boolean(phishtankResult?.verified),
    urlhausListed: Boolean(urlhausResult?.listed),
    vtMalicious: vtStats?.malicious,
    vtSuspicious: vtStats?.suspicious,
    vtHarmless: vtStats?.harmless,
    domainAgeDays,
    redirectCount: redirectChain.length,
    wasShortened,
    finalUrlMismatch,
    manualOverride,
    homoglyph: homoglyphResult,
    ...heurSignals,
    enhancedSecurityScore: enhancedSecurityResult.score,
    enhancedSecurityReasons: enhancedSecurityResult.reasons,
    heuristicsOnly,
  };
  const verdictResult = scoreFromSignals(signals);
  const verdict = verdictResult.level;
  let { score, reasons } = verdictResult;

  if (enhancedSecurityResult.reasons.length > 0) {
    reasons = [...reasons, ...enhancedSecurityResult.reasons];
  }
  const baselineVerdict = scoreFromSignals({
    ...signals,
    manualOverride: null,
  }).level;

  recordVerdictMetrics(
    score,
    reasons,
    baselineVerdict,
    verdict,
    gsbMatches,
    phishtankHit,
    urlhausResult,
    vtStats,
    wasShortened,
    finalUrlMismatch,
    redirectChain,
    homoglyphResult,
    domainAgeDays,
    manualOverride,
  );

  const blocklistHit =
    gsbMatches.length > 0 || phishtankHit || Boolean(urlhausResult?.listed);

  let enqueuedUrlscan = false;
  if (
    config.urlscan.enabled &&
    config.urlscan.apiKey &&
    verdict === "suspicious"
  ) {
    const queued = await redis.set(
      `${URLSCAN_QUEUED_PREFIX}${h}`,
      "1",
      "EX",
      config.urlscan.uuidTtlSeconds,
      "NX",
    );
    if (queued) {
      enqueuedUrlscan = true;
      await urlscanQueue.add(
        "submit",
        {
          url: finalUrl,
          urlHash: h,
          rescan: true,
        },
        {
          removeOnComplete: true,
          removeOnFail: 500,
          attempts: 1,
        },
      );
    }
  }

  const ttlByLevel = config.orchestrator.cacheTtl as Record<string, number>;
  const ttl = ttlByLevel[verdict] ?? verdictResult.cacheTtl ?? 3600;

  metrics.verdictCacheTtl.observe(ttl);

  return {
    level: verdict,
    score,
    reasons,
    cacheTtl: verdictResult.cacheTtl,
    verdict,
    ttl,
    enqueuedUrlscan,
    degradedMode,
  };
}

async function storeAndDispatchResults(
  verdictResult: VerdictResult,
  chatId: string | undefined,
  messageId: string | undefined,
  hasChatContext: boolean,
  queueName: string,
  started: number,
  attemptsMade: number,
  ingestionTimestamp: number,
  finalUrl: string,
  enhancedSecurityResult: {
    verdict: string;
    confidence: string;
    score: number;
    reasons: string[];
    skipExternalAPIs: boolean;
  },
  dbClient: IDatabaseConnection,
  enhancedSecurity: EnhancedSecurityAnalyzer,
): Promise<void> {
  const {
    verdict,
    score,
    reasons,
    ttl,
    enqueuedUrlscan,
    degradedMode,
    isCorrection,
    suppressMessage,
  } = verdictResult;
  const h = urlHash(finalUrl);
  const cacheKey = `scan:${h}`;

  const res = {
    messageId,
    chatId,
    url: finalUrl,
    normalizedUrl: finalUrl,
    urlHash: h,
    verdict,
    score,
    reasons,
    gsb: { matches: [] }, // Will be filled in by the caller
    phishtank: null, // Will be filled in by the caller
    urlhaus: null, // Will be filled in by the caller
    vt: undefined, // Will be filled in by the caller
    urlscan: enqueuedUrlscan ? { status: "queued" } : undefined,
    whois: { source: "none" }, // Will be filled in by the caller
    domainAgeDays: undefined, // Will be filled in by the caller
    redirectChain: [], // Will be filled in by the caller
    ttlLevel: verdict,
    cacheTtl: ttl,
    shortener: undefined, // Will be filled in by the caller
    finalUrlMismatch: false, // Will be filled in by the caller
    decidedAt: Date.now(),
    degradedMode,
    isCorrection,
  };

  await setJsonCache(CACHE_LABELS.verdict, cacheKey, res, ttl);

  try {
    await dbClient.transaction(async () => {
      const scanSql = `
        INSERT INTO scans (
          url_hash, normalized_url, verdict, score, reasons, vt_stats,
          gsafebrowsing_hit, domain_age_days, redirect_chain_summary, cache_ttl,
          source_kind, urlscan_status, whois_source, whois_registrar, shortener_provider,
          first_seen_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(url_hash) DO UPDATE SET
          normalized_url=excluded.normalized_url,
          verdict=excluded.verdict,
          score=excluded.score,
          reasons=excluded.reasons,
          vt_stats=excluded.vt_stats,
          gsafebrowsing_hit=excluded.gsafebrowsing_hit,
          domain_age_days=excluded.domain_age_days,
          redirect_chain_summary=excluded.redirect_chain_summary,
          cache_ttl=excluded.cache_ttl,
          source_kind=excluded.source_kind,
          urlscan_status=excluded.urlscan_status,
          whois_source=excluded.whois_source,
          whois_registrar=excluded.whois_registrar,
          shortener_provider=excluded.shortener_provider,
          last_seen_at=CURRENT_TIMESTAMP
      `;

      await dbClient.query(scanSql, [
        h,
        finalUrl,
        verdict,
        score,
        JSON.stringify(reasons),
        JSON.stringify({}),
        false,
        null,
        JSON.stringify([]),
        ttl,
        "wa",
        enqueuedUrlscan ? "queued" : null,
        null,
        null,
        null,
      ]);

      if (enqueuedUrlscan) {
        await dbClient.query(
          "UPDATE scans SET urlscan_status=? WHERE url_hash=?",
          ["queued", h],
        );
      }

      if (chatId && messageId) {
        const messageSql = `
          INSERT INTO messages (chat_id, message_id, url_hash, verdict, posted_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(chat_id, message_id) DO NOTHING
        `;
        await dbClient.query(messageSql, [chatId, messageId, h, verdict]);
      }
    });
  } catch (err) {
    logger.warn(
      { err, chatId, messageId },
      "failed to persist message metadata for scan",
    );
  }

  if (chatId && messageId && !suppressMessage) {
    await scanVerdictQueue.add(
      "verdict",
      { ...res, chatId, messageId },
      { removeOnComplete: true },
    );
  } else {
    logger.info(
      { url: finalUrl, suppressMessage },
      "Completed scan without dispatching message (no context or suppressed)",
    );
  }

  await enhancedSecurity
    .recordVerdict(
      finalUrl,
      verdict === "malicious"
        ? "malicious"
        : verdict === "suspicious"
          ? "suspicious"
          : "benign",
      score / 15.0,
    )
    .catch((err: Error) => {
      logger.warn(
        { err, url: finalUrl },
        "failed to record verdict for collaborative learning",
      );
    });

  metrics.verdictCounter.labels(verdict).inc();
  const totalProcessingSeconds = (Date.now() - started) / 1000;
  metrics.verdictLatency.observe(
    Math.max(0, (Date.now() - ingestionTimestamp) / 1000),
  );
  metrics.scanLatency.observe(totalProcessingSeconds);
  recordQueueMetrics(queueName, started, attemptsMade);
}

interface UrlscanCallbackBody {
  uuid?: string;
  task?: {
    uuid?: string;
    url?: string;
    screenshotURL?: string;
    domURL?: string;
  };
  visual?: { data?: { screenshotURL?: string } };
  screenshotURL?: string;
  domURL?: string;
  [key: string]: unknown;
}

// Refactored urlscan callback handler (complexity 17 -> 15)
async function handleUrlscanCallback(
  req: FastifyRequest,
  reply: FastifyReply,
  dbClient: IDatabaseConnection,
): Promise<void> {
  if (!config.urlscan.enabled) {
    reply.code(503).send({ ok: false, error: "urlscan disabled" });
    return;
  }

  const secret = config.urlscan.callbackSecret;
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const rawHeaderToken =
    headers["x-urlscan-secret"] ?? headers["x-urlscan-token"];
  const headerToken = Array.isArray(rawHeaderToken)
    ? rawHeaderToken[0]
    : rawHeaderToken;
  const queryTokenRaw = (
    req.query as Record<string, string | string[] | undefined> | undefined
  )?.token;
  const queryToken = Array.isArray(queryTokenRaw)
    ? queryTokenRaw[0]
    : queryTokenRaw;

  if (!secret || (headerToken !== secret && queryToken !== secret)) {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return;
  }

  const body = req.body as UrlscanCallbackBody;
  const uuid = body?.uuid || body?.task?.uuid;
  if (!uuid) {
    reply.code(400).send({ ok: false, error: "missing uuid" });
    return;
  }

  // Validate and sanitize uuid to prevent path traversal
  if (typeof uuid !== "string" || !/^[a-fA-F0-9-]{36}$/.test(uuid)) {
    reply.code(400).send({ ok: false, error: "invalid uuid format" });
    return;
  }

  const urlscanBaseUrl = (
    config.urlscan.baseUrl || "https://urlscan.io"
  ).replace(/\/+$/, "");
  const artifactSources = [
    body?.screenshotURL,
    body?.task?.screenshotURL,
    body?.visual?.data?.screenshotURL,
    body?.domURL,
    body?.task?.domURL,
  ];

  for (const source of artifactSources) {
    const validation = normalizeUrlscanArtifactCandidate(
      source,
      urlscanBaseUrl,
    );
    if (validation.invalid) {
      logger.warn(
        { uuid, source },
        "urlscan callback rejected due to artifact host validation",
      );
      reply.code(400).send({ ok: false, error: "invalid artifact url" });
      return;
    }
  }

  let urlHashValue = await redis.get(`${URLSCAN_UUID_PREFIX}${uuid}`);
  if (!urlHashValue) {
    const taskUrl: string | undefined = body?.task?.url;
    if (taskUrl) {
      const normalized = normalizeUrl(taskUrl);
      if (normalized) {
        urlHashValue = urlHash(normalized);
      }
    }
  }
  if (!urlHashValue) {
    logger.warn({ uuid }, "urlscan callback without known url hash");
    reply.code(202).send({ ok: true });
    return;
  }

  await redis.set(
    `${URLSCAN_RESULT_PREFIX}${urlHashValue}`,
    JSON.stringify(body),
    "EX",
    config.urlscan.resultTtlSeconds,
  );

  let artifacts: {
    screenshotPath: string | null;
    domPath: string | null;
  } | null = null;
  try {
    // deepcode ignore PT: Path traversal mitigated in downloadUrlscanArtifacts via sanitizePathComponent() and path containment validation
    artifacts = await downloadUrlscanArtifacts(uuid, urlHashValue);
  } catch (err) {
    logger.warn({ err, uuid }, "failed to download urlscan artifacts");
  }

  await dbClient
    .query(
      `UPDATE scans
       SET urlscan_status=?,
           urlscan_completed_at=datetime('now'),
           urlscan_result=?,
           urlscan_screenshot_path=COALESCE(?, urlscan_screenshot_path),
           urlscan_dom_path=COALESCE(?, urlscan_dom_path),
           urlscan_artifact_stored_at=CASE
             WHEN ? IS NOT NULL OR ? IS NOT NULL THEN datetime('now')
             ELSE urlscan_artifact_stored_at
           END
     WHERE url_hash=?`,
      [
        "completed",
        JSON.stringify(body),
        artifacts?.screenshotPath ?? null,
        artifacts?.domPath ?? null,
        artifacts?.screenshotPath ?? null,
        artifacts?.domPath ?? null,
        urlHashValue,
      ],
    )
    .catch((err: Error) => {
      logger.error({ err }, "failed to persist urlscan callback");
    });

  reply.send({ ok: true });
}

async function main() {
  assertEssentialConfig("scan-orchestrator");

  redis = createRedisConnection();
  scanRequestQueue = createQueue(config.queues.scanRequest, {
    connection: redis,
  });
  scanVerdictQueue = createQueue(config.queues.scanVerdict, {
    connection: redis,
  });
  urlscanQueue = createQueue(config.queues.urlscan, { connection: redis });
  deepScanQueue = createQueue("deep-scan", { connection: redis });

  // Connect to Redis using the lazy connection pattern
  // This defers connection until main() is called, avoiding ETIMEDOUT at module load
  try {
    await connectRedis(redis, "scan-orchestrator");
  } catch (err) {
    logger.error({ err }, "Failed to connect to Redis. Exiting...");
    process.exit(1);
  }

  const dbClient = getSharedConnection();
  const enhancedSecurity = new EnhancedSecurityAnalyzer(redis);

  // Initialize GSB Local Database (assigns to module-level variable)
  gsbLocal = config.gsb.apiKey
    ? new GsbLocalDatabase(redis, config.gsb.apiKey)
    : null;

  // Schedule GSB database updates (every hour)
  if (gsbLocal) {
    // Initial update on startup
    gsbLocal!.updateDatabase().catch((err) => {
      logger.warn({ err }, "Failed initial GSB local database update");
    });

    // Update every hour - capture reference to avoid null check issues in closure
    const gsbInstance = gsbLocal;
    const gsbUpdateInterval = setInterval(() => {
      gsbInstance.updateDatabase().catch((err) => {
        logger.warn({ err }, "Failed scheduled GSB local database update");
      });
    }, 3600000); // 1 hour
    gsbUpdateInterval.unref();

    logger.info("GSB local database initialized with hourly updates");
  }
  await enhancedSecurity.start();

  const app = Fastify();
  app.get("/healthz", async (_req, reply) => {
    try {
      // Check Redis connectivity
      await redis.ping();
      return { ok: true, redis: "connected" };
    } catch (err) {
      logger.warn({ err }, "Health check failed - Redis connectivity issue");
      reply.code(503);
      return { ok: false, redis: "disconnected", error: "Redis unreachable" };
    }
  });
  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });

  app.post("/urlscan/callback", (req, reply) =>
    handleUrlscanCallback(req, reply, dbClient),
  );

  // Refactored scan request worker (complexity 89 -> 15)
  new Worker(
    config.queues.scanRequest,
    async (job) => {
      return handleScanRequestJob(job as ScanRequestJobLike, {
        queueName: config.queues.scanRequest,
        now: () => Date.now(),
        logger,
        metrics,
        scanRequestQueue,
        deepScanQueue,
        dbClient,
        enhancedSecurity,
        normalizeUrl,
        urlHash,
        getCachedVerdict,
        handleCachedVerdict,
        analyzeUrl,
        detectHomoglyphs,
        performBlocklistChecks,
        generateVerdict,
        storeAndDispatchResults,
        handleHighConfidenceThreat,
        recordQueueMetrics,
        refreshQueueMetrics,
      });
    },
    { connection: redis, concurrency: config.orchestrator.concurrency },
  );

  // Export for worker-invocation tests (DI style)
  (__testables as { handleScanRequestJob?: unknown }).handleScanRequestJob =
    handleScanRequestJob;

  // Deep Scan Worker
  new Worker(
    "deep-scan",
    async (job) => {
      const queueName = "deep-scan";
      const started = Date.now();

      // Validate  async (job) => {
      const validationResult = ScanRequestSchema.safeParse(job.data);
      if (!validationResult.success) {
        metrics.inputValidationFailures
          .labels("scan-orchestrator", "ScanRequest")
          .inc();
        logger.warn(
          {
            jobId: job.id,
            errors: validationResult.error.issues,
            data: job.data,
          },
          "ScanRequest validation failed in scanRequestQueue",
        );
        return;
      }
      const { chatId, messageId, url, timestamp, senderIdHash } =
        validationResult.data;
      const {
        fastVerdict,
        blocklistResults,
        urlAnalysis,
        homoglyphResult,
        enhancedSecurityResult,
      } = job.data;
      const {
        finalUrl,
        finalUrlObj,
        redirectChain,
        heurSignals,
        wasShortened,
        finalUrlMismatch,
        shortenerInfo,
      } = urlAnalysis;
      const h = urlHash(normalizeUrl(finalUrl) || finalUrl);
      const hasChatContext =
        typeof chatId === "string" && typeof messageId === "string";

      try {
        // Perform Deep Analysis (VT, Whois)
        const deepResults = await performDeepAnalysis(finalUrl, finalUrlObj, h);

        // Merge results
        const allResults: ExternalCheckResults = {
          ...blocklistResults,
          ...deepResults,
        } as ExternalCheckResults;

        // Generate Final Verdict
        const finalVerdictResult = await generateVerdict(
          allResults,
          finalUrl,
          h,
          redirectChain,
          wasShortened,
          finalUrlMismatch,
          homoglyphResult,
          heurSignals,
          enhancedSecurityResult,
          shortenerInfo,
        );

        // If verdict changed to Malicious (Correction needed)
        if (
          finalVerdictResult.verdict === "malicious" &&
          fastVerdict !== "malicious"
        ) {
          logger.info(
            { url: finalUrl, old: fastVerdict, new: "malicious" },
            "Verdict correction: Benign -> Malicious",
          );

          metrics.verdictCorrections.labels(fastVerdict, "malicious").inc();

          // Dispatch Correction
          await storeAndDispatchResults(
            { ...finalVerdictResult, isCorrection: true },
            chatId,
            messageId,
            hasChatContext,
            queueName,
            started,
            job.attemptsMade,
            Date.now(),
            finalUrl,
            enhancedSecurityResult,
            dbClient,
            enhancedSecurity,
          );
        } else {
          // Just update DB/Cache, don't spam user if verdict is same or still benign
          await storeAndDispatchResults(
            { ...finalVerdictResult, suppressMessage: true },
            chatId,
            messageId,
            hasChatContext,
            queueName,
            started,
            job.attemptsMade,
            Date.now(),
            finalUrl,
            enhancedSecurityResult,
            dbClient,
            enhancedSecurity,
          );
        }

        // Record Deep Scan Metrics
        metrics.deepScanLatency.observe((Date.now() - started) / 1000);
        metrics.scanPathCounter
          .labels("deep", finalVerdictResult.verdict)
          .inc();
      } catch (e) {
        logger.error(e, "deep scan worker error");
      }
    },
    { connection: redis, concurrency: config.orchestrator.concurrency },
  );

  if (config.urlscan.enabled && config.urlscan.apiKey) {
    new Worker(
      config.queues.urlscan,
      async (job) => {
        const queueName = config.queues.urlscan;
        const started = Date.now();
        const { url, urlHash: urlHashValue } = job.data as {
          url: string;
          urlHash: string;
        };
        try {
          const submission: UrlscanSubmissionResponse =
            await urlscanCircuit.execute(() =>
              withRetry(
                () =>
                  submitUrlscan(url, {
                    callbackUrl: config.urlscan.callbackUrl || undefined,
                    visibility: config.urlscan.visibility,
                    tags: config.urlscan.tags,
                  }),
                {
                  retries: 2,
                  baseDelayMs: 1000,
                  factor: 2,
                  retryable: shouldRetry,
                },
              ),
            );
          recordLatency(CIRCUIT_LABELS.urlscan, submission.latencyMs);
          if (submission.uuid) {
            await redis.set(
              `${URLSCAN_UUID_PREFIX}${submission.uuid}`,
              urlHashValue,
              "EX",
              config.urlscan.uuidTtlSeconds,
            );
            await redis.set(
              `${URLSCAN_SUBMITTED_PREFIX}${urlHashValue}`,
              submission.uuid,
              "EX",
              config.urlscan.uuidTtlSeconds,
            );
            await dbClient.query(
              `UPDATE scans SET urlscan_uuid=?, urlscan_status=?, urlscan_submitted_at=datetime('now'), urlscan_result_url=? WHERE url_hash=?`,
              [
                submission.uuid,
                "submitted",
                submission.result ?? null,
                urlHashValue,
              ],
            );
          }
          metrics.queueProcessingDuration
            .labels(queueName)
            .observe((Date.now() - started) / 1000);
          metrics.queueCompleted.labels(queueName).inc();
          if (job.attemptsMade > 0) {
            metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
          }
        } catch (err) {
          recordError(CIRCUIT_LABELS.urlscan, err);
          logger.error({ err, url }, "urlscan submission failed");
          await dbClient
            .query(
              `UPDATE scans SET urlscan_status=?, urlscan_completed_at=datetime('now') WHERE url_hash=?`,
              ["failed", urlHashValue],
            )
            .catch(() => undefined);
          metrics.queueFailures.labels(queueName).inc();
          metrics.queueProcessingDuration
            .labels(queueName)
            .observe((Date.now() - started) / 1000);
          throw err;
        } finally {
          await refreshQueueMetrics(urlscanQueue, queueName).catch(
            () => undefined,
          );
        }
      },
      { connection: redis, concurrency: config.urlscan.concurrency },
    );
  }

  await app.listen({ host: "0.0.0.0", port: 3001 });

  const shutdown = async () => {
    logger.info("Shutting down scan orchestrator...");
    await enhancedSecurity.stop();
    await app.close();
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

const isTestEnv =
  process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

const isExecutedDirectly =
  typeof require !== "undefined" && require.main === module;

if (!isTestEnv && isExecutedDirectly) {
  main().catch((err) => {
    logger.error(err, "Fatal in orchestrator");
    process.exit(1);
  });
}

type ScanRequestJobLike = {
  id?: string;
  data: unknown;
  timestamp?: number;
  attemptsMade: number;
};

type ScanRequestWorkerDeps = {
  queueName: string;
  now: () => number;
  logger: typeof logger;
  metrics: typeof metrics;
  scanRequestQueue: typeof scanRequestQueue;
  deepScanQueue: typeof deepScanQueue;

  // Injected dependencies for testability (and to avoid relying on `main()` scope).
  dbClient: IDatabaseConnection;
  enhancedSecurity: EnhancedSecurityAnalyzer;

  normalizeUrl: typeof normalizeUrl;
  urlHash: typeof urlHash;

  getCachedVerdict: typeof getCachedVerdict;
  handleCachedVerdict: typeof handleCachedVerdict;

  analyzeUrl: typeof analyzeUrl;
  detectHomoglyphs: typeof detectHomoglyphs;

  performBlocklistChecks: typeof performBlocklistChecks;
  generateVerdict: typeof generateVerdict;
  storeAndDispatchResults: typeof storeAndDispatchResults;
  handleHighConfidenceThreat: typeof handleHighConfidenceThreat;

  recordQueueMetrics: typeof recordQueueMetrics;
  refreshQueueMetrics: typeof refreshQueueMetrics;
};

export async function handleScanRequestJob(
  job: ScanRequestJobLike,
  deps: ScanRequestWorkerDeps,
): Promise<void> {
  const started = deps.now();
  const waitSeconds = Math.max(
    0,
    (started - (job.timestamp ?? started)) / 1000,
  );
  deps.metrics.queueJobWait.labels(deps.queueName).observe(waitSeconds);

  // Validate job data
  const validationResult = ScanRequestSchema.safeParse(job.data);
  if (!validationResult.success) {
    deps.logger.error(
      { err: validationResult.error, data: job.data },
      "Invalid scan request job data",
    );
    deps.recordQueueMetrics(deps.queueName, started, job.attemptsMade);
    return;
  }

  const { chatId, messageId, url, timestamp } = validationResult.data;
  const rescan = (job.data as { rescan?: boolean }).rescan;

  const ingestionTimestamp =
    typeof timestamp === "number" ? timestamp : (job.timestamp ?? started);
  const hasChatContext =
    typeof chatId === "string" && typeof messageId === "string";

  try {
    const norm = deps.normalizeUrl(url);
    if (!norm) {
      deps.recordQueueMetrics(deps.queueName, started, job.attemptsMade);
      return;
    }

    const h = deps.urlHash(norm);
    const cacheKey = `scan:${h}`;

    // Check for cached verdict
    const cachedVerdict = await deps.getCachedVerdict(cacheKey);
    if (cachedVerdict) {
      await deps.handleCachedVerdict(
        cachedVerdict,
        chatId,
        messageId,
        hasChatContext,
        ingestionTimestamp,
        deps.queueName,
        started,
        job.attemptsMade,
        norm,
        rescan,
        job.id,
      );
      return;
    }

    // Process URL and gather signals
    const urlAnalysis = await deps.analyzeUrl(norm, h);
    const {
      finalUrl,
      finalUrlObj,
      redirectChain,
      heurSignals,
      wasShortened,
      finalUrlMismatch,
      shortenerInfo,
    } = urlAnalysis;

    // Detect homoglyphs
    const homoglyphResult = deps.detectHomoglyphs(finalUrlObj.hostname);
    if (homoglyphResult.detected) {
      deps.metrics.homoglyphDetections.labels(homoglyphResult.riskLevel).inc();
      deps.logger.info(
        {
          hostname: finalUrlObj.hostname,
          risk: homoglyphResult.riskLevel,
          confusables: homoglyphResult.confusableChars,
        },
        "Homoglyph detection",
      );
    }

    // Enhanced security analysis
    const enhancedSecurityResult = await deps.enhancedSecurity.analyze(
      finalUrl,
      h,
    );

    // Handle high-confidence malicious URLs
    if (
      enhancedSecurityResult.verdict === "malicious" &&
      enhancedSecurityResult.confidence === "high" &&
      enhancedSecurityResult.skipExternalAPIs
    ) {
      await deps.handleHighConfidenceThreat(
        norm,
        finalUrl,
        h,
        redirectChain,
        wasShortened,
        finalUrlMismatch,
        homoglyphResult,
        heurSignals,
        {
          verdict: enhancedSecurityResult.verdict || "unknown",
          confidence: enhancedSecurityResult.confidence || "unknown",
          score: enhancedSecurityResult.score,
          reasons: enhancedSecurityResult.reasons,
          skipExternalAPIs: enhancedSecurityResult.skipExternalAPIs,
        },
        cacheKey,
        chatId,
        messageId,
        hasChatContext,
        deps.queueName,
        started,
        job.attemptsMade,
        ingestionTimestamp,
        deps.dbClient,
        deps.enhancedSecurity,
      );
      return;
    }

    // External API checks (Blocklists only for Fast Path)
    const blocklistResults = await deps.performBlocklistChecks(
      finalUrl,
      finalUrlObj,
      h,
      deps.dbClient,
    );

    // Generate Fast Verdict
    const fastVerdictResult = await deps.generateVerdict(
      {
        ...blocklistResults,
        domainIntel: { source: "none" },
      } as ExternalCheckResults,
      finalUrl,
      h,
      redirectChain,
      wasShortened,
      finalUrlMismatch,
      homoglyphResult,
      heurSignals,
      {
        verdict: enhancedSecurityResult.verdict || "unknown",
        confidence: enhancedSecurityResult.confidence || "unknown",
        score: enhancedSecurityResult.score,
        reasons: enhancedSecurityResult.reasons,
        skipExternalAPIs: enhancedSecurityResult.skipExternalAPIs,
      },
      shortenerInfo,
    );

    // Store and Dispatch Fast Verdict
    await deps.storeAndDispatchResults(
      fastVerdictResult,
      chatId,
      messageId,
      hasChatContext,
      deps.queueName,
      started,
      job.attemptsMade,
      ingestionTimestamp,
      finalUrl,
      {
        verdict: enhancedSecurityResult.verdict || "unknown",
        confidence: enhancedSecurityResult.confidence || "unknown",
        score: enhancedSecurityResult.score,
        reasons: enhancedSecurityResult.reasons,
        skipExternalAPIs: enhancedSecurityResult.skipExternalAPIs,
      },
      deps.dbClient,
      deps.enhancedSecurity,
    );

    // Record Fast Path Metrics
    deps.metrics.fastPathLatency.observe((deps.now() - started) / 1000);
    deps.metrics.scanPathCounter
      .labels("fast", fastVerdictResult.verdict)
      .inc();

    // If Fast Verdict is NOT Malicious, queue Deep Scan
    if (fastVerdictResult.verdict !== "malicious") {
      await deps.deepScanQueue.add(
        "deep-scan",
        {
          ...(job.data as Record<string, unknown>),
          fastVerdict: fastVerdictResult.verdict,
          blocklistResults,
          urlAnalysis: {
            finalUrl,
            finalUrlObj,
            redirectChain,
            heurSignals,
            wasShortened,
            finalUrlMismatch,
            shortenerInfo,
          },
          homoglyphResult,
          enhancedSecurityResult,
        },
        { removeOnComplete: true },
      );
    }
  } catch (e) {
    deps.metrics.queueFailures.labels(deps.queueName).inc();
    deps.metrics.queueProcessingDuration
      .labels(deps.queueName)
      .observe((deps.now() - started) / 1000);
    deps.logger.error(e, "scan worker error");
  } finally {
    await deps
      .refreshQueueMetrics(deps.scanRequestQueue, deps.queueName)
      .catch(() => undefined);
  }
}

export const __testables = {
  fetchGsbAnalysis,
  fetchPhishtank,
  fetchVirusTotal,
  fetchUrlhaus,
  shouldRetry,
  classifyError,
  checkBlocklistsWithRedundancy,
  shouldQueryPhishtank,
  extractUrlscanArtifactCandidates,
  normalizeUrlscanArtifactCandidate,

  // Pure DI export for direct invocation tests
  handleScanRequestJob,
};
