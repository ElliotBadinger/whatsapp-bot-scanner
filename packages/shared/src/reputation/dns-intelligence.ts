import { promises as dns } from 'dns';
import { logger } from '../log';
import { metrics } from '../metrics';
import { Counter, Histogram } from 'prom-client';

const dnsblQueriesTotal = new Counter({
  name: 'dnsbl_queries_total',
  help: 'Total number of DNSBL queries performed',
  labelNames: ['provider', 'result'],
  registers: [metrics],
});

const dnsblHitsTotal = new Counter({
  name: 'dnsbl_hits_total',
  help: 'Total number of DNSBL hits (domain/IP found in blacklist)',
  labelNames: ['provider'],
  registers: [metrics],
});

const dnsblLatencySeconds = new Histogram({
  name: 'dnsbl_latency_seconds',
  help: 'DNSBL query latency in seconds',
  labelNames: ['provider'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metrics],
});

const dnssecValidationTotal = new Counter({
  name: 'dnssec_validation_total',
  help: 'Total number of DNSSEC validations performed',
  labelNames: ['result'],
  registers: [metrics],
});

const fastFluxDetectionTotal = new Counter({
  name: 'fast_flux_detection_total',
  help: 'Total number of fast-flux detections',
  labelNames: ['detected'],
  registers: [metrics],
});

interface DNSBLProvider {
  zone: string;
  name: string;
  weight: number;
}

const DNSBL_PROVIDERS: DNSBLProvider[] = [
  { zone: 'zen.spamhaus.org', name: 'Spamhaus ZEN', weight: 0.9 },
  { zone: 'multi.surbl.org', name: 'SURBL', weight: 0.85 },
  { zone: 'multi.uribl.com', name: 'URIBL', weight: 0.8 },
  { zone: 'dbl.spamhaus.org', name: 'Spamhaus DBL', weight: 0.9 },
];

interface DNSBLResult {
  listed: boolean;
  provider: string;
  weight: number;
}

interface DNSSECResult {
  validated: boolean;
  authenticated: boolean;
  hasRecords: boolean;
  error?: string;
}

interface FluxAnalysis {
  isFlux: boolean;
  ipCount: number;
  ttl: number;
  roundTripTime: number;
}

interface DNSIntelligenceResult {
  score: number;
  reasons: string[];
  dnsblResults: DNSBLResult[];
  dnssecResult?: DNSSECResult;
  fluxAnalysis?: FluxAnalysis;
}

const dnsCache = new Map<string, { result: any; expiry: number }>();

function getCached<T>(key: string): T | null {
  const cached = dnsCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.result as T;
  }
  if (cached) {
    dnsCache.delete(key);
  }
  return null;
}

function setCache<T>(key: string, result: T, ttlMs: number): void {
  dnsCache.set(key, {
    result,
    expiry: Date.now() + ttlMs,
  });
}

function reverseIp(ip: string): string {
  return ip.split('.').reverse().join('.');
}

function isIpAddress(hostname: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return ipv4Regex.test(hostname);
}

