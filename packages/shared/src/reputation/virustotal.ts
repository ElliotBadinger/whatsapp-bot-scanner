import Bottleneck from 'bottleneck';
import { fetch } from 'undici';
import { config } from '../config';
import { logger } from '../log';
import { apiQuotaRemainingGauge, apiQuotaStatusGauge, rateLimiterDelay } from '../metrics';
import { QuotaExceededError } from '../errors';

export interface VirusTotalAnalysis {
  data?: any;
  latencyMs?: number;
  disabled?: boolean;
}

const VT_LIMITER_RESERVOIR = 4;

const vtLimiter = new Bottleneck({
  reservoir: VT_LIMITER_RESERVOIR,
  reservoirRefreshAmount: VT_LIMITER_RESERVOIR,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1,
  minTime: 250,
});

let requestsRemaining = VT_LIMITER_RESERVOIR;
apiQuotaRemainingGauge.labels('virustotal').set(requestsRemaining);
apiQuotaStatusGauge.labels('virustotal').set(1);

vtLimiter.on('depleted', () => {
  requestsRemaining = 0;
  apiQuotaRemainingGauge.labels('virustotal').set(0);
  apiQuotaStatusGauge.labels('virustotal').set(0);
});

const refreshInterval = setInterval(async () => {
  try {
    const current = await vtLimiter.currentReservoir();
    if (typeof current === 'number') {
      requestsRemaining = current;
      apiQuotaRemainingGauge.labels('virustotal').set(current);
      apiQuotaStatusGauge.labels('virustotal').set(current > 0 ? 1 : 0);
    }
  } catch (err) {
    logger.debug({ err }, 'Failed to poll VT limiter reservoir');
  }
}, 10_000);
refreshInterval.unref();

async function scheduleVtCall<T>(cb: () => Promise<T>): Promise<T> {
  const queuedAt = Date.now();
  return vtLimiter.schedule(async () => {
    const waitSeconds = (Date.now() - queuedAt) / 1000;
    if (waitSeconds > 0) {
      rateLimiterDelay.labels('virustotal').observe(waitSeconds);
    }
    try {
      return await cb();
    } finally {
      const reservoir = await vtLimiter.currentReservoir();
      if (typeof reservoir === 'number') {
        requestsRemaining = reservoir;
        apiQuotaRemainingGauge.labels('virustotal').set(reservoir);
        apiQuotaStatusGauge.labels('virustotal').set(reservoir > 0 ? 1 : 0);
      }
    }
  });
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
    logger.warn('VirusTotal quota exceeded during submission');
    apiQuotaStatusGauge.labels('virustotal').set(0);
    apiQuotaRemainingGauge.labels('virustotal').set(0);
    throw new QuotaExceededError('virustotal', 'VirusTotal quota exhausted');
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
      logger.warn('VirusTotal quota exceeded while polling analysis');
      apiQuotaStatusGauge.labels('virustotal').set(0);
      apiQuotaRemainingGauge.labels('virustotal').set(0);
      throw new QuotaExceededError('virustotal', 'VirusTotal quota exhausted');
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
