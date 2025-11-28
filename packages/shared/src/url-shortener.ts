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

export type ExpansionFailureReason =
  | 'timeout'
  | 'max-content-length'
  | 'http-error'
  | 'library-error'
  | 'ssrf-blocked'
  | 'expansion-failed';

export interface ShortenerResolution {
  finalUrl: string;
  provider: 'unshorten_me' | 'direct' | 'urlexpander' | 'original';
  chain: string[];
  wasShortened: boolean;
  expanded: boolean;
  reason?: ExpansionFailureReason;
  error?: string;
}

class DirectExpansionError extends Error {
  constructor(public reason: ExpansionFailureReason, message?: string) {
    super(message ?? reason);
    this.name = 'DirectExpansionError';
  }
}

function failureReasonFrom(
  urlExpanderError: unknown,
  directError: unknown,
): ExpansionFailureReason {
  if (urlExpanderError instanceof Error && urlExpanderError.message.includes('SSRF protection')) {
    return 'ssrf-blocked';
  }
  if (directError instanceof DirectExpansionError) {
    return directError.reason;
  }
  if (urlExpanderError) {
    return 'library-error';
  }
  return 'expansion-failed';
}

function failureMessageFrom(urlExpanderError: unknown, directError: unknown): string {
  if (urlExpanderError instanceof Error && urlExpanderError.message.includes('SSRF protection')) {
    return urlExpanderError.message;
  }
  if (directError instanceof DirectExpansionError) {
    return directError.message;
  }
  if (urlExpanderError instanceof Error) {
    return urlExpanderError.message;
  }
  if (directError instanceof Error) {
    return directError.message;
  }
  return 'Expansion failed';
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

function extractTargetUrl(input: FetchInput): string {
  const rawTarget =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input && typeof input === 'object' && 'url' in input && typeof (input as { url?: unknown }).url === 'string'
          ? (input as { url: string }).url
          : undefined;

  if (!rawTarget) {
    throw new DirectExpansionError('expansion-failed', 'Expansion failed: Missing target URL');
  }

  return rawTarget;
}

async function validateAndNormalizeUrl(rawTarget: string, chain: string[]): Promise<string> {
  const normalizedTarget = normalizeUrl(rawTarget) || rawTarget;
  const parsed = new URL(normalizedTarget);

  if (await isPrivateHostname(parsed.hostname)) {
    throw new DirectExpansionError('ssrf-blocked', 'SSRF protection: Private host blocked');
  }

  if (!chain.length || chain[chain.length - 1] !== normalizedTarget) {
    chain.push(normalizedTarget);
  }

  return normalizedTarget;
}

type UndiciResponse = Awaited<ReturnType<typeof undiciFetch>>;

async function checkContentLength(response: UndiciResponse, maxContentLength: number): Promise<void> {
  const contentLengthHeader = response.headers?.get?.('content-length');
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxContentLength) {
      // @ts-ignore - body.cancel is not in the type definition but exists at runtime for undici streams
      response.body?.cancel?.();
      throw new DirectExpansionError('max-content-length', `Content too large: ${contentLength} bytes`);
    }
  }
}

function handleFetchError(error: unknown, timeoutMs: number): never {
  if (error instanceof DirectExpansionError) {
    throw error;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    throw new DirectExpansionError('timeout', `Expansion timed out after ${timeoutMs}ms`);
  }
  throw new DirectExpansionError(
    'http-error',
    error instanceof Error ? error.message : 'Expansion failed',
  );
}

function createGuardedFetch(
  chain: string[],
  maxRedirects: number,
  timeoutMs: number,
  maxContentLength: number,
): SafeFetch {
  let attempts = 0;

  return async (input, init) => {
    const rawTarget = extractTargetUrl(input);
    const normalizedTarget = await validateAndNormalizeUrl(rawTarget, chain);

    if (attempts >= maxRedirects) {
      throw new DirectExpansionError('expansion-failed', `Redirect limit exceeded (${maxRedirects})`);
    }
    attempts += 1;

    try {
      const response = await undiciFetch(normalizedTarget, {
        ...init,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });

      await checkContentLength(response, maxContentLength);
      return response;
    } catch (error) {
      handleFetchError(error, timeoutMs);
    }
  };
}

async function processRedirectResponse(response: UndiciResponse, normalized: string, chain: string[]): Promise<{ nextUrl?: string; result?: { finalUrl: string; chain: string[] } }> {
  const location = response.headers?.get?.('location');
  if (response.status >= 300 && response.status < 400) {
    if (!location) {
      // @ts-ignore
      response.body?.cancel?.();
      return { result: { finalUrl: normalized, chain } };
    }
    // @ts-ignore
    response.body?.cancel?.();
    return { nextUrl: new URL(location, normalized).toString() };
  }

  // @ts-ignore
  response.body?.cancel?.();
  return { result: { finalUrl: normalized, chain } };
}

async function fetchAndValidateUrl(normalized: string, timeoutMs: number, maxContentLength: number): Promise<UndiciResponse | null> {
  const response = await undiciFetch(normalized, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentLengthHeader = response.headers?.get?.('content-length');
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxContentLength) {
      // @ts-ignore
      response.body?.cancel?.();
      throw new DirectExpansionError('max-content-length', `Content too large: ${contentLength} bytes`);
    }
  }

  if (response.status >= 400) {
    if (response.status >= 500) {
      // @ts-ignore
      response.body?.cancel?.();
      throw new DirectExpansionError('http-error', `Expansion request failed with status ${response.status}`);
    }
    return null;
  }

  return response;
}

