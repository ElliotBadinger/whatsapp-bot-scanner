import { request, fetch } from 'undici';
import expandUrl from 'url-expand';
import { config } from './config';
import { normalizeUrl } from './url';
import { isPrivateHostname } from './ssrf';
import { metrics } from './metrics';

const DEFAULT_SHORTENERS = [
  'bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'ow.ly', 'is.gd', 'buff.ly', 'adf.ly',
  'rebrand.ly', 'lnkd.in', 'rb.gy', 's.id', 'shorturl.at', 'short.io', 'trib.al',
  'po.st', 'bit.do', 'cutt.ly', 'mcaf.ee', 'su.pr', 'qr.ae', 'zpr.io', 'shor.by',
  'tiny.cc', 'x.co', 'lnk.to', 'amzn.to', 'fb.me', 'ift.tt', 'j.mp', 'youtu.be',
  'spr.ly', 'cli.re', 'wa.link', 'tele.cm', 'grabify.link', 'short.cm', 'v.gd',
  'kutt.it', 'snip.ly', 'ttm.sh', 'gg.gg', 'rb.gy', 'prf.hn', 'chilp.it',
  'qps.ru', 'clk.im', 'u.to', 't2m.io', 'soo.gd', 'shorte.st', 't.ly', 'smarturl.it',
  'vn.tl', 'cbsn.ws', 'cnvrt.ly', 'ibm.co', 'es.pn', 'nyti.ms', 'wapo.st',
  'apne.ws', 'reut.rs', 'trib.it', 'bloom.bg', 'for.tn', 'on.ft.com', 'on.mktw.net',
  'lat.ms', 'washpo.st', 'cnet.co', 'g.co', 'hearsay.social', 'dlvr.it', 'relia.pe',
  'go.aws', 'sforce.co', 'drd.sh', 'get.msgsndr.com', 'expi.co', 'plnk.to', 'starturl.com',
  'shortest.link', 'shorten.rest', 'w.wiki', 'hbr.org/go/', 'r.fr24.com', 'lnkd.in',
  'win.gs', 'engt.co', 'go.nasa.gov', 'go.wired.com'
].map(s => s.toLowerCase());

const SHORTENER_HOSTS = new Set(DEFAULT_SHORTENERS);

export function registerAdditionalShorteners(hosts: string[]) {
  for (const host of hosts) {
    if (host) SHORTENER_HOSTS.add(host.toLowerCase());
  }
}

export function isKnownShortener(hostname: string): boolean {
  return SHORTENER_HOSTS.has(hostname.toLowerCase());
}

export interface ShortenerResolution {
  finalUrl: string;
  provider: 'unshorten_me' | 'direct' | 'urlexpander' | 'original';
  chain: string[];
  wasShortened: boolean;
  error?: string;
}

interface UnshortenResponse {
  requested_url?: string;
  resolved_url?: string;
  success?: boolean;
  error?: string;
}

async function resolveWithUnshorten(url: string): Promise<string | null> {
  try {
    const endpoint = config.shortener.unshortenEndpoint.replace(/\/+$/, '');
    const res = await request(`${endpoint}/${encodeURIComponent(url)}`, {
      method: 'GET',
      headersTimeout: 5000,
      bodyTimeout: 5000
    });
    if (res.statusCode >= 400) return null;
    const json = await res.body.json() as UnshortenResponse;
    if (json?.resolved_url && json.success !== false) {
      const normalized = normalizeUrl(json.resolved_url);
      return normalized || json.resolved_url;
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveWithHead(url: string): Promise<{ finalUrl: string; chain: string[] } | null> {
  const { maxRedirects, timeoutMs, maxContentLength } = config.orchestrator.expansion;
  let current = url;
  const chain: string[] = [];

  for (let i = 0; i < maxRedirects; i += 1) {
    const norm = normalizeUrl(current);
    if (!norm) break;

    const parsed = new URL(norm);
    if (await isPrivateHostname(parsed.hostname)) break;

    chain.push(norm);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(norm, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      });

      const contentLengthHeader = response.headers?.get?.('content-length');
      if (contentLengthHeader) {
        const contentLength = Number.parseInt(contentLengthHeader, 10);
        if (Number.isFinite(contentLength) && contentLength > maxContentLength) {
          throw new Error(`Content too large: ${contentLength} bytes`);
        }
      }

      if (response.status >= 400) {
        if (response.status >= 500) {
          throw new Error(`Expansion request failed with status ${response.status}`);
        }
        return null;
      }

      const location = response.headers?.get?.('location');
      if (response.status >= 300 && response.status < 400) {
        if (!location) {
          return { finalUrl: norm, chain };
        }
        current = new URL(location, norm).toString();
        continue;
      }

      return { finalUrl: norm, chain };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Expansion timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return chain.length ? { finalUrl: chain[chain.length - 1], chain } : null;
}

async function resolveWithUrlExpander(url: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    try {
      expandUrl(url, async (err: unknown, expanded?: string) => {
        if (err || !expanded) {
          reject(err ?? new Error('Expansion failed'));
          return;
        }
        try {
          const normalized = normalizeUrl(expanded) || expanded;
          const parsed = new URL(normalized);
          const isPrivate = await isPrivateHostname(parsed.hostname);
          if (isPrivate) {
            reject(new Error('SSRF protection: Private IP blocked'));
            return;
          }
          resolve(normalized);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function resolveShortener(url: string): Promise<ShortenerResolution> {
  const normalized = normalizeUrl(url);
  const chain: string[] = [];
  if (!normalized) {
    return { finalUrl: url, provider: 'original', chain, wasShortened: false };
  }
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (!isKnownShortener(hostname)) {
    return { finalUrl: normalized, provider: 'original', chain, wasShortened: false };
  }

  const tries = Math.max(1, config.shortener.unshortenRetries);
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const resolved = await resolveWithUnshorten(normalized);
    if (resolved) {
      metrics.shortenerExpansion.labels('unshorten.me', 'success').inc();
      return {
        finalUrl: resolved,
        provider: 'unshorten_me',
        chain: [normalized, resolved],
        wasShortened: true,
      };
    }
  }
  metrics.shortenerExpansion.labels('unshorten.me', 'error').inc();

  let fallback: { finalUrl: string; chain: string[] } | null = null;
  let directError: unknown;
  try {
    fallback = await resolveWithHead(normalized);
  } catch (error) {
    directError = error;
    metrics.shortenerExpansion.labels('direct', 'error').inc();
  }

  if (fallback) {
    metrics.shortenerExpansion.labels('direct', 'success').inc();
    return {
      finalUrl: fallback.finalUrl,
      provider: 'direct',
      chain: fallback.chain,
      wasShortened: true,
    };
  }

  try {
    const expanded = await resolveWithUrlExpander(normalized);
    if (expanded) {
      metrics.shortenerExpansion.labels('urlexpander', 'success').inc();
      return {
        finalUrl: expanded,
        provider: 'urlexpander',
        chain: [normalized, expanded],
        wasShortened: true,
      };
    }
  } catch (error) {
    metrics.shortenerExpansion.labels('urlexpander', 'error').inc();
    return {
      finalUrl: normalized,
      provider: 'original',
      chain: [normalized],
      wasShortened: true,
      error: error instanceof Error ? error.message : 'Expansion failed',
    };
  }

  metrics.shortenerExpansion.labels('urlexpander', 'error').inc();
  return {
    finalUrl: normalized,
    provider: 'original',
    chain: [normalized],
    wasShortened: true,
    error:
      directError instanceof Error
        ? directError.message
        : 'Expansion failed',
  };
}