async function queryDNSBL(
  hostname: string,
  provider: DNSBLProvider,
  timeoutMs: number
): Promise<DNSBLResult> {
  const startTime = Date.now();
  const isIp = isIpAddress(hostname);
  const query = isIp
    ? `${reverseIp(hostname)}.${provider.zone}`
    : `${hostname}.${provider.zone}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      await dns.resolve4(query, { signal: controller.signal as any });
      clearTimeout(timeout);

      const latency = (Date.now() - startTime) / 1000;
      dnsblLatencySeconds.labels(provider.name).observe(latency);
      dnsblQueriesTotal.labels(provider.name, 'hit').inc();
      dnsblHitsTotal.labels(provider.name).inc();

      logger.info({ provider: provider.name, hostname, query }, 'DNSBL hit detected');

      return {
        listed: true,
        provider: provider.name,
        weight: provider.weight,
      };
    } catch (err: any) {
      clearTimeout(timeout);

      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
        const latency = (Date.now() - startTime) / 1000;
        dnsblLatencySeconds.labels(provider.name).observe(latency);
        dnsblQueriesTotal.labels(provider.name, 'miss').inc();

        return {
          listed: false,
          provider: provider.name,
          weight: 0,
        };
      }

      if (err.name === 'AbortError') {
        dnsblQueriesTotal.labels(provider.name, 'timeout').inc();
        logger.warn({ provider: provider.name, hostname, timeoutMs }, 'DNSBL query timeout');
      } else {
        dnsblQueriesTotal.labels(provider.name, 'error').inc();
        logger.warn({ provider: provider.name, hostname, error: err.message }, 'DNSBL query error');
      }

      return {
        listed: false,
        provider: provider.name,
        weight: 0,
      };
    }
  } catch (err: any) {
    dnsblQueriesTotal.labels(provider.name, 'error').inc();
    logger.error({ provider: provider.name, hostname, error: err.message }, 'DNSBL query failed');

    return {
      listed: false,
      provider: provider.name,
      weight: 0,
    };
  }
}

async function checkDNSBLs(hostname: string, timeoutMs: number = 2000): Promise<DNSBLResult[]> {
  const cacheKey = `dnsbl:${hostname}`;
  const cached = getCached<DNSBLResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const results = await Promise.all(
    DNSBL_PROVIDERS.map((provider) => queryDNSBL(hostname, provider, timeoutMs))
  );

  const anyListed = results.some((r) => r.listed);
  const cacheTtl = anyListed ? 30 * 60 * 1000 : 6 * 60 * 60 * 1000;
  setCache(cacheKey, results, cacheTtl);

  return results;
}

async function validateDNSSEC(hostname: string): Promise<DNSSECResult> {
  const cacheKey = `dnssec:${hostname}`;
  const cached = getCached<DNSSECResult>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const resolver = new dns.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);

    const records = await resolver.resolve(hostname, 'A');

    const result: DNSSECResult = {
      validated: true,
      authenticated: false,
      hasRecords: records.length > 0,
    };

    dnssecValidationTotal.labels('success').inc();
    setCache(cacheKey, result, 12 * 60 * 60 * 1000);

    return result;
  } catch (err: any) {
    const result: DNSSECResult = {
      validated: false,
      authenticated: false,
      hasRecords: false,
      error: err.message,
    };

    dnssecValidationTotal.labels('error').inc();
    setCache(cacheKey, result, 12 * 60 * 60 * 1000);

    return result;
  }
}

async function detectFastFlux(hostname: string): Promise<FluxAnalysis> {
  const cacheKey = `flux:${hostname}`;
  const cached = getCached<FluxAnalysis>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const startTime = Date.now();
    const addresses = await dns.resolve4(hostname, { ttl: true });
    const roundTripTime = Date.now() - startTime;

    const ipCount = addresses.length;
    const ttl = addresses.length > 0 ? (addresses[0] as any).ttl || 300 : 300;

    const isFlux = ipCount >= 5 && ttl < 300;

    if (isFlux) {
      fastFluxDetectionTotal.labels('true').inc();
      logger.warn({ hostname, ipCount, ttl, roundTripTime }, 'Fast-flux network detected');
    } else {
      fastFluxDetectionTotal.labels('false').inc();
    }

    const result: FluxAnalysis = {
      isFlux,
      ipCount,
      ttl,
      roundTripTime,
    };

    setCache(cacheKey, result, 60 * 60 * 1000);

    return result;
  } catch (err: any) {
    fastFluxDetectionTotal.labels('error').inc();
    logger.warn({ hostname, error: err.message }, 'Fast-flux detection failed');

    const result: FluxAnalysis = {
      isFlux: false,
      ipCount: 0,
      ttl: 0,
      roundTripTime: 0,
    };

    setCache(cacheKey, result, 60 * 60 * 1000);

    return result;
  }
}

export async function dnsIntelligence(
  hostname: string,
  config: {
    dnsblEnabled?: boolean;
    dnsblTimeoutMs?: number;
    dnssecEnabled?: boolean;
    fastFluxEnabled?: boolean;
  } = {}
): Promise<DNSIntelligenceResult> {
  const {
    dnsblEnabled = true,
    dnsblTimeoutMs = 2000,
    dnssecEnabled = true,
    fastFluxEnabled = true,
  } = config;

  const reasons: string[] = [];
  let score = 0;

  const [dnsblResults, dnssecResult, fluxAnalysis] = await Promise.allSettled([
    dnsblEnabled ? checkDNSBLs(hostname, dnsblTimeoutMs) : Promise.resolve([]),
    dnssecEnabled ? validateDNSSEC(hostname) : Promise.resolve(undefined),
    fastFluxEnabled ? detectFastFlux(hostname) : Promise.resolve(undefined),
  ]);

  const dnsblData =
    dnsblResults.status === 'fulfilled' ? dnsblResults.value : [];
  const dnssecData =
    dnssecResult.status === 'fulfilled' ? dnssecResult.value : undefined;
  const fluxData =
    fluxAnalysis.status === 'fulfilled' ? fluxAnalysis.value : undefined;

  for (const result of dnsblData) {
    if (result.listed) {
      score += result.weight;
      reasons.push(`Listed in ${result.provider}`);
    }
  }

  if (dnssecData && !dnssecData.validated) {
    score += 0.3;
    reasons.push('DNSSEC validation failed or missing');
  }

  if (fluxData && fluxData.isFlux) {
    score += 0.5;
    reasons.push(`Fast-flux network detected (${fluxData.ipCount} IPs, TTL ${fluxData.ttl}s)`);
  }

  return {
    score,
    reasons,
    dnsblResults: dnsblData,
    dnssecResult: dnssecData,
    fluxAnalysis: fluxData,
  };
}

export type { DNSIntelligenceResult, DNSBLResult, DNSSECResult, FluxAnalysis };
