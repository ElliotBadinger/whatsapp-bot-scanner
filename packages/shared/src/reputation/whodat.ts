import { request } from 'undici';
import { config } from '../config';
import { metrics } from '../metrics';
import { FeatureDisabledError } from '../errors';
import { logger } from '../log';

export interface WhoDatRecord {
  domainName?: string;
  createdDate?: string;
  updatedDate?: string;
  expiresDate?: string;
  registrarName?: string;
  estimatedDomainAgeDays?: number;
  nameServers?: string[];
  status?: string[];
}

export interface WhoDatResponse {
  record?: WhoDatRecord;
}

const SERVICE_LABEL = 'whodat';

/**
 * Query the self-hosted who-dat WHOIS service
 * @param domain - Domain name to query
 * @returns WHOIS record information
 */
export async function whoDatLookup(domain: string): Promise<WhoDatResponse> {
  if (!config.whodat.enabled) {
    throw new FeatureDisabledError('whodat', 'Who-dat WHOIS service disabled');
  }

  const url = new URL(`${config.whodat.baseUrl}/whois/${encodeURIComponent(domain)}`);
  
  metrics.whoisRequests.inc();
  const start = Date.now();

  try {
    const res = await request(url.toString(), {
      method: 'GET',
      headersTimeout: config.whodat.timeoutMs,
      bodyTimeout: config.whodat.timeoutMs,
    });

    const latency = Date.now() - start;

    if (res.statusCode === 404) {
      metrics.whoisResults.labels('not_found').inc();
      logger.debug({ domain }, 'Who-dat: domain not found');
      return { record: undefined };
    }

    if (res.statusCode >= 500) {
      metrics.whoisResults.labels('error').inc();
      const err = new Error(`Who-dat service error: ${res.statusCode}`);
      (err as any).statusCode = res.statusCode;
      throw err;
    }

    if (res.statusCode >= 400) {
      metrics.whoisResults.labels('error').inc();
      const err = new Error(`Who-dat request failed: ${res.statusCode}`);
      (err as any).statusCode = res.statusCode;
      throw err;
    }

    const json: any = await res.body.json();
    metrics.whoisResults.labels('success').inc();

    // Parse creation date and calculate domain age
    const createdDate = json.created_date || json.creation_date;
    let ageDays: number | undefined;
    
    if (createdDate) {
      const created = new Date(createdDate);
      if (!Number.isNaN(created.getTime())) {
        const now = Date.now();
        ageDays = Math.floor((now - created.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    logger.debug({ domain, latency, ageDays }, 'Who-dat lookup completed');

    return {
      record: {
        domainName: json.domain_name || domain,
        createdDate: createdDate,
        updatedDate: json.updated_date,
        expiresDate: json.expiration_date || json.expires_date,
        registrarName: json.registrar || json.registrar_name,
        estimatedDomainAgeDays: ageDays,
        nameServers: json.name_servers || json.nameservers || [],
        status: json.status || [],
      },
    };
  } catch (err) {
    metrics.whoisResults.labels('error').inc();
    logger.warn({ err, domain }, 'Who-dat lookup failed');
    throw err;
  }
}