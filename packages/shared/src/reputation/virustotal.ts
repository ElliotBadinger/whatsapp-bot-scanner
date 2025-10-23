import Bottleneck from 'bottleneck';
import { fetch } from 'undici';
import { config } from '../config';
import { logger } from '../log';
import {
  apiQuotaDepletedCounter,
  apiQuotaRemainingGauge,
  apiQuotaStatusGauge,
  rateLimiterDelay,
} from '../metrics';
import { QuotaExceededError } from '../errors';

export interface VirusTotalAnalysis {
  data?: any;
  latencyMs?: number;
  disabled?: boolean;
}

const VT_REQUESTS_PER_MINUTE = Math.max(1, config.vt.requestsPerMinute);
const VT_WINDOW_MS = 60_000;
const vtLimiter = new Bottleneck({ maxConcurrent: 1 });

const recentRequestTimestamps: number[] = [];

function pruneExpiredRequests(now: number): void {
  while (recentRequestTimestamps.length > 0 && now - recentRequestTimestamps[0] >= VT_WINDOW_MS) {
    recentRequestTimestamps.shift();
  }
}

function updateQuotaMetrics(now: number): void {
  pruneExpiredRequests(now);
  const remaining = Math.max(0, VT_REQUESTS_PER_MINUTE - recentRequestTimestamps.length);
  apiQuotaRemainingGauge.labels('virustotal').set(remaining);
  apiQuotaStatusGauge.labels('virustotal').set(remaining > 0 ? 1 : 0);
}

updateQuotaMetrics(Date.now());

async function scheduleVtCall<T>(cb: () => Promise<T>): Promise<T> {
  return vtLimiter.schedule(async () => {
    let totalDelayMs = 0;
    // Wait until we have budget available for the current window.
    while (true) {
      const now = Date.now();
      pruneExpiredRequests(now);
      const remaining = VT_REQUESTS_PER_MINUTE - recentRequestTimestamps.length;
      apiQuotaRemainingGauge.labels('virustotal').set(Math.max(remaining, 0));
      apiQuotaStatusGauge.labels('virustotal').set(remaining > 0 ? 1 : 0);
      if (remaining > 0) {
        break;
      }

      const waitMs = Math.max(0, VT_WINDOW_MS - (now - recentRequestTimestamps[0]));
      if (waitMs === 0) {
        // If the oldest request expires exactly now, loop once more to recalc remaining tokens.
        continue;
      }
      totalDelayMs += waitMs;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    if (totalDelayMs > 0) {
      rateLimiterDelay.labels('virustotal').observe(totalDelayMs / 1000);
    }

    const jitterMs = config.vt.requestJitterMs;
    if (jitterMs > 0) {
      const jitterDelay = Math.floor(Math.random() * (jitterMs + 1));
      if (jitterDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, jitterDelay));
      }
    }

    try {
      const startedAt = Date.now();
      recentRequestTimestamps.push(startedAt);
      const remaining = Math.max(0, VT_REQUESTS_PER_MINUTE - recentRequestTimestamps.length);
      apiQuotaRemainingGauge.labels('virustotal').set(remaining);
      apiQuotaStatusGauge.labels('virustotal').set(remaining > 0 ? 1 : 0);
      return await cb();
    } finally {
      updateQuotaMetrics(Date.now());
    }
  });
}

function handleVirusTotalQuotaExceeded(stage: 'submission' | 'polling'): never {
  apiQuotaStatusGauge.labels('virustotal').set(0);
  apiQuotaRemainingGauge.labels('virustotal').set(0);
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
    const err = new Error(`VirusTotal submission failed: ${submitResponse.status}`);
    (err as any).statusCode = submitResponse.status;
    throw err;
  }

  const body: any = await submitResponse.json();
  const analysisId = body.data?.id;
  const started = Date.now();
  let analysis: any;
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
      const err = new Error(`VirusTotal analysis failed: ${res.status}`);
      (err as any).statusCode = res.status;
      throw err;
    }
    analysis = await res.json();
    const status = analysis.data?.attributes?.status;
    if (status !== 'queued') break;
    await new Promise(r => setTimeout(r, 2000));
  }
  return { data: analysis, latencyMs: Date.now() - started };
}

export function vtVerdictStats(analysis: VirusTotalAnalysis | any): { malicious: number; suspicious: number; harmless: number } | undefined {
  if (analysis?.disabled) return undefined;
  const st = analysis?.data?.data?.attributes?.stats ?? analysis?.data?.attributes?.stats;
  if (!st) return undefined;
  return {
    malicious: st.malicious || 0,
    suspicious: st.suspicious || 0,
    harmless: st.harmless || 0
  };
}
