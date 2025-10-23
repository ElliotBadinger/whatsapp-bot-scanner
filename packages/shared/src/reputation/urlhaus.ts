import { request } from 'undici';
import { config } from '../config';

export interface UrlhausLookupResult {
  listed: boolean;
  threat?: string;
  urlId?: string;
  firstSeen?: string;
  lastSeen?: string;
  reporter?: string;
  blacklists?: string[];
  latencyMs?: number;
}

export async function urlhausLookup(url: string, timeoutMs = config.urlhaus.timeoutMs): Promise<UrlhausLookupResult> {
  if (!config.urlhaus.enabled) return { listed: false, latencyMs: 0 };
  const start = Date.now();
  const res = await request('https://urlhaus-api.abuse.ch/v1/url/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url }).toString(),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs
  });
  if (res.statusCode === 429) {
    const err = new Error('URLhaus rate limited');
    (err as any).code = 429;
    throw err;
  }
  if (res.statusCode >= 500) {
    const err = new Error(`URLhaus error: ${res.statusCode}`);
    (err as any).statusCode = res.statusCode;
    throw err;
  }
  const json: any = await res.body.json();
  if (json?.query_status === 'ok') {
    return {
      listed: true,
      threat: json.threat ?? json.threat_type ?? undefined,
      urlId: json.id ?? json.urlid ?? undefined,
      firstSeen: json.date_added ?? json.firstseen ?? undefined,
      lastSeen: json.last_seen ?? undefined,
      reporter: json.reporter ?? undefined,
      blacklists: Array.isArray(json.blacklists) ? json.blacklists : undefined,
      latencyMs: Date.now() - start
    };
  }
  if (json?.query_status === 'no_results') {
    return { listed: false, latencyMs: Date.now() - start };
  }
  // Unknown response – treat as error to trigger fallback handling
  const err = new Error('URLhaus unexpected response');
  (err as any).details = json;
  throw err;
}
