import fs from "node:fs";
import path from "node:path";
import { toASCII } from "punycode/";
import { registrableDomain } from "@wbscanner/shared";

const LOCAL_FEEDS_ENABLED =
  (process.env.LOCAL_FEEDS_ENABLED || "true") === "true";
const FEED_DIR =
  process.env.LOCAL_FEED_DIR || path.join(process.cwd(), "storage", "feeds");

const OPENPHISH_PATH =
  process.env.OPENPHISH_LOCAL_PATH || path.join(FEED_DIR, "openphish.txt");
const URLHAUS_PATH =
  process.env.URLHAUS_LOCAL_PATH || path.join(FEED_DIR, "urlhaus.txt");
const SANS_PATH =
  process.env.SANS_LOCAL_PATH || path.join(FEED_DIR, "sans-domains.txt");
const PHISHTANK_PATH =
  process.env.PHISHTANK_LOCAL_PATH || path.join(FEED_DIR, "phishtank.txt");
const CERTPL_PATH =
  process.env.CERTPL_LOCAL_PATH || path.join(FEED_DIR, "certpl-domains.txt");
const TOP_DOMAINS_PATH =
  process.env.MAJESTIC_TOP_LOCAL_PATH ||
  path.join(FEED_DIR, "majestic-top-domains.txt");

const SANS_SCORE_MIN = Number.parseInt(process.env.SANS_SCORE_MIN || "3", 10);

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "vero_conv",
  "vero_id",
]);

type FeedCache = {
  path: string;
  mtimeMs: number;
  entries: Set<string>;
};

type TopDomainsCache = {
  path: string;
  mtimeMs: number;
  exact: Set<string>;
  missingCharVariants: Map<string, string>;
};

export type LocalFeedSignals = {
  openphishListed?: boolean;
  urlhausListed?: boolean;
  phishtankVerified?: boolean;
  certPlListed?: boolean;
  suspiciousDomainListed?: boolean;
  typoSquatTarget?: string;
  typoSquatMethod?: string;
};

let openphishCache: FeedCache | null = null;
let urlhausCache: FeedCache | null = null;
let sansCache: FeedCache | null = null;
let phishtankCache: FeedCache | null = null;
let certplCache: FeedCache | null = null;
let topDomainsCache: TopDomainsCache | null = null;

function normalizeDomain(input: unknown): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || !trimmed.includes(".")) return null;
  return trimmed.replace(/\.+$/, "");
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hostname = u.hostname.toLowerCase();
    u.hostname = toASCII(u.hostname);
    if (
      (u.protocol === "http:" && u.port === "80") ||
      (u.protocol === "https:" && u.port === "443")
    ) {
      u.port = "";
    }
    u.hash = "";
    for (const p of Array.from(u.searchParams.keys())) {
      if (TRACKING_PARAMS.has(p)) u.searchParams.delete(p);
    }
    u.pathname = u.pathname.replace(/\/+/g, "/");
    return u.toString();
  } catch {
    return null;
  }
}

function parseUrlFeed(raw: string): Set<string> {
  const set = new Set<string>();
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.startsWith("http"))
    .forEach((line) => {
      const normalized = normalizeUrl(line);
      if (normalized) set.add(normalized);
    });
  return set;
}

