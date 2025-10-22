import Fastify from 'fastify';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { Client as PgClient } from 'pg';
import {
  config,
  logger,
  register,
  metrics,
  normalizeUrl,
  expandUrl,
  urlHash,
  gsbLookup,
  vtAnalyzeUrl,
  vtVerdictStats,
  domainAgeDaysFromRdap,
  extraHeuristics,
  scoreFromSignals,
  isShortener,
  urlhausLookup,
  phishtankLookup,
} from '@wbscanner/shared';
import type { GsbThreatMatch, UrlhausLookupResult, PhishtankLookupResult } from '@wbscanner/shared';

const redis = new Redis(config.redisUrl);
const scanRequestQueue = new Queue(config.queues.scanRequest, { connection: redis });
const scanVerdictQueue = new Queue(config.queues.scanVerdict, { connection: redis });

const ANALYSIS_TTLS = {
  gsb: 60 * 60,
  phishtank: 60 * 60,
  vt: 60 * 60,
  urlhaus: 60 * 60,
};

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

      const exp = await expandUrl(norm, config.orchestrator.expansion);
      const finalUrl = exp.finalUrl;
      const redirectChain = exp.chain;
      const finalUrlObj = new URL(finalUrl);
      const heur = extraHeuristics(finalUrlObj);
      const shortener = isShortener(finalUrlObj.hostname);
      const domainAgeDays = await domainAgeDaysFromRdap(finalUrlObj.hostname, config.rdap.timeoutMs).catch(() => undefined);

      // Google Safe Browsing lookup (primary blocklist)
      let gsbMatches: GsbMatch[] = [];
      let gsbHit = false;
      let gsbDuration = 0;
      const gsbCacheKey = `url:analysis:${h}:gsb`;
      const cachedGsb = await getJsonCache<GsbMatch[]>(gsbCacheKey);
      let gsbLookupError: Error | null = null;
      let gsbFromCache = false;
      if (cachedGsb) {
        gsbMatches = cachedGsb;
        gsbFromCache = true;
      } else {
        const gsbStart = Date.now();
        try {
          const gsbResult = await gsbLookup([finalUrl]);
          gsbDuration = Date.now() - gsbStart;
          gsbMatches = gsbResult.matches;
          await setJsonCache(gsbCacheKey, gsbMatches, ANALYSIS_TTLS.gsb);
        } catch (err) {
          gsbLookupError = err as Error;
          logger.warn({ err: gsbLookupError, url: finalUrl }, 'Google Safe Browsing lookup failed');
        }
      }
      gsbHit = gsbMatches.length > 0;
      if (gsbHit) metrics.gsbHits.inc();

      const shouldFallbackToPhishtank =
        !gsbFromCache &&
        (gsbLookupError !== null || !config.gsb.apiKey || gsbDuration > config.gsb.fallbackLatencyMs);
      let phishtankResult: PhishtankResult | null | undefined;
      if (shouldFallbackToPhishtank) {
        const phishCacheKey = `url:analysis:${h}:phishtank`;
        phishtankResult = await getJsonCache<PhishtankResult>(phishCacheKey);
        if (!phishtankResult) {
          try {
            phishtankResult = await phishtankLookup(finalUrl);
            await setJsonCache(phishCacheKey, phishtankResult, ANALYSIS_TTLS.phishtank);
          } catch (err) {
            logger.warn({ err, url: finalUrl }, 'Phishtank lookup failed');
          }
        }
      }
      const phishtankHit = Boolean(phishtankResult?.verified);

      let vtStats: VtStats | undefined;
      let vtError: Error | null = null;
      let vtQuotaExceeded = false;
      if (!gsbHit) {
        const vtCacheKey = `url:analysis:${h}:vt`;
        vtStats = (await getJsonCache<VtStats>(vtCacheKey)) ?? undefined;
        if (!vtStats) {
          metrics.vtSubmissions.inc();
          try {
            const vt = await vtAnalyzeUrl(finalUrl);
            vtStats = vtVerdictStats(vt);
            if (vtStats) {
              await setJsonCache(vtCacheKey, vtStats, ANALYSIS_TTLS.vt);
            }
          } catch (err) {
            vtError = err as Error;
            const code = (vtError as any)?.code;
            if (code === 429) {
              vtQuotaExceeded = true;
            } else {
              logger.warn({ err: vtError, url: finalUrl }, 'VirusTotal lookup failed');
            }
          }
        }
      }

      let urlhausResult: UrlhausResult | null | undefined;
      const shouldQueryUrlhaus =
        (!config.vt.apiKey && !gsbHit) ||
        vtQuotaExceeded ||
        (!gsbHit && !vtStats && vtError !== null);
      if (shouldQueryUrlhaus) {
        const urlhausCacheKey = `url:analysis:${h}:urlhaus`;
        urlhausResult = await getJsonCache<UrlhausResult>(urlhausCacheKey);
        if (!urlhausResult) {
          try {
            urlhausResult = await urlhausLookup(finalUrl);
            await setJsonCache(urlhausCacheKey, urlhausResult, ANALYSIS_TTLS.urlhaus);
          } catch (err) {
            logger.warn({ err, url: finalUrl }, 'URLhaus lookup failed');
          }
        }
      }

      const signals = {
        gsbHit,
        gsbMatches,
        phishtankHit,
        urlhausListed: Boolean(urlhausResult?.listed),
        vt: vtStats,
        domainAgeDays,
        excessiveRedirects: redirectChain.length > 3,
        shortener,
        ...heur
      };
      const { verdict, score, reasons } = scoreFromSignals(signals);

      const res = {
        messageId, chatId, url: finalUrl, normalizedUrl: finalUrl, urlHash: h,
        verdict, score, reasons,
        gsb: { matches: gsbMatches },
        phishtank: phishtankResult,
        urlhaus: urlhausResult,
        vt: vtStats,
        domainAgeDays,
        redirectChain
      };

      const ttl = verdict === 'benign' ? config.orchestrator.cacheTtl.positive : config.orchestrator.cacheTtl.negative;
      await redis.set(cacheKey, JSON.stringify(res), 'EX', ttl);

      await pg.query(`INSERT INTO scans (url_hash, normalized_url, verdict, score, reasons, vt_stats, gsafebrowsing_hit, domain_age_days, redirect_chain_summary, cache_ttl, source_kind)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (url_hash) DO UPDATE SET last_seen_at=now(), verdict=EXCLUDED.verdict, score=EXCLUDED.score, reasons=EXCLUDED.reasons, vt_stats=EXCLUDED.vt_stats, gsafebrowsing_hit=EXCLUDED.gsafebrowsing_hit, domain_age_days=EXCLUDED.domain_age_days, redirect_chain_summary=EXCLUDED.redirect_chain_summary, cache_ttl=EXCLUDED.cache_ttl`,
        [h, finalUrl, verdict, score, JSON.stringify(reasons), JSON.stringify(vtStats || {}), gsbHit || phishtankHit, domainAgeDays ?? null, JSON.stringify(redirectChain), ttl, 'wa']
      );
      await pg.query(`INSERT INTO messages (chat_id, message_id, url_hash, verdict, posted_at)
        VALUES ($1,$2,$3,$4,now()) ON CONFLICT DO NOTHING`, [chatId, messageId, h, verdict]);

      await scanVerdictQueue.add('verdict', res, { removeOnComplete: true });
      metrics.scanLatency.observe((Date.now() - start) / 1000);
    } catch (e) {
      logger.error(e, 'scan worker error');
    }
  }, { connection: redis, concurrency: config.orchestrator.concurrency });

  await app.listen({ host: '0.0.0.0', port: 3001 });
}

main().catch(err => { logger.error(err, 'Fatal in orchestrator'); process.exit(1); });
