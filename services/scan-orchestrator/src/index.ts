import Fastify from 'fastify';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { Client as PgClient } from 'pg';
import {
  config,
  logger,
  register,
  metrics,
  externalLatency,
  externalErrors,
  circuitStates,
  rateLimiterDelay,
  circuitBreakerTransitionCounter,
  queueDepthGauge,
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
  CircuitBreaker,
  CircuitState,
  withRetry,
  QuotaExceededError,
  detectHomoglyphs,
} from '@wbscanner/shared';
import {
  checkBlocklistsWithRedundancy,
  shouldQueryPhishtank,
  type GsbFetchResult,
  type PhishtankFetchResult,
} from './blocklists';
import type { GsbThreatMatch, UrlhausLookupResult, PhishtankLookupResult, VirusTotalAnalysis, UrlscanSubmissionResponse, WhoisXmlResponse } from '@wbscanner/shared';
import { downloadUrlscanArtifacts } from './urlscan-artifacts';

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} as const;

const redis = new Redis(config.redisUrl, redisOptions);
const scanRequestQueue = new Queue(config.queues.scanRequest, { connection: new Redis(config.redisUrl, redisOptions) });
const scanVerdictQueue = new Queue(config.queues.scanVerdict, { connection: new Redis(config.redisUrl, redisOptions) });
const urlscanQueue = new Queue(config.queues.urlscan, { connection: new Redis(config.redisUrl, redisOptions) });

const ANALYSIS_TTLS = {
  gsb: 60 * 60,
  phishtank: 60 * 60,
  vt: 60 * 60,
  urlhaus: 60 * 60,
  urlscan: 60 * 60,
  whois: 7 * 24 * 60 * 60,
};

const URLSCAN_UUID_PREFIX = 'urlscan:uuid:';
const URLSCAN_QUEUED_PREFIX = 'urlscan:queued:';
const URLSCAN_SUBMITTED_PREFIX = 'urlscan:submitted:';
const URLSCAN_RESULT_PREFIX = 'urlscan:result:';
const SHORTENER_CACHE_PREFIX = 'url:shortener:';

const CIRCUIT_DEFAULTS = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 30_000,
  windowMs: 60_000,
} as const;

const CIRCUIT_LABELS = {
  gsb: 'google_safe_browsing',
  phishtank: 'phishtank',
  urlhaus: 'urlhaus',
  vt: 'virustotal',
  urlscan: 'urlscan',
  whoisxml: 'whoisxml',
} as const;