function parseSansDomains(raw: string): Set<string> {
  const trimmed = raw.trim();
  if (!trimmed) return new Set();

  let records: unknown[] = [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        records = parsed;
      }
    } catch {
      return new Set();
    }
  } else if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        records = parsed;
      } else if (parsed) {
        records = [parsed];
      }
    } catch {
      return new Set();
    }
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      const entry = line.trim();
      if (!entry) continue;
      // Accept plain domain lists as-is
      if (!entry.startsWith("{")) {
        const domain = normalizeDomain(entry);
        if (domain) {
          records.push({ domainname: domain, score: SANS_SCORE_MIN });
        }
        continue;
      }
      try {
        records.push(JSON.parse(entry));
      } catch {
        continue;
      }
    }
  }

  const set = new Set<string>();
  for (const record of records) {
    const rawScore =
      (
        record as {
          score?: unknown;
          risk?: unknown;
          risk_score?: unknown;
          r?: unknown;
        }
      )?.score ??
      (record as { risk?: unknown })?.risk ??
      (record as { risk_score?: unknown })?.risk_score ??
      (record as { r?: unknown })?.r;
    const score = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;
    if (score < SANS_SCORE_MIN) continue;

    const domain =
      normalizeDomain((record as { domainname?: unknown })?.domainname) ||
      normalizeDomain((record as { domain?: unknown })?.domain) ||
      normalizeDomain((record as { name?: unknown })?.name) ||
      normalizeDomain((record as { fqdn?: unknown })?.fqdn) ||
      normalizeDomain((record as { host?: unknown })?.host);
    if (domain) set.add(domain);
  }

  return set;
}

function parseDomainList(raw: string): Set<string> {
  const set = new Set<string>();
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const domain = normalizeDomain(line);
      if (domain) set.add(domain);
    });
  return set;
}

function parseTopDomains(raw: string): {
  exact: Set<string>;
  missingCharVariants: Map<string, string>;
} {
  const exact = new Set<string>();
  const missingCharVariants = new Map<string, string>();

  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const normalized = normalizeDomain(line);
      if (!normalized) return;
      const ascii = toASCII(normalized);
      exact.add(ascii);

      const labels = ascii.split(".");
      if (labels.length < 2) return;
      const sld = labels[0];
      const suffix = labels.slice(1).join(".");
      if (sld.length < 4) return;
      for (let i = 0; i < sld.length; i += 1) {
        const variant = sld.slice(0, i) + sld.slice(i + 1);
        if (variant.length < 3) continue;
        const variantDomain = `${variant}.${suffix}`;
        if (!missingCharVariants.has(variantDomain)) {
          missingCharVariants.set(variantDomain, ascii);
        }
      }
    });

  return { exact, missingCharVariants };
}

