import { request, fetch as undiciFetch } from "undici";
import { config } from "./config";
import { normalizeUrl } from "./url";
import { isPrivateHostname } from "./ssrf";
import { metrics } from "./metrics";

const DEFAULT_SHORTENERS = [
  "bit.ly",
  "goo.gl",
  "t.co",
  "tinyurl.com",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "adf.ly",
  "rebrand.ly",
  "lnkd.in",
  "rb.gy",
  "s.id",
  "shorturl.at",
  "short.io",
  "trib.al",
  "po.st",
  "bit.do",
  "cutt.ly",
  "mcaf.ee",
  "su.pr",
  "qr.ae",
  "zpr.io",
  "shor.by",
  "tiny.cc",
  "x.co",
  "lnk.to",
  "amzn.to",
  "fb.me",
  "ift.tt",
  "j.mp",
  "youtu.be",
  "spr.ly",
  "cli.re",
  "wa.link",
  "tele.cm",
  "grabify.link",
  "short.cm",
  "v.gd",
  "kutt.it",
  "snip.ly",
  "ttm.sh",
  "gg.gg",
  "rb.gy",
  "prf.hn",
  "chilp.it",
  "qps.ru",
  "clk.im",
  "u.to",
  "t2m.io",
  "soo.gd",
  "shorte.st",
  "t.ly",
  "smarturl.it",
  "vn.tl",
  "cbsn.ws",
  "cnvrt.ly",
  "ibm.co",
  "es.pn",
  "nyti.ms",
  "wapo.st",
  "apne.ws",
  "reut.rs",
  "trib.it",
  "bloom.bg",
  "for.tn",
  "on.ft.com",
  "on.mktw.net",
  "lat.ms",
  "washpo.st",
  "cnet.co",
  "g.co",
  "hearsay.social",
  "dlvr.it",
  "relia.pe",
  "go.aws",
  "sforce.co",
  "drd.sh",
  "get.msgsndr.com",
  "expi.co",
  "plnk.to",
  "starturl.com",
  "shortest.link",
  "shorten.rest",
  "w.wiki",
  "hbr.org/go/",
  "r.fr24.com",
  "lnkd.in",
  "win.gs",
  "engt.co",
  "go.nasa.gov",
  "go.wired.com",
].map((s) => s.toLowerCase());

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
  | "timeout"
  | "max-content-length"
  | "http-error"
  | "library-error"
  | "ssrf-blocked"
  | "expansion-failed";

export interface ShortenerResolution {
  finalUrl: string;
  provider: "unshorten_me" | "direct" | "original";
  chain: string[];
  wasShortened: boolean;
  expanded: boolean;
  reason?: ExpansionFailureReason;
  error?: string;
}

class DirectExpansionError extends Error {
  constructor(
    public reason: ExpansionFailureReason,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "DirectExpansionError";
  }
}

interface UnshortenResponse {
  requested_url?: string;
  resolved_url?: string;
  success?: boolean;
  error?: string;
}

async function resolveWithUnshorten(url: string): Promise<string | null> {
  try {
    const endpoint = config.shortener.unshortenEndpoint.replace(/\/+$/, "");
    const res = await request(`${endpoint}/${encodeURIComponent(url)}`, {
      method: "GET",
      headersTimeout: 5000,
      bodyTimeout: 5000,
    });
    if (res.statusCode >= 400) return null;
    const json = (await res.body.json()) as UnshortenResponse;
    if (json?.resolved_url && json.success !== false) {
      const normalized = normalizeUrl(json.resolved_url);
      return normalized || json.resolved_url;
    }
    return null;
  } catch {
    return null;
  }
}

type UndiciResponse = Awaited<ReturnType<typeof undiciFetch>>;

