import Bottleneck from 'bottleneck';
import { fetch } from 'undici';
import { config } from '../config';
import { logger } from '../log';
import {
  apiQuotaDepletedCounter,
  apiQuotaRemainingGauge,
  apiQuotaStatusGauge,
  metrics,
  rateLimiterDelay,
  rateLimiterQueueDepth,
} from '../metrics';
import { QuotaExceededError } from '../errors';
import { HttpError } from '../http-errors';

export interface VirusTotalAnalysis {
  data?: unknown;
  latencyMs?: number;
  disabled?: boolean;
}

const VT_LIMITER_RESERVOIR = Math.max(1, config.vt.requestsPerMinute);

const vtLimiter = new Bottleneck({
  reservoir: VT_LIMITER_RESERVOIR,
  reservoirRefreshAmount: VT_LIMITER_RESERVOIR,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1,
  minTime: 250,
});

let requestsRemaining = VT_LIMITER_RESERVOIR;
let lastReservoir = VT_LIMITER_RESERVOIR;
initializeQuotaMetrics(requestsRemaining);

vtLimiter.on('depleted', () => {
  recordReservoir(0);
});

const refreshInterval = setInterval(async () => {
  try {
    const current = await vtLimiter.currentReservoir();
    if (typeof current === 'number') {
      recordReservoir(current);
    }
    rateLimiterQueueDepth.labels('virustotal').set(getQueuedJobs());
  } catch (err) {
    logger.debug({ err }, 'Failed to poll VT limiter reservoir');
  }
}, 10_000);
refreshInterval.unref();

function getQueuedJobs(): number {
  // Bottleneck doesn't export the queued method type, so we need to access it dynamically
  const limiter = vtLimiter as unknown as { queued?: () => number };
  if (typeof limiter.queued === 'function') {
    try {
      const value = limiter.queued();
      return typeof value === 'number' ? value : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function initializeQuotaMetrics(initial: number) {
  apiQuotaRemainingGauge.labels('virustotal').set(initial);
  apiQuotaStatusGauge.labels('virustotal').set(1);
  metrics.apiQuotaUtilization.labels('virustotal').set(0);
  metrics.apiQuotaProjectedDepletion.labels('virustotal').set((initial * 60) / VT_LIMITER_RESERVOIR);
}

function recordReservoir(reservoir: number) {
  requestsRemaining = reservoir;
  apiQuotaRemainingGauge.labels('virustotal').set(Math.max(reservoir, 0));
  apiQuotaStatusGauge.labels('virustotal').set(reservoir > 0 ? 1 : 0);
  if (reservoir > lastReservoir) {
    metrics.apiQuotaResets.labels('virustotal').inc();
  }
  lastReservoir = reservoir;
  const utilization = reservoir <= 0 ? 1 : Math.min(1, Math.max(0, 1 - reservoir / VT_LIMITER_RESERVOIR));
  metrics.apiQuotaUtilization.labels('virustotal').set(utilization);
  const projection = reservoir <= 0 ? 0 : (reservoir * 60) / VT_LIMITER_RESERVOIR;
  metrics.apiQuotaProjectedDepletion.labels('virustotal').set(projection);
}

async function scheduleVtCall<T>(cb: () => Promise<T>): Promise<T> {
  const queuedAt = Date.now();
  return vtLimiter.schedule(async () => {
    const waitSeconds = (Date.now() - queuedAt) / 1000;
    if (waitSeconds > 0) {
      rateLimiterDelay.labels('virustotal').observe(waitSeconds);
    }
    metrics.apiQuotaConsumption.labels('virustotal').inc();
    rateLimiterQueueDepth.labels('virustotal').set(getQueuedJobs());

    const jitterMs = config.vt.requestJitterMs;
    if (jitterMs > 0) {
      const jitterDelay = Math.floor(Math.random() * (jitterMs + 1));
      if (jitterDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, jitterDelay));
      }
    }

    try {
      return await cb();
    } finally {
      const reservoir = await vtLimiter.currentReservoir();
      if (typeof reservoir === 'number') {
        recordReservoir(reservoir);
      }
      rateLimiterQueueDepth.labels('virustotal').set(getQueuedJobs());
    }
  });
}

function handleVirusTotalQuotaExceeded(stage: 'submission' | 'polling'): never {
  recordReservoir(0);
  apiQuotaDepletedCounter.labels('virustotal').inc();
  logger.warn({ stage }, 'VirusTotal quota exhausted');
  throw new QuotaExceededError('virustotal', 'VirusTotal quota exhausted');
}

export async function vtAnalyzeUrl(url: string): Promise<VirusTotalAnalysis> {
  if (!config.vt.apiKey) return { disabled: true };
  const submitResponse = await scheduleVtCall(() =>
    fetch('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: {
        'x-apikey': config.vt.apiKey,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ url }).toString(),
    })
  );

  if (submitResponse.status === 429) {
    handleVirusTotalQuotaExceeded('submission');
  }

  if (submitResponse.status >= 400) {
    const err = new Error(`VirusTotal submission failed: ${submitResponse.status}`) as HttpError;
    err.statusCode = submitResponse.status;
    throw err;
  }

  const body = await submitResponse.json() as { data?: { id?: string } };
  const analysisId = body.data?.id;
  const started = Date.now();
  let analysis: unknown;
  while (Date.now() - started < 50000) {
    const res = await scheduleVtCall(() =>
      fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: { 'x-apikey': config.vt.apiKey },
      })
    );

    if (res.status === 429) {
      handleVirusTotalQuotaExceeded('polling');
    }
    if (res.status >= 500) {
      const err = new Error(`VirusTotal analysis failed: ${res.status}`) as HttpError;
      err.statusCode = res.status;
      throw err;
    }
    analysis = await res.json();
    const analysisData = analysis as { data?: { attributes?: { status?: string } } };
    const status = analysisData.data?.attributes?.status;
    if (status !== 'queued') break;
    await new Promise(r => setTimeout(r, 2000));
  }
  return { data: analysis, latencyMs: Date.now() - started };
}

export function vtVerdictStats(analysis: VirusTotalAnalysis): { malicious: number; suspicious: number; harmless: number } | undefined {
  if (analysis?.disabled) return undefined;

  // Type guard for analysis data structure
  const data = analysis?.data as { data?: { attributes?: { stats?: unknown } }; attributes?: { stats?: unknown } } | undefined;
  const st = data?.data?.attributes?.stats ?? data?.attributes?.stats;

  if (!st || typeof st !== 'object') return undefined;

  const stats = st as { malicious?: number; suspicious?: number; harmless?: number };
  return {
    malicious: stats.malicious || 0,
    suspicious: stats.suspicious || 0,
    harmless: stats.harmless || 0
  };
}
