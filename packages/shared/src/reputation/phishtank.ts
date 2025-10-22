import { request } from 'undici';
import { config } from '../config';

export interface PhishtankLookupResult {
  inDatabase: boolean;
  verified: boolean;
  verifiedAt?: string;
  url?: string;
  phishId?: number;
  submissionTime?: string;
  detailsUrl?: string;
  latencyMs?: number;
}

export async function phishtankLookup(url: string, timeoutMs = config.phishtank.timeoutMs): Promise<PhishtankLookupResult> {
  if (!config.phishtank.enabled) {
    return { inDatabase: false, verified: false, latencyMs: 0 };
  }
  const params = new URLSearchParams({
    url,
    format: 'json',
    app_key: config.phishtank.appKey || '',
    response: 'json'
  });

  const start = Date.now();
  const res = await request('https://checkurl.phishtank.com/checkurl/', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': config.phishtank.userAgent
    },
    body: params.toString(),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs
  });

  if (res.statusCode === 429) {
    const err = new Error('Phishtank rate limited');
    (err as any).code = 429;
    throw err;
  }
  if (res.statusCode >= 500) {
    const err = new Error(`Phishtank error: ${res.statusCode}`);
    (err as any).statusCode = res.statusCode;
    throw err;
  }

  const json: any = await res.body.json();
  const results = json?.results;
  if (!results) {
    return { inDatabase: false, verified: false, latencyMs: Date.now() - start };
  }
  const inDatabase = Boolean(results.in_database);
  const verified = inDatabase && Boolean(results.verified);
  return {
    inDatabase,
    verified,
    verifiedAt: results.verified_at ?? undefined,
    url: results.url ?? undefined,
    phishId: results.phish_id ?? undefined,
    submissionTime: results.submission_time ?? undefined,
    detailsUrl: results.phishtank_url ?? undefined,
    latencyMs: Date.now() - start
  };
}
