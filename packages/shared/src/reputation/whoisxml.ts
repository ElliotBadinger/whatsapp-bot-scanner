import { request } from 'undici';
import { config } from '../config';
import { apiQuotaRemainingGauge, apiQuotaStatusGauge, metrics } from '../metrics';
import { QuotaExceededError, FeatureDisabledError } from '../errors';
import { logger } from '../log';
import { HttpError } from '../http-errors';

export interface WhoisXmlRecord {
  domainName?: string;
  createdDate?: string;
  updatedDate?: string;
  expiresDate?: string;
  registrarName?: string;
  estimatedDomainAgeDays?: number;
}

export interface WhoisXmlResponse {
  record?: WhoisXmlRecord;
}

const SERVICE_LABEL = 'whoisxml';

let monthlyRequestCount = 0;
let currentMonth = new Date().getMonth();
let quotaDisabled = false;

function updateQuotaMetrics(remaining: number, available: boolean): void {
  const quota = Math.max(1, config.whoisxml.monthlyQuota);
  const boundedRemaining = Math.max(0, remaining);
  apiQuotaRemainingGauge.labels(SERVICE_LABEL).set(boundedRemaining);
  apiQuotaStatusGauge.labels(SERVICE_LABEL).set(available ? 1 : 0);
  const consumed = Math.max(0, config.whoisxml.monthlyQuota - boundedRemaining);
  const utilization = available ? Math.min(1, consumed / quota) : 1;
  metrics.apiQuotaUtilization.labels(SERVICE_LABEL).set(utilization);
  const projection = available ? boundedRemaining * 3600 : 0;
  metrics.apiQuotaProjectedDepletion.labels(SERVICE_LABEL).set(projection);
}

updateQuotaMetrics(config.whoisxml.enabled ? config.whoisxml.monthlyQuota : 0, config.whoisxml.enabled);

function resetMonthlyQuotaIfNeeded(): void {
  const now = new Date();
  if (now.getMonth() !== currentMonth) {
    logger.info({ previousCount: monthlyRequestCount }, 'WhoisXML quota counter reset (new month)');
    monthlyRequestCount = 0;
    currentMonth = now.getMonth();
    quotaDisabled = false;
    updateQuotaMetrics(config.whoisxml.enabled ? config.whoisxml.monthlyQuota : 0, config.whoisxml.enabled);
    metrics.apiQuotaResets.labels(SERVICE_LABEL).inc();
  }
}

function assertQuotaAvailable(): void {
  if (!config.whoisxml.enabled) {
    updateQuotaMetrics(0, false);
    metrics.whoisResults.labels('disabled').inc();
    throw new FeatureDisabledError('whoisxml', 'WhoisXML disabled');
  }
  if (quotaDisabled) {
    updateQuotaMetrics(0, false);
    throw new QuotaExceededError('whoisxml', 'WhoisXML monthly quota exhausted');
  }
  if (monthlyRequestCount >= config.whoisxml.monthlyQuota) {
    quotaDisabled = true;
    updateQuotaMetrics(0, false);
    metrics.whoisDisabled.labels('quota').inc();
    metrics.whoisResults.labels('quota_exhausted').inc();
    throw new QuotaExceededError('whoisxml', 'WhoisXML monthly quota exhausted');
  }
}

export async function whoisXmlLookup(domain: string): Promise<WhoisXmlResponse> {
  if (!config.whoisxml.apiKey) {
    throw new FeatureDisabledError('whoisxml', 'WhoisXML missing API key');
  }

  resetMonthlyQuotaIfNeeded();
  assertQuotaAvailable();

  monthlyRequestCount += 1;
  metrics.apiQuotaConsumption.labels(SERVICE_LABEL).inc();
  const remaining = Math.max(0, config.whoisxml.monthlyQuota - monthlyRequestCount);
  updateQuotaMetrics(remaining, remaining > 0);
  metrics.whoisRequests.inc();

  if (remaining <= config.whoisxml.quotaAlertThreshold) {
    logger.warn({ remaining }, 'WhoisXML quota nearing exhaustion');
  }

  const url = new URL('https://www.whoisxmlapi.com/whoisserver/WhoisService');
  url.searchParams.set('apiKey', config.whoisxml.apiKey);
  url.searchParams.set('domainName', domain);
  url.searchParams.set('outputFormat', 'JSON');
  let res: Awaited<ReturnType<typeof request>>;
  try {
    res = await request(url.toString(), {
      method: 'GET',
      headersTimeout: config.whoisxml.timeoutMs,
      bodyTimeout: config.whoisxml.timeoutMs
    });
  } catch (err) {
    metrics.whoisResults.labels('error').inc();
    throw err;
  }
  if (res.statusCode === 401 || res.statusCode === 403) {
    metrics.whoisResults.labels('unauthorized').inc();
    const err = new Error('WhoisXML unauthorized') as HttpError;
    err.code = res.statusCode;
    throw err;
  }
  if (res.statusCode === 429) {
    quotaDisabled = true;
    updateQuotaMetrics(0, false);
    metrics.whoisDisabled.labels('rate_limited').inc();
    metrics.whoisResults.labels('rate_limited').inc();
    metrics.whoisResults.labels('quota_exhausted').inc();
    throw new QuotaExceededError('whoisxml', 'WhoisXML rate limited');
  }
  if (res.statusCode >= 400 && res.statusCode < 500) {
    metrics.whoisResults.labels('error').inc();
    const err = new Error(`WhoisXML error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  if (res.statusCode >= 500) {
    metrics.whoisResults.labels('error').inc();
    const err = new Error(`WhoisXML error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  const json = await res.body.json() as {
    WhoisRecord?: {
      domainName?: string;
      createdDateNormalized?: string;
      createdDate?: string;
      updatedDateNormalized?: string;
      updatedDate?: string;
      expiresDateNormalized?: string;
      expiresDate?: string;
      registrarName?: string;
      registrarNameSponsored?: string;
      registryData?: {
        createdDateNormalized?: string;
      };
    };
  };
  const record = json?.WhoisRecord;
  metrics.whoisResults.labels('success').inc();
  if (!record) return { record: undefined };
  const created = record.createdDateNormalized || record.registryData?.createdDateNormalized || record.createdDate;
  const createdDate = created ? new Date(created) : undefined;
  let ageDays: number | undefined;
  if (createdDate && !Number.isNaN(createdDate.getTime())) {
    const now = Date.now();
    ageDays = Math.floor((now - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  return {
    record: {
      domainName: record.domainName,
      createdDate: created,
      updatedDate: record.updatedDateNormalized || record.updatedDate,
      expiresDate: record.expiresDateNormalized || record.expiresDate,
      registrarName: record.registrarName || record.registrarNameSponsored,
      estimatedDomainAgeDays: ageDays
    }
  };
}

export function disableWhoisXmlForMonth(): void {
  quotaDisabled = true;
  updateQuotaMetrics(0, false);
}