function makeCircuit(name: string) {
  const breaker = new CircuitBreaker({
    ...CIRCUIT_DEFAULTS,
    name,
    onStateChange: (state, from) => {
      circuitStates.labels(name).set(state);
      circuitBreakerTransitionCounter.labels(name, String(from ?? ''), String(state)).inc();
      logger.debug({ name, from, to: state }, 'Circuit state change');
    }
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

function recordLatency(service: string, ms?: number) {
  if (typeof ms === 'number' && ms >= 0) {
    externalLatency.labels(service).observe(ms / 1000);
  }
}

function classifyError(err: unknown): string {
  const rawCode = (err as any)?.code ?? (err as any)?.statusCode;
  if (rawCode === 'UND_ERR_HEADERS_TIMEOUT' || rawCode === 'UND_ERR_CONNECT_TIMEOUT') return 'timeout';
  const codeNum = typeof rawCode === 'string' ? Number(rawCode) : rawCode;
  if (codeNum === 429) return 'rate_limited';
  if (codeNum === 408) return 'timeout';
  if (typeof codeNum === 'number' && codeNum >= 500) return 'server_error';
  if (typeof codeNum === 'number' && codeNum >= 400) return 'client_error';
  const message = (err as Error)?.message || '';
  if (message.includes('Circuit') && message.includes('open')) return 'circuit_open';
  return 'unknown';
}

function recordError(service: string, err: unknown) {
  externalErrors.labels(service, classifyError(err)).inc();
}

function shouldRetry(err: unknown): boolean {
  const rawCode = (err as any)?.code ?? (err as any)?.statusCode;
  if (rawCode === 'UND_ERR_HEADERS_TIMEOUT' || rawCode === 'UND_ERR_CONNECT_TIMEOUT') return true;
  const codeNum = typeof rawCode === 'string' ? Number(rawCode) : rawCode;
  if (codeNum === 429) return false;
  if (codeNum === 408) return true;
  if (typeof codeNum === 'number' && codeNum >= 500) return true;
  return !codeNum;
}

async function getJsonCache<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJsonCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

type GsbMatch = GsbThreatMatch;
type VtStats = ReturnType<typeof vtVerdictStats>;
type UrlhausResult = UrlhausLookupResult;
type PhishtankResult = PhishtankLookupResult;

type ArtifactCandidate = {
  type: 'screenshot' | 'dom';
  url: string;
};

function normalizeUrlscanArtifactCandidate(candidate: unknown, baseUrl: string): { url?: string; invalid: boolean } {
  if (typeof candidate !== 'string') return { invalid: false };
  const trimmed = candidate.trim();
  if (!trimmed) return { invalid: false };

  const sanitizedBase = baseUrl.replace(/\/+$/, '');
  let trustedHostname: string;
  try {
    trustedHostname = new URL(sanitizedBase).hostname.toLowerCase();
  } catch {
    return { invalid: true };
  }

  const rawUrl = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${sanitizedBase}/${trimmed.replace(/^\/+/, '')}`;

  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return { invalid: true };
  }

  const parsed = new URL(normalized);
  const candidateHostname = parsed.hostname.toLowerCase();
  const hostAllowed =
    candidateHostname === trustedHostname || candidateHostname.endsWith(`.${trustedHostname}`);

  if (!hostAllowed) {
    return { invalid: true };
  }

  return { url: parsed.toString(), invalid: false };
}

function normaliseArtifactUrl(candidate: unknown, baseUrl: string): string | undefined {
  const result = normalizeUrlscanArtifactCandidate(candidate, baseUrl);
  return result.url;
}

function extractUrlscanArtifactCandidates(uuid: string, payload: any): ArtifactCandidate[] {
  const baseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
  const candidates: ArtifactCandidate[] = [];
  const seen = new Set<string>();

  const screenshotSources = [
    payload?.screenshotURL,
    payload?.task?.screenshotURL,
    payload?.visual?.data?.screenshotURL,
    `${baseUrl}/screenshots/${uuid}.png`,
  ];

  for (const source of screenshotSources) {
    const resolved = normaliseArtifactUrl(source, baseUrl);
    if (resolved && !seen.has(`screenshot:${resolved}`)) {
      seen.add(`screenshot:${resolved}`);
      candidates.push({ type: 'screenshot', url: resolved });
    }
  }

  const domSources = [
    payload?.domURL,
    payload?.task?.domURL,
    `${baseUrl}/dom/${uuid}.json`,
  ];

  for (const source of domSources) {
    const resolved = normaliseArtifactUrl(source, baseUrl);
    if (resolved && !seen.has(`dom:${resolved}`)) {
      seen.add(`dom:${resolved}`);
      candidates.push({ type: 'dom', url: resolved });
    }
  }

  return candidates;
}

async function fetchGsbAnalysis(finalUrl: string, hash: string): Promise<GsbFetchResult> {
  const cacheKey = `url:analysis:${hash}:gsb`;
  const cached = await getJsonCache<GsbMatch[]>(cacheKey);
  if (cached) {
    return { matches: cached, fromCache: true, durationMs: 0, error: null };
  }
  try {
    const result = await gsbCircuit.execute(() =>
      withRetry(() => gsbLookup([finalUrl]), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.gsb, result.latencyMs);
    await setJsonCache(cacheKey, result.matches, ANALYSIS_TTLS.gsb);
    return {
      matches: result.matches,
      fromCache: false,
      durationMs: result.latencyMs ?? 0,
      error: null,
    };
  } catch (err) {
    recordError(CIRCUIT_LABELS.gsb, err);
    logger.warn({ err, url: finalUrl }, 'Google Safe Browsing lookup failed');
    return { matches: [], fromCache: false, durationMs: 0, error: err as Error };
  }
}

async function fetchPhishtank(finalUrl: string, hash: string): Promise<PhishtankFetchResult> {
  if (!config.phishtank.enabled) {
    return { result: null, fromCache: true, error: null };
  }
  const cacheKey = `url:analysis:${hash}:phishtank`;
  const cached = await getJsonCache<PhishtankResult>(cacheKey);
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
      })
    );
    recordLatency(CIRCUIT_LABELS.phishtank, result.latencyMs);
    await setJsonCache(cacheKey, result, ANALYSIS_TTLS.phishtank);
    return { result, fromCache: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.phishtank, err);
    logger.warn({ err, url: finalUrl }, 'Phishtank lookup failed');
    return { result: null, fromCache: false, error: err as Error };
  }
}

interface VirusTotalFetchResult {
  stats?: VtStats;
  fromCache: boolean;
  quotaExceeded: boolean;
  error: Error | null;
}

async function fetchVirusTotal(finalUrl: string, hash: string): Promise<VirusTotalFetchResult> {
  if (!config.vt.apiKey) {
    return { stats: undefined, fromCache: true, quotaExceeded: false, error: null };
  }
  const cacheKey = `url:analysis:${hash}:vt`;
  const cached = await getJsonCache<VtStats>(cacheKey);
  if (cached) {
    return { stats: cached, fromCache: true, quotaExceeded: false, error: null };
  }
  try {
    const analysis = await vtCircuit.execute(() =>
      withRetry(() => vtAnalyzeUrl(finalUrl), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.vt, analysis.latencyMs);
    const stats = vtVerdictStats(analysis as VirusTotalAnalysis);
    if (stats) {
      await setJsonCache(cacheKey, stats, ANALYSIS_TTLS.vt);
    }
    return { stats, fromCache: false, quotaExceeded: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.vt, err);
    const quotaExceeded = err instanceof QuotaExceededError || ((err as any)?.code ?? (err as any)?.statusCode) === 429;
    if (!quotaExceeded) {
      logger.warn({ err, url: finalUrl }, 'VirusTotal lookup failed');
    }
    return { stats: undefined, fromCache: false, quotaExceeded, error: err as Error };
  }
}

interface UrlhausFetchResult {
  result: UrlhausResult | null;
  fromCache: boolean;
  error: Error | null;
}

async function fetchUrlhaus(finalUrl: string, hash: string): Promise<UrlhausFetchResult> {
  if (!config.urlhaus.enabled) {
    return { result: null, fromCache: true, error: null };
  }
  const cacheKey = `url:analysis:${hash}:urlhaus`;
  const cached = await getJsonCache<UrlhausResult>(cacheKey);
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
      })
    );
    recordLatency(CIRCUIT_LABELS.urlhaus, result.latencyMs);
    await setJsonCache(cacheKey, result, ANALYSIS_TTLS.urlhaus);
    return { result, fromCache: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.urlhaus, err);
    logger.warn({ err, url: finalUrl }, 'URLhaus lookup failed');
    return { result: null, fromCache: false, error: err as Error };
  }
}

interface ShortenerCacheEntry {
  finalUrl: string;
  provider: string;
  chain: string[];
  wasShortened: boolean;
}

async function resolveShortenerWithCache(url: string, hash: string): Promise<ShortenerCacheEntry | null> {
  const cacheKey = `${SHORTENER_CACHE_PREFIX}${hash}`;
  const cached = await getJsonCache<ShortenerCacheEntry>(cacheKey);
  if (cached) return cached;
  try {
    const start = Date.now();
    const resolved = await resolveShortener(url);
    recordLatency('shortener', Date.now() - start);
    if (resolved.wasShortened) {
      const payload: ShortenerCacheEntry = {
        finalUrl: resolved.finalUrl,
        provider: resolved.provider,
        chain: resolved.chain,
        wasShortened: true,
      };
      await setJsonCache(cacheKey, payload, config.shortener.cacheTtlSeconds);
      return payload;
    }
    return null;
  } catch (err) {
    recordError('shortener', err);
    logger.warn({ err, url }, 'Shortener resolution failed');
    return null;
  }
}

interface DomainIntelResult {
  ageDays?: number;
  source: 'rdap' | 'whoisxml' | 'none';
  registrar?: string;
}

async function fetchDomainIntel(hostname: string, hash: string): Promise<DomainIntelResult> {
  const rdapAge = await domainAgeDaysFromRdap(hostname, config.rdap.timeoutMs).catch(() => undefined);
  if (rdapAge !== undefined) {
    return { ageDays: rdapAge, source: 'rdap' };
  }
  if (!config.whoisxml.enabled || !config.whoisxml.apiKey) {
    return { ageDays: undefined, source: 'none' };
  }
  const cacheKey = `url:analysis:${hash}:whois`;
  const cached = await getJsonCache<{ ageDays?: number; registrar?: string }>(cacheKey);
  if (cached) {
    return { ageDays: cached.ageDays, registrar: cached.registrar, source: 'whoisxml' };
  }
  try {
    const start = Date.now();
    const response = await whoisCircuit.execute(() =>
      withRetry(() => whoisXmlLookup(hostname), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.whoisxml, Date.now() - start);
    const ageDays = response?.record?.estimatedDomainAgeDays;
    const registrar = response?.record?.registrarName;
    await setJsonCache(cacheKey, { ageDays, registrar }, ANALYSIS_TTLS.whois);
    return { ageDays, registrar, source: 'whoisxml' };
  } catch (err) {
    recordError(CIRCUIT_LABELS.whoisxml, err);
    if (err instanceof QuotaExceededError) {
      logger.warn({ hostname }, 'WhoisXML quota exhausted, disabling for remainder of month');
      disableWhoisXmlForMonth();
    } else {
      logger.warn({ err, hostname }, 'WhoisXML lookup failed');
    }
    return { ageDays: undefined, source: 'none' };
  }
}

const pg = new PgClient({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.db,
  user: config.postgres.user,
  password: config.postgres.password
});

async function main() {
  await pg.connect();
  const app = Fastify();
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  app.post('/urlscan/callback', async (req, reply) => {
    if (!config.urlscan.enabled) {
      reply.code(503).send({ ok: false, error: 'urlscan disabled' });
      return;
    }
    const secret = config.urlscan.callbackSecret;
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const rawHeaderToken = headers['x-urlscan-secret'] ?? headers['x-urlscan-token'];
    const headerToken = Array.isArray(rawHeaderToken) ? rawHeaderToken[0] : rawHeaderToken;
    const queryTokenRaw = (req.query as Record<string, string | string[] | undefined> | undefined)?.token;
    const queryToken = Array.isArray(queryTokenRaw) ? queryTokenRaw[0] : queryTokenRaw;

    if (!secret || (headerToken !== secret && queryToken !== secret)) {
      reply.code(401).send({ ok: false, error: 'unauthorized' });
      return;
    }
    const body = req.body as any;
    const uuid = body?.uuid || body?.task?.uuid;
    if (!uuid) {
      reply.code(400).send({ ok: false, error: 'missing uuid' });
      return;
    }
    const urlscanBaseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
    const artifactSources = [
      body?.screenshotURL,
      body?.task?.screenshotURL,
      body?.visual?.data?.screenshotURL,
      body?.domURL,
      body?.task?.domURL,
    ];

    for (const source of artifactSources) {
      const validation = normalizeUrlscanArtifactCandidate(source, urlscanBaseUrl);
      if (validation.invalid) {
        logger.warn({ uuid, source }, 'urlscan callback rejected due to artifact host validation');
        reply.code(400).send({ ok: false, error: 'invalid artifact url' });
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
      logger.warn({ uuid }, 'urlscan callback without known url hash');
      reply.code(202).send({ ok: true });
      return;
    }

    await redis.set(
      `${URLSCAN_RESULT_PREFIX}${urlHashValue}`,
      JSON.stringify(body),
      'EX',
      config.urlscan.resultTtlSeconds
    );

    let artifacts: { screenshotPath: string | null; domPath: string | null } | null = null;
    try {
      artifacts = await downloadUrlscanArtifacts(uuid, urlHashValue);
    } catch (err) {
      logger.warn({ err, uuid }, 'failed to download urlscan artifacts');
    }

    await pg.query(
      `UPDATE scans
         SET urlscan_status=$1,
             urlscan_completed_at=now(),
             urlscan_result=$2,
             urlscan_screenshot_path=COALESCE($4, urlscan_screenshot_path),
             urlscan_dom_path=COALESCE($5, urlscan_dom_path),
             urlscan_artifact_stored_at=CASE
               WHEN $4 IS NOT NULL OR $5 IS NOT NULL THEN now()
               ELSE urlscan_artifact_stored_at
             END
       WHERE url_hash=$3`,
      ['completed', JSON.stringify(body), urlHashValue, artifacts?.screenshotPath ?? null, artifacts?.domPath ?? null]
    ).catch((err: Error) => {
      logger.error({ err }, 'failed to persist urlscan callback');
    });

    reply.send({ ok: true });
  });

  new Worker(config.queues.scanRequest, async (job) => {
    const start = Date.now();
    const { chatId, messageId, url } = job.data as { chatId: string; messageId: string; url: string };
    try {
      const norm = normalizeUrl(url);
      if (!norm) return;
      const h = urlHash(norm);
      const cacheKey = `scan:${h}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        metrics.cacheHit.inc();
        const data = JSON.parse(cached);
        await scanVerdictQueue.add('verdict', { chatId, messageId, ...data }, { removeOnComplete: true });
        return;
      }
      metrics.cacheMiss.inc();

      const shortenerInfo = await resolveShortenerWithCache(norm, h);
      const preExpansionUrl = shortenerInfo?.finalUrl ?? norm;
      const exp = await expandUrl(preExpansionUrl, config.orchestrator.expansion);
      const finalUrl = exp.finalUrl;
      const finalUrlObj = new URL(finalUrl);
      const redirectChain = [...(shortenerInfo?.chain ?? []), ...exp.chain.filter(item => !(shortenerInfo?.chain ?? []).includes(item))];
      const heurSignals = extraHeuristics(finalUrlObj);
      const domainIntel = await fetchDomainIntel(finalUrlObj.hostname, h);
      const domainAgeDays = domainIntel.ageDays;
      const wasShortened = Boolean(shortenerInfo?.wasShortened);
      const finalUrlMismatch = wasShortened && new URL(norm).hostname !== finalUrlObj.hostname;

      const homoglyphResult = detectHomoglyphs(finalUrlObj.hostname);
      if (homoglyphResult.detected) {
        metrics.homoglyphDetections.labels(homoglyphResult.riskLevel).inc();
        logger.info({ hostname: finalUrlObj.hostname, risk: homoglyphResult.riskLevel, confusables: homoglyphResult.confusableChars }, 'Homoglyph detection');
      }

      let manualOverride: 'allow' | 'deny' | null = null;
      try {
        const overrideResult = await pg.query(
          `SELECT status FROM overrides
             WHERE (url_hash = $1 OR pattern = $2)
               AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY created_at DESC
             LIMIT 1`,
          [h, finalUrlObj.hostname]
        );
        if (overrideResult.rows[0]?.status) {
          manualOverride = overrideResult.rows[0].status as 'allow' | 'deny';
          metrics.manualOverrideApplied.labels(manualOverride).inc();
        }
      } catch (err) {
        logger.warn({ err, url: finalUrl }, 'Failed to load manual override');
      }

      const blocklistResult = await checkBlocklistsWithRedundancy({
        finalUrl,
        hash: h,
        fallbackLatencyMs: config.gsb.fallbackLatencyMs,
        gsbApiKeyPresent: Boolean(config.gsb.apiKey),
        phishtankEnabled: config.phishtank.enabled,
        fetchGsbAnalysis,
        fetchPhishtank,
      });
      const gsbMatches = blocklistResult.gsbMatches;
      const gsbHit = gsbMatches.length > 0;
      if (gsbHit) metrics.gsbHits.inc();

      const phishtankResult = blocklistResult.phishtankResult;
      const phishtankHit = Boolean(phishtankResult?.verified);

      let vtStats: VtStats | undefined;
      let vtQuotaExceeded = false;
      let vtError: Error | null = null;
      if (!gsbHit && !phishtankHit) {
        const vtResponse = await fetchVirusTotal(finalUrl, h);
        vtStats = vtResponse.stats;
        vtQuotaExceeded = vtResponse.quotaExceeded;
        vtError = vtResponse.error;
        if (!vtResponse.fromCache && !vtResponse.error) {
          metrics.vtSubmissions.inc();
        }
      }

      let urlhausResult: UrlhausResult | null = null;
      const shouldQueryUrlhaus =
        !gsbHit && (
          !config.vt.apiKey ||
          vtQuotaExceeded ||
          vtError !== null ||
          !vtStats
        );
      if (shouldQueryUrlhaus) {
        const urlhausResponse = await fetchUrlhaus(finalUrl, h);
        urlhausResult = urlhausResponse.result;
      }

      const signals = {
        gsbThreatTypes: gsbMatches.map(m => m.threatType),
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
      };
      const verdictResult = scoreFromSignals(signals);
      const verdict = verdictResult.level;
      const { score, reasons } = verdictResult;

      const blocklistHit = gsbHit || phishtankHit || Boolean(urlhausResult?.listed);

      let enqueuedUrlscan = false;
      if (config.urlscan.enabled && config.urlscan.apiKey && verdict === 'suspicious') {
        const queued = await redis.set(
          `${URLSCAN_QUEUED_PREFIX}${h}`,
          '1',
          'EX',
          config.urlscan.uuidTtlSeconds,
          'NX'
        );
        if (queued) {
          enqueuedUrlscan = true;
          await urlscanQueue.add(
            'submit',
            {
              url: finalUrl,
              urlHash: h,
            },
            {
              removeOnComplete: true,
              removeOnFail: 500,
              attempts: 1,
            }
          );
        }
      }

      const ttlByLevel = config.orchestrator.cacheTtl as Record<string, number>;
      const ttl = ttlByLevel[verdict] ?? verdictResult.cacheTtl ?? 3600;

      const res = {
        messageId,
        chatId,
        url: finalUrl,
        normalizedUrl: finalUrl,
        urlHash: h,
        verdict,
        score,
        reasons,
        gsb: { matches: gsbMatches },
        phishtank: phishtankResult,
        urlhaus: urlhausResult,
        vt: vtStats,
        urlscan: enqueuedUrlscan ? { status: 'queued' } : undefined,
        whois: domainIntel,
        domainAgeDays,
        redirectChain,
        ttlLevel: verdict,
        cacheTtl: ttl,
        shortener: shortenerInfo ? { provider: shortenerInfo.provider, chain: shortenerInfo.chain } : undefined,
        finalUrlMismatch,
      };
      await redis.set(cacheKey, JSON.stringify(res), 'EX', ttl);

      await pg.query(`INSERT INTO scans (url_hash, normalized_url, verdict, score, reasons, vt_stats, gsafebrowsing_hit, domain_age_days, redirect_chain_summary, cache_ttl, source_kind, urlscan_status, whois_source, whois_registrar, shortener_provider)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (url_hash) DO UPDATE SET last_seen_at=now(), verdict=EXCLUDED.verdict, score=EXCLUDED.score, reasons=EXCLUDED.reasons, vt_stats=EXCLUDED.vt_stats, gsafebrowsing_hit=EXCLUDED.gsafebrowsing_hit, domain_age_days=EXCLUDED.domain_age_days, redirect_chain_summary=EXCLUDED.redirect_chain_summary, cache_ttl=EXCLUDED.cache_ttl, urlscan_status=COALESCE(EXCLUDED.urlscan_status, scans.urlscan_status), whois_source=COALESCE(EXCLUDED.whois_source, scans.whois_source), whois_registrar=COALESCE(EXCLUDED.whois_registrar, scans.whois_registrar), shortener_provider=COALESCE(EXCLUDED.shortener_provider, scans.shortener_provider)`,
        [h, finalUrl, verdict, score, JSON.stringify(reasons), JSON.stringify(vtStats || {}), blocklistHit, domainAgeDays ?? null, JSON.stringify(redirectChain), ttl, 'wa', enqueuedUrlscan ? 'queued' : null, domainIntel.source === 'none' ? null : domainIntel.source, domainIntel.registrar ?? null, shortenerInfo?.provider ?? null]
      );
      if (enqueuedUrlscan) {
        await pg.query('UPDATE scans SET urlscan_status=$1 WHERE url_hash=$2', ['queued', h]).catch(() => undefined);
      }
      await pg.query(`INSERT INTO messages (chat_id, message_id, url_hash, verdict, posted_at)
        VALUES ($1,$2,$3,$4,now()) ON CONFLICT DO NOTHING`, [chatId, messageId, h, verdict]);

      await scanVerdictQueue.add('verdict', res, { removeOnComplete: true });
      metrics.verdictCounter.labels(verdict).inc();
      metrics.scanLatency.observe((Date.now() - start) / 1000);
    } catch (e) {
      logger.error(e, 'scan worker error');
    } finally {
      queueDepthGauge.labels(config.queues.scanRequest).set(await scanRequestQueue.getWaitingCount());
    }
  }, { connection: redis, concurrency: config.orchestrator.concurrency });

  if (config.urlscan.enabled && config.urlscan.apiKey) {
    new Worker(config.queues.urlscan, async (job) => {
      const { url, urlHash: urlHashValue } = job.data as { url: string; urlHash: string };
      try {
        const submission: UrlscanSubmissionResponse = await urlscanCircuit.execute(() =>
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
            }
          )
        );
        recordLatency(CIRCUIT_LABELS.urlscan, submission.latencyMs);
        if (submission.uuid) {
          await redis.set(
            `${URLSCAN_UUID_PREFIX}${submission.uuid}`,
            urlHashValue,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await redis.set(
            `${URLSCAN_SUBMITTED_PREFIX}${urlHashValue}`,
            submission.uuid,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await pg.query(
            `UPDATE scans SET urlscan_uuid=$1, urlscan_status=$2, urlscan_submitted_at=now(), urlscan_result_url=$3 WHERE url_hash=$4`,
            [submission.uuid, 'submitted', submission.result ?? null, urlHashValue]
          );
        }
      } catch (err) {
        recordError(CIRCUIT_LABELS.urlscan, err);
        logger.error({ err, url }, 'urlscan submission failed');
        await pg.query(
          `UPDATE scans SET urlscan_status=$1, urlscan_completed_at=now() WHERE url_hash=$2`,
          ['failed', urlHashValue]
        ).catch(() => undefined);
        throw err;
      } finally {
        queueDepthGauge.labels(config.queues.urlscan).set(await urlscanQueue.getWaitingCount());
      }
    }, { connection: redis, concurrency: config.urlscan.concurrency });
  }

  await app.listen({ host: '0.0.0.0', port: 3001 });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => { logger.error(err, 'Fatal in orchestrator'); process.exit(1); });
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
};