async function processRedirectResponse(
  response: UndiciResponse,
  normalized: string,
  chain: string[],
): Promise<{
  nextUrl?: string;
  result?: { finalUrl: string; chain: string[] };
}> {
  const location = response.headers?.get?.("location");
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

async function fetchAndValidateUrl(
  normalized: string,
  timeoutMs: number,
  maxContentLength: number,
): Promise<UndiciResponse | null> {
  const response = await undiciFetch(normalized, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentLengthHeader = response.headers?.get?.("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxContentLength) {
      // @ts-ignore
      response.body?.cancel?.();
      throw new DirectExpansionError(
        "max-content-length",
        `Content too large: ${contentLength} bytes`,
      );
    }
  }

  if (response.status >= 400) {
    if (response.status >= 500) {
      // @ts-ignore
      response.body?.cancel?.();
      throw new DirectExpansionError(
        "http-error",
        `Expansion request failed with status ${response.status}`,
      );
    }
    return null;
  }

  return response;
}

async function resolveDirectly(
  url: string,
): Promise<{ finalUrl: string; chain: string[] } | null> {
  const { maxRedirects, timeoutMs, maxContentLength } =
    config.orchestrator.expansion;
  let current = url;
  const chain: string[] = [];

  for (let i = 0; i < maxRedirects; i += 1) {
    const normalized = normalizeUrl(current) || current;
    if (!normalized) break;

    const parsed = new URL(normalized);
    if (await isPrivateHostname(parsed.hostname)) {
      throw new DirectExpansionError(
        "ssrf-blocked",
        "SSRF protection: Private host blocked",
      );
    }

    if (!chain.length || chain[chain.length - 1] !== normalized) {
      chain.push(normalized);
    }

    try {
      const response = await fetchAndValidateUrl(
        normalized,
        timeoutMs,
        maxContentLength,
      );
      if (!response) return null;

      const { nextUrl, result } = await processRedirectResponse(
        response,
        normalized,
        chain,
      );
      if (result) return result;
      if (nextUrl) {
        current = nextUrl;
        continue;
      }
    } catch (error) {
      if (error instanceof DirectExpansionError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new DirectExpansionError(
          "timeout",
          `Expansion timed out after ${timeoutMs}ms`,
        );
      }
      throw new DirectExpansionError(
        "http-error",
        error instanceof Error ? error.message : "Expansion failed",
      );
    }
  }

  return chain.length ? { finalUrl: chain[chain.length - 1], chain } : null;
}

// Note: url-expand dependency removed due to security vulnerabilities in its transitive
// dependencies (request, tough-cookie, form-data). Direct expansion via undici is used instead.

export async function resolveShortener(
  url: string,
): Promise<ShortenerResolution> {
  const normalized = normalizeUrl(url);
  const chain: string[] = [];
  if (!normalized) {
    return {
      finalUrl: url,
      provider: "original",
      chain,
      wasShortened: false,
      expanded: false,
    };
  }
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (!isKnownShortener(hostname)) {
    return {
      finalUrl: normalized,
      provider: "original",
      chain,
      wasShortened: false,
      expanded: false,
    };
  }

  const tries = Math.max(1, config.shortener.unshortenRetries);
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const resolved = await resolveWithUnshorten(normalized);
    if (resolved) {
      metrics.shortenerExpansion.labels("unshorten.me", "success").inc();
      return {
        finalUrl: resolved,
        provider: "unshorten_me",
        chain: [normalized, resolved],
        wasShortened: true,
        expanded: normalized !== resolved,
      };
    }
  }
  metrics.shortenerExpansion.labels("unshorten.me", "error").inc();

  try {
    const directResult = await resolveDirectly(normalized);
    if (directResult) {
      metrics.shortenerExpansion.labels("direct", "success").inc();
      return {
        finalUrl: directResult.finalUrl,
        provider: "direct",
        chain: directResult.chain,
        wasShortened: true,
        expanded:
          directResult.chain.length > 1 || directResult.finalUrl !== normalized,
      };
    }
  } catch (error) {
    metrics.shortenerExpansion.labels("direct", "error").inc();
    const reason =
      error instanceof DirectExpansionError ? error.reason : "expansion-failed";
    const errorMessage =
      error instanceof Error ? error.message : "Expansion failed";
    return {
      finalUrl: normalized,
      provider: "original",
      chain: [normalized],
      wasShortened: true,
      expanded: false,
      reason,
      error: errorMessage,
    };
  }

  // Direct expansion returned null (e.g., 4xx response)
  return {
    finalUrl: normalized,
    provider: "original",
    chain: [normalized],
    wasShortened: true,
    expanded: false,
    reason: "expansion-failed",
    error: "Service unavailable",
  };
}
