import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { isPrivateHostname } from './ssrf';
import { request } from 'undici';
import { toASCII } from 'punycode/';
import { parse } from 'tldts';
import { isKnownShortener } from './url-shortener';

const TRACKING_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'vero_conv', 'vero_id']);

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /((https?:\/\/|www\.)[^\s<>()]+[^\s`!()\[\]{};:'".,<>?«»“”‘’])/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map(m => m.startsWith('http') ? m : `http://${m}`)));
}

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hostname = u.hostname.toLowerCase();
    // IDN -> ASCII
    u.hostname = toASCII(u.hostname);
    // strip default ports
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }
    // strip fragments
    u.hash = '';
    // strip tracking params
    for (const p of Array.from(u.searchParams.keys())) {
      if (TRACKING_PARAMS.has(p)) u.searchParams.delete(p);
    }
    // normalize path
    u.pathname = u.pathname.replace(/\/+/g, '/');
    return u.toString();
  } catch {
    return null;
  }
}

export function urlHash(norm: string): string {
  return createHash('sha256').update(norm).digest('hex');
}

export async function expandUrl(raw: string, opts: { maxRedirects: number; timeoutMs: number; maxContentLength: number; }): Promise<{ finalUrl: string; chain: string[]; contentType?: string; }> {
  const chain: string[] = [];
  let current = raw;
  for (let i = 0; i < opts.maxRedirects; i++) {
    const nu = normalizeUrl(current);
    if (!nu) break;
    const u = new URL(nu);
    if (await isPrivateHostname(u.hostname)) break; // SSRF block
    const { statusCode, headers } = await request(u, {
      method: 'HEAD',
      maxRedirections: 0,
      headersTimeout: opts.timeoutMs,
      bodyTimeout: opts.timeoutMs,
      headers: { 'user-agent': 'wbscanner/0.1' }
    }).catch(() => ({ statusCode: 0, headers: {} as Record<string, unknown> }));
    chain.push(nu);
    if (statusCode && statusCode >= 300 && statusCode < 400) {
      const loc = headers['location'];
      if (!loc) break;
      current = new URL(loc as string, u).toString();
      continue;
    }
    const ct = Array.isArray(headers['content-type']) ? headers['content-type'][0] : headers['content-type'];
    return { finalUrl: nu, chain, contentType: ct as string | undefined };
  }
  const nu = normalizeUrl(current) || current;
  return { finalUrl: nu, chain };
}

export function isSuspiciousTld(hostname: string): boolean {
  const t = parse(hostname);
  const bad = new Set(['zip', 'mov', 'tk', 'ml', 'cf', 'gq', 'work', 'click', 'country', 'kim', 'men', 'party', 'science', 'top', 'xyz', 'club', 'link']);
  return !!t.publicSuffix && bad.has(t.publicSuffix);
}

export function isShortener(hostname: string): boolean {
  return isKnownShortener(hostname);
}

function parseForbiddenPatterns(): string[] {
  return (process.env.WA_FORBIDDEN_HOSTNAMES || '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(entry => entry.length > 0);
}

export async function isForbiddenHostname(hostname: string): Promise<boolean> {
  const patterns = parseForbiddenPatterns();
  if (patterns.length === 0) return false;

  const lowerHost = hostname.toLowerCase();
  return patterns.some(pattern => lowerHost === pattern || lowerHost.endsWith(`.${pattern}`));
}
