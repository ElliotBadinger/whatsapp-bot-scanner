import { request } from 'undici';
import { config } from '../config';
import { apiQuotaRemainingGauge, apiQuotaStatusGauge, metrics } from '../metrics';
import { QuotaExceededError, FeatureDisabledError } from '../errors';
import { logger } from '../log';

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

let monthlyRequestCount = 0;
let currentMonth = new Date().getMonth();
let quotaDisabled = false;

apiQuotaRemainingGauge.labels('whoisxml').set(config.whoisxml.monthlyQuota);
apiQuotaStatusGauge.labels('whoisxml').set(config.whoisxml.enabled ? 1 : 0);

function resetMonthlyQuotaIfNeeded(): void {
  const now = new Date();
  if (now.getMonth() !== currentMonth) {
    logger.info({ previousCount: monthlyRequestCount }, 'WhoisXML quota counter reset (new month)');
    monthlyRequestCount = 0;
    currentMonth = now.getMonth();
    quotaDisabled = false;
    apiQuotaRemainingGauge.labels('whoisxml').set(config.whoisxml.monthlyQuota);
    apiQuotaStatusGauge.labels('whoisxml').set(config.whoisxml.enabled ? 1 : 0);
  }
}

function assertQuotaAvailable(): void {
  if (!config.whoisxml.enabled) {
    apiQuotaStatusGauge.labels('whoisxml').set(0);
    throw new FeatureDisabledError('whoisxml', 'WhoisXML disabled');
  }
  if (quotaDisabled) {
    apiQuotaStatusGauge.labels('whoisxml').set(0);
    throw new QuotaExceededError('whoisxml', 'WhoisXML monthly quota exhausted');
  }
  if (monthlyRequestCount >= config.whoisxml.monthlyQuota) {
    quotaDisabled = true;
    apiQuotaRemainingGauge.labels('whoisxml').set(0);
    apiQuotaStatusGauge.labels('whoisxml').set(0);
    metrics.whoisDisabled.labels('quota').inc();
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
  const remaining = Math.max(0, config.whoisxml.monthlyQuota - monthlyRequestCount);
  apiQuotaRemainingGauge.labels('whoisxml').set(remaining);
  apiQuotaStatusGauge.labels('whoisxml').set(remaining > 0 ? 1 : 0);
  metrics.whoisRequests.inc();

  if (remaining <= config.whoisxml.quotaAlertThreshold) {
    logger.warn({ remaining }, 'WhoisXML quota nearing exhaustion');
  }

  const url = new URL('https://www.whoisxmlapi.com/whoisserver/WhoisService');
  url.searchParams.set('apiKey', config.whoisxml.apiKey);
  url.searchParams.set('domainName', domain);
  url.searchParams.set('outputFormat', 'JSON');
  const res = await request(url.toString(), {
    method: 'GET',
    headersTimeout: config.whoisxml.timeoutMs,
    bodyTimeout: config.whoisxml.timeoutMs
  });
  if (res.statusCode === 401 || res.statusCode === 403) {
    const err = new Error('WhoisXML unauthorized');
    (err as any).code = res.statusCode;
    throw err;
  }
  if (res.statusCode === 429) {
    quotaDisabled = true;
    apiQuotaRemainingGauge.labels('whoisxml').set(0);
    apiQuotaStatusGauge.labels('whoisxml').set(0);
    metrics.whoisDisabled.labels('rate_limited').inc();
    throw new QuotaExceededError('whoisxml', 'WhoisXML rate limited');
  }
  if (res.statusCode >= 500) {
    const err = new Error(`WhoisXML error: ${res.statusCode}`);
    (err as any).statusCode = res.statusCode;
    throw err;
  }
  const json: any = await res.body.json();
  const record = json?.WhoisRecord;
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
  apiQuotaRemainingGauge.labels('whoisxml').set(0);
  apiQuotaStatusGauge.labels('whoisxml').set(0);
}
