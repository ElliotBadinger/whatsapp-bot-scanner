import { request } from 'undici';
import { config } from '../config';

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

export async function whoisXmlLookup(domain: string): Promise<WhoisXmlResponse> {
  if (!config.whoisxml.enabled || !config.whoisxml.apiKey) {
    throw new Error('WhoisXML disabled or missing API key');
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
    const err = new Error('WhoisXML rate limited');
    (err as any).code = 429;
    throw err;
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
