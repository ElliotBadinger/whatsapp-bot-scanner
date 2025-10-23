import { request, fetch as undiciFetch } from 'undici';
import urlExpandModuleRaw from 'url-expand';
import { promisify } from 'node:util';
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
  provider: 'unshorten_me' | 'url_expand' | 'original';
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

type FetchInput = Parameters<typeof undiciFetch>[0];
type SafeFetch = (input: FetchInput, init?: Parameters<typeof undiciFetch>[1]) => ReturnType<typeof undiciFetch>;

function createGuardedFetch(
  chain: string[],
  maxRedirects: number,
  timeoutMs: number,
  maxContentLength: number,
): SafeFetch {
  let attempts = 0;

  return async (input, init) => {
    const rawTarget =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input && typeof input === 'object' && 'url' in input && typeof (input as { url?: unknown }).url === 'string'
            ? (input as { url: string }).url
            : undefined;

    if (!rawTarget) {
      throw new Error('Expansion failed: Missing target URL');
    }

    const normalizedTarget = normalizeUrl(rawTarget) || rawTarget;
    const parsed = new URL(normalizedTarget);
    if (await isPrivateHostname(parsed.hostname)) {
      throw new Error('SSRF protection: Private host blocked');
    }

    if (attempts >= maxRedirects) {
      throw new Error(`Redirect limit exceeded (${maxRedirects})`);
    }
    attempts += 1;

    if (!chain.length || chain[chain.length - 1] !== normalizedTarget) {
      chain.push(normalizedTarget);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await undiciFetch(normalizedTarget, {
        ...init,
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

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Expansion timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

async function resolveWithUrlExpand(url: string): Promise<{ finalUrl: string; chain: string[] }> {
  const { maxRedirects, timeoutMs, maxContentLength } = config.orchestrator.expansion;
  const normalizedInput = normalizeUrl(url) || url;
  const chain: string[] = [normalizedInput];
  const moduleAny = urlExpandModuleRaw as any;
  const modernExpand: ((shortUrl: string, options: { fetch: SafeFetch; maxRedirects: number; timeoutMs: number }) => Promise<{ url: string; redirects?: string[] }>) | undefined =
    typeof moduleAny?.expand === 'function' ? moduleAny.expand.bind(moduleAny) : undefined;

  if (modernExpand) {
    const fetchWithGuards = createGuardedFetch(chain, maxRedirects, timeoutMs, maxContentLength);
    const result = await modernExpand(normalizedInput, {
      fetch: fetchWithGuards,
      maxRedirects,
      timeoutMs,
    });

    if (Array.isArray(result.redirects)) {
      for (const redirect of result.redirects) {
        const normalizedRedirect = normalizeUrl(redirect) || redirect;
        if (chain[chain.length - 1] !== normalizedRedirect) {
          chain.push(normalizedRedirect);
        }
      }
    }

    const finalUrl = normalizeUrl(result.url) || result.url;
    if (chain[chain.length - 1] !== finalUrl) {
      chain.push(finalUrl);
    }

    return { finalUrl, chain };
  }

  const legacyExpand = typeof moduleAny === 'function'
    ? promisify(moduleAny as (shortUrl: string, callback: (error: unknown, expandedUrl?: string | null) => void) => void)
    : undefined;

  if (!legacyExpand) {
    throw new Error('url-expand module does not expose a supported interface');
  }

  const expandedUrl = await legacyExpand(normalizedInput) as string;
  if (!expandedUrl) {
    throw new Error('url-expand returned empty response');
  }

  const normalizedFinal = normalizeUrl(expandedUrl) || expandedUrl;

  let parsedFinal: URL;
  try {
    parsedFinal = new URL(normalizedFinal);
  } catch {
    throw new Error('url-expand returned invalid URL');
  }

  if (await isPrivateHostname(parsedFinal.hostname)) {
    throw new Error('SSRF protection: Private host blocked');
  }

  if (chain[chain.length - 1] !== normalizedFinal) {
    chain.push(normalizedFinal);
  }

  return { finalUrl: normalizedFinal, chain };
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
  try {
    const expanded = await resolveWithUrlExpand(normalized);
    metrics.shortenerExpansion.labels('url-expand', 'success').inc();
    return {
      finalUrl: expanded.finalUrl,
      provider: 'url_expand',
      chain: expanded.chain,
      wasShortened: true,
    };
  } catch (error) {
    metrics.shortenerExpansion.labels('url-expand', 'error').inc();
    return {
      finalUrl: normalized,
      provider: 'original',
      chain: [normalized],
      wasShortened: true,
      error: error instanceof Error ? error.message : 'Expansion failed',
    };
  }
}