function loadFeed(
  cache: FeedCache | null,
  filePath: string,
  parser: (raw: string) => Set<string>,
): FeedCache | null {
  try {
    if (!fs.existsSync(filePath)) return cache;
    const stats = fs.statSync(filePath);
    if (cache && cache.mtimeMs === stats.mtimeMs) {
      return cache;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return { path: filePath, mtimeMs: stats.mtimeMs, entries: parser(raw) };
  } catch {
    return cache;
  }
}

function loadTopDomains(cache: TopDomainsCache | null): TopDomainsCache | null {
  try {
    if (!fs.existsSync(TOP_DOMAINS_PATH)) return cache;
    const stats = fs.statSync(TOP_DOMAINS_PATH);
    if (cache && cache.mtimeMs === stats.mtimeMs) {
      return cache;
    }
    const raw = fs.readFileSync(TOP_DOMAINS_PATH, "utf8");
    const parsed = parseTopDomains(raw);
    return {
      path: TOP_DOMAINS_PATH,
      mtimeMs: stats.mtimeMs,
      exact: parsed.exact,
      missingCharVariants: parsed.missingCharVariants,
    };
  } catch {
    return cache;
  }
}

function getOpenphish(): FeedCache | null {
  openphishCache = loadFeed(openphishCache, OPENPHISH_PATH, parseUrlFeed);
  return openphishCache;
}

function getUrlhaus(): FeedCache | null {
  urlhausCache = loadFeed(urlhausCache, URLHAUS_PATH, parseUrlFeed);
  return urlhausCache;
}

function getSans(): FeedCache | null {
  sansCache = loadFeed(sansCache, SANS_PATH, parseSansDomains);
  return sansCache;
}

function getPhishtank(): FeedCache | null {
  phishtankCache = loadFeed(phishtankCache, PHISHTANK_PATH, parseUrlFeed);
  return phishtankCache;
}

function getCertPl(): FeedCache | null {
  certplCache = loadFeed(certplCache, CERTPL_PATH, parseDomainList);
  return certplCache;
}

function getTopDomains(): TopDomainsCache | null {
  topDomainsCache = loadTopDomains(topDomainsCache);
  return topDomainsCache;
}

export function resetLocalFeedCache(): void {
  openphishCache = null;
  urlhausCache = null;
  sansCache = null;
  phishtankCache = null;
  certplCache = null;
  topDomainsCache = null;
}

export function lookupLocalFeedSignals(finalUrl: string): LocalFeedSignals {
  if (!LOCAL_FEEDS_ENABLED) return {};

  const normalized = normalizeUrl(finalUrl) || finalUrl;
  const hostname = (() => {
    try {
      return new URL(normalized).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const registrable = registrableDomain(hostname) || hostname;

  const signals: LocalFeedSignals = {};

  const openphish = getOpenphish();
  if (openphish?.entries.has(normalized)) {
    signals.openphishListed = true;
  }

  const urlhaus = getUrlhaus();
  if (urlhaus?.entries.has(normalized)) {
    signals.urlhausListed = true;
  }

  const phishtank = getPhishtank();
  if (phishtank?.entries.has(normalized)) {
    signals.phishtankVerified = true;
  }

  const sans = getSans();
  if (hostname && sans?.entries.has(hostname)) {
    signals.suspiciousDomainListed = true;
  }

  const certpl = getCertPl();
  if (hostname && certpl && hasDomainSuffix(hostname, certpl.entries)) {
    signals.certPlListed = true;
  }

  const topDomains = getTopDomains();
  if (topDomains) {
    const typo =
      (hostname && detectTyposquat(hostname, topDomains)) ||
      (registrable && detectTyposquat(registrable, topDomains));
    if (typo) {
      signals.typoSquatTarget = typo.target;
      signals.typoSquatMethod = typo.method;
    }
  }

  return signals;
}

function hasDomainSuffix(hostname: string, domains: Set<string>): boolean {
  if (!hostname) return false;
  const parts = hostname.split(".");
  for (let i = 0; i < parts.length; i += 1) {
    const candidate = parts.slice(i).join(".");
    if (domains.has(candidate)) return true;
  }
  return false;
}

type TyposquatMatch = { target: string; method: string };

function detectTyposquat(
  domain: string,
  topDomains: TopDomainsCache,
): TyposquatMatch | null {
  if (!domain || topDomains.exact.has(domain)) return null;

  const missingTarget = topDomains.missingCharVariants.get(domain);
  if (missingTarget) {
    return { target: missingTarget, method: "missing-char" };
  }

  const labels = domain.split(".");
  if (labels.length < 2) return null;
  const sld = labels[0];
  const suffix = labels.slice(1).join(".");
  if (!sld || !suffix) return null;

  if (sld.includes("-")) {
    const collapsed = sld.replace(/-/g, "");
    if (collapsed !== sld) {
      const candidate = `${collapsed}.${suffix}`;
      if (topDomains.exact.has(candidate)) {
        return { target: candidate, method: "hyphen" };
      }
    }
  }

  for (let i = 0; i < sld.length; i += 1) {
    const removed = sld.slice(0, i) + sld.slice(i + 1);
    if (removed.length < 3) continue;
    const candidate = `${removed}.${suffix}`;
    if (topDomains.exact.has(candidate)) {
      return { target: candidate, method: "extra-char" };
    }
  }

  for (let i = 0; i < sld.length - 1; i += 1) {
    if (sld[i] === sld[i + 1]) continue;
    const swapped = sld.slice(0, i) + sld[i + 1] + sld[i] + sld.slice(i + 2);
    const candidate = `${swapped}.${suffix}`;
    if (topDomains.exact.has(candidate)) {
      return { target: candidate, method: "swap" };
    }
  }

  return null;
}