async function resolveDirectly(url: string): Promise<{ finalUrl: string; chain: string[] } | null> {
  const { maxRedirects, timeoutMs, maxContentLength } = config.orchestrator.expansion;
  let current = url;
  const chain: string[] = [];

  for (let i = 0; i < maxRedirects; i += 1) {
    const normalized = normalizeUrl(current) || current;
    if (!normalized) break;

    const parsed = new URL(normalized);
    if (await isPrivateHostname(parsed.hostname)) {
      throw new DirectExpansionError('ssrf-blocked', 'SSRF protection: Private host blocked');
    }

    if (!chain.length || chain[chain.length - 1] !== normalized) {
      chain.push(normalized);
    }

    try {
      const response = await fetchAndValidateUrl(normalized, timeoutMs, maxContentLength);
      if (!response) return null;

      const { nextUrl, result } = await processRedirectResponse(response, normalized, chain);
      if (result) return result;
      if (nextUrl) {
        current = nextUrl;
        continue;
      }
    } catch (error) {
      if (error instanceof DirectExpansionError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DirectExpansionError('timeout', `Expansion timed out after ${timeoutMs}ms`);
      }
      throw new DirectExpansionError(
        'http-error',
        error instanceof Error ? error.message : 'Expansion failed',
      );
    }
  }

  return chain.length ? { finalUrl: chain[chain.length - 1], chain } : null;
}

function getUrlExpandModule() {
  const moduleUnknown = urlExpandModuleRaw as unknown;
  const moduleAny = moduleUnknown as { expand?: unknown };
  const modernExpand: ((shortUrl: string, options: { fetch: SafeFetch; maxRedirects: number; timeoutMs: number }) => Promise<{ url: string; redirects?: string[] }>) | undefined =
    typeof moduleAny?.expand === 'function' ? (moduleAny.expand as typeof modernExpand) : undefined;

  const legacyExpand = typeof moduleAny === 'function'
    ? promisify(moduleAny as (shortUrl: string, callback: (error: unknown, expandedUrl?: string | null) => void) => void)
    : undefined;

  return { modernExpand, legacyExpand };
}

async function processModernExpandResult(result: { url: string; redirects?: string[] }, chain: string[]): Promise<{ finalUrl: string; chain: string[] }> {
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

async function processLegacyExpandResult(expandedUrl: string, chain: string[]): Promise<{ finalUrl: string; chain: string[] }> {
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
    throw new DirectExpansionError('ssrf-blocked', 'SSRF protection: Private host blocked');
  }

  if (chain[chain.length - 1] !== normalizedFinal) {
    chain.push(normalizedFinal);
  }

  return { finalUrl: normalizedFinal, chain };
}

async function resolveWithUrlExpand(url: string): Promise<{ finalUrl: string; chain: string[] }> {
  const { maxRedirects, timeoutMs, maxContentLength } = config.orchestrator.expansion;
  const normalizedInput = normalizeUrl(url) || url;
  const chain: string[] = [normalizedInput];

  const { modernExpand, legacyExpand } = getUrlExpandModule();

  if (modernExpand) {
    const fetchWithGuards = createGuardedFetch(chain, maxRedirects, timeoutMs, maxContentLength);
    const result = await modernExpand(normalizedInput, {
      fetch: fetchWithGuards,
      maxRedirects,
      timeoutMs,
    });

    return processModernExpandResult(result, chain);
  }

  if (!legacyExpand) {
    throw new Error('url-expand module does not expose a supported interface');
  }

  const expandedUrl = await legacyExpand(normalizedInput) as string;
  return processLegacyExpandResult(expandedUrl, chain);
}

export async function resolveShortener(url: string): Promise<ShortenerResolution> {
  const normalized = normalizeUrl(url);
  const chain: string[] = [];
  if (!normalized) {
    return { finalUrl: url, provider: 'original', chain, wasShortened: false, expanded: false };
  }
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (!isKnownShortener(hostname)) {
    return { finalUrl: normalized, provider: 'original', chain, wasShortened: false, expanded: false };
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
        expanded: normalized !== resolved,
      };
    }
  }
  metrics.shortenerExpansion.labels('unshorten.me', 'error').inc();

  let directResult: { finalUrl: string; chain: string[] } | null = null;
  let directError: unknown;
  try {
    directResult = await resolveDirectly(normalized);
  } catch (error) {
    directError = error;
    metrics.shortenerExpansion.labels('direct', 'error').inc();
  }

  if (directResult) {
    metrics.shortenerExpansion.labels('direct', 'success').inc();
    return {
      finalUrl: directResult.finalUrl,
      provider: 'direct',
      chain: directResult.chain,
      wasShortened: true,
      expanded: directResult.chain.length > 1 || directResult.finalUrl !== normalized,
    };
  }

  try {
    const expanded = await resolveWithUrlExpand(normalized);
    metrics.shortenerExpansion.labels('urlexpander', 'success').inc();
    return {
      finalUrl: expanded.finalUrl,
      provider: 'urlexpander',
      chain: expanded.chain,
      wasShortened: true,
      expanded: expanded.chain.length > 1 || expanded.finalUrl !== normalized,
    };
  } catch (error) {
    metrics.shortenerExpansion.labels('urlexpander', 'error').inc();
    return {
      finalUrl: normalized,
      provider: 'original',
      chain: [normalized],
      wasShortened: true,
      expanded: false,
      reason: failureReasonFrom(error, directError),
      error: failureMessageFrom(error, directError),
    };
  }
}
