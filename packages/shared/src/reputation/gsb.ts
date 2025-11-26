import { request } from 'undici';
import { config } from '../config';
import { HttpError } from '../http-errors';

export interface GsbThreatMatch {
  threatType: string;
  platformType: string;
  threatEntryType: string;
  threat: string;
}

export interface GsbLookupResult {
  matches: GsbThreatMatch[];
  latencyMs: number;
}

export async function gsbLookup(urls: string[], timeoutMs = config.gsb.timeoutMs): Promise<GsbLookupResult> {
  if (!config.gsb.apiKey || urls.length === 0) return { matches: [], latencyMs: 0 };
  const body = {
    client: { clientId: 'wbscanner', clientVersion: '0.1' },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'MALICIOUS_BINARY'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: urls.map(u => ({ url: u }))
    }
  };
  const start = Date.now();
  const res = await request(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${config.gsb.apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs
  });
  if (res.statusCode >= 500) {
    const err = new Error(`Google Safe Browsing error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  const json = await res.body.json() as { matches?: Array<{ threatType: string; platformType: string; threatEntryType: string; threat: { url?: string } | string }> };
  const matches: GsbThreatMatch[] = Array.isArray(json?.matches)
    ? json.matches.map((match) => ({
      threatType: match.threatType,
      platformType: match.platformType,
      threatEntryType: match.threatEntryType,
      threat: typeof match.threat === 'string' ? match.threat : (match.threat?.url ?? '')
    }))
    : [];
  return { matches, latencyMs: Date.now() - start };
}
